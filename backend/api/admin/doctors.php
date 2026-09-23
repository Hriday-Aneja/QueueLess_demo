<?php
/**
 * GET  /admin/doctors.php   -> filterable/searchable doctor listing
 *      query params (all optional): clinic_id, department_id,
 *      status ('active'|'inactive'|'all', default 'all'), search
 *
 * POST /admin/doctors.php   -> create a doctor, or update one when
 *      `doctor_id` is present in the body (this also covers
 *      activate/deactivate: the client sends the full row back with
 *      is_active flipped).
 *
 * Admin-only. Creating a doctor writes to BOTH `users` (role=doctor)
 * and `doctors` inside a single transaction, so a failure partway
 * through never leaves an orphaned row in either table. This does not
 * touch doctor_schedules, queue_rules, or anything the Queue Engine
 * owns.
 */

require_once __DIR__ . '/../../includes/bootstrap.php';

Auth::requireRole(ROLE_ADMIN);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $filters = [
        'clinic_id'     => $_GET['clinic_id'] ?? null,
        'department_id' => $_GET['department_id'] ?? null,
        'status'        => $_GET['status'] ?? 'all',
        'search'        => isset($_GET['search']) ? trim((string) $_GET['search']) : null,
    ];

    $rows = Doctor::listForAdmin($filters);

    $doctors = array_map(function (array $r): array {
        return [
            'doctor_id'        => (int) $r['doctor_id'],
            'doctor_code'      => $r['doctor_code'],
            'specialization'   => $r['specialization'],
            'consultation_fee' => (float) $r['consultation_fee'],
            'is_active'        => (bool) $r['is_active'],
            'department_id'    => (int) $r['department_id'],
            'department_name'  => $r['department_name'],
            'clinic_id'        => (int) $r['clinic_id'],
            'clinic_name'      => $r['clinic_name'],
            'user_id'          => $r['user_id'] !== null ? (int) $r['user_id'] : null,
            'full_name'        => $r['full_name'],
            'email'            => $r['email'],
            'phone'            => $r['phone'],
        ];
    }, $rows);

    Response::success(['doctors' => $doctors]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = Validator::jsonBody();

    $errors = Validator::validate($input, [
        'full_name'      => 'required|max:120',
        'email'          => 'required|email',
        'phone'          => 'max:20',
        'clinic_id'      => 'required|int',
        'department_id'  => 'required|int',
        'doctor_code'    => 'required|max:30',
        'specialization' => 'max:100',
    ]);
    if ($errors) {
        Response::error('Please check the highlighted fields.', 422, $errors);
    }

    // consultation_fee isn't covered by Validator's rule set (no
    // 'numeric' rule) — check it directly.
    $feeRaw = $input['consultation_fee'] ?? null;
    if ($feeRaw === null || $feeRaw === '' || !is_numeric($feeRaw) || (float) $feeRaw < 0) {
        Response::error('Please check the highlighted fields.', 422, [
            'consultation_fee' => 'Consultation fee must be a number of 0 or more.',
        ]);
    }

    $fullName       = trim($input['full_name']);
    $email          = trim($input['email']);
    $phone          = isset($input['phone']) && $input['phone'] !== '' ? trim($input['phone']) : null;
    $clinicId       = (int) $input['clinic_id'];
    $departmentId   = (int) $input['department_id'];
    $doctorCode     = trim($input['doctor_code']);
    $specialization = isset($input['specialization']) && $input['specialization'] !== '' ? trim($input['specialization']) : null;
    $fee            = (float) $feeRaw;
    $isActive       = array_key_exists('is_active', $input) ? (bool) $input['is_active'] : true;
    $doctorId       = isset($input['doctor_id']) ? (int) $input['doctor_id'] : null;

    // The selected department must actually belong to the selected
    // clinic — the two dropdowns are meant to be linked, but the
    // server must not trust that the client kept them consistent.
    $department = Department::findById($departmentId);
    if ($department === null || (int) $department['clinic_id'] !== $clinicId) {
        Response::error('Please check the highlighted fields.', 422, [
            'department_id' => 'Selected department does not belong to the selected hospital.',
        ]);
    }

    $db = get_db_connection();

    if ($doctorId !== null) {
        /* ---------------- Update ---------------- */

        $existing = Doctor::findById($doctorId);
        if ($existing === null) {
            Response::error('Doctor not found.', 404);
        }

        if (Doctor::codeExists($doctorCode, $doctorId)) {
            Response::error('Another doctor already uses this doctor code.', 409, ['doctor_code' => 'This code is already in use.']);
        }

        $userId = $existing['user_id'] !== null ? (int) $existing['user_id'] : null;
        if ($userId !== null && User::emailExists($email, $userId)) {
            Response::error('Another account already uses this email.', 409, ['email' => 'This email is already in use.']);
        }

        $db->beginTransaction();
        try {
            if ($userId !== null) {
                User::update($userId, $fullName, $email, $phone);
                // Keep login access in sync with the doctor's active state.
                User::setActive($userId, $isActive);
            }
            Doctor::update($doctorId, $departmentId, $doctorCode, $specialization, $fee, $isActive);
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }

        Response::success(['doctor_id' => $doctorId]);
    }

    /* ---------------- Create ---------------- */

    if (Doctor::codeExists($doctorCode)) {
        Response::error('A doctor with this doctor code already exists.', 409, ['doctor_code' => 'This code is already in use.']);
    }
    if (User::emailExists($email)) {
        Response::error('An account with this email already exists.', 409, ['email' => 'This email is already in use.']);
    }

    // Admin-created staff accounts get a random temporary password
    // (never re-shown after this response) rather than a predictable
    // default — the doctor can be given this once, out of band, and
    // should change it after first login.
    $tempPassword = bin2hex(random_bytes(6)); // 12 hex chars
    $passwordHash = password_hash($tempPassword, PASSWORD_DEFAULT);

    $db->beginTransaction();
    try {
        $userId = User::create($fullName, $email, $phone, $passwordHash, ROLE_DOCTOR);
        $newDoctorId = Doctor::create($userId, $departmentId, $doctorCode, $specialization, $fee, $isActive);
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    Response::success([
        'doctor_id'     => $newDoctorId,
        'user_id'       => $userId,
        'temp_password' => $tempPassword,
    ], 201);
}

Response::error('Method not allowed.', 405);
