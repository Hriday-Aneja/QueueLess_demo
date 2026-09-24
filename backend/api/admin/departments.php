<?php
/**
 * GET  /admin/departments.php?clinic_id=X  -> all departments (active +
 *      inactive) for one hospital/clinic, for the admin table.
 * POST /admin/departments.php               -> create a department, or
 *      update one when `department_id` is present in the body (this also
 *      covers activate/deactivate: the client sends the full row back
 *      with is_active flipped).
 *
 * Admin-only. A department always belongs to a clinic — `clinic_id` is
 * required on every write and is never accepted as a way to move a
 * department to a different clinic (a mismatch on update is rejected).
 * Departments are never hard-deleted, only deactivated, so existing
 * doctors under them are never orphaned. Does not touch doctor_schedules,
 * queue_rules, or anything the Queue Engine owns.
 */

require_once __DIR__ . '/../../includes/bootstrap.php';

Auth::requireRole(ROLE_ADMIN);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $errors = Validator::validate($_GET, ['clinic_id' => 'required|int']);
    if ($errors) {
        Response::error('Please check the highlighted fields.', 422, $errors);
    }

    $clinicId = (int) $_GET['clinic_id'];
    if (Clinic::findById($clinicId) === null) {
        Response::error('Hospital/clinic not found.', 404);
    }

    $rows = Department::listAllByClinicForAdmin($clinicId);
    $departments = array_map(function (array $r): array {
        return [
            'department_id'   => (int) $r['department_id'],
            'clinic_id'       => (int) $r['clinic_id'],
            'department_name' => $r['department_name'],
            'description'     => $r['description'],
            'is_active'       => (bool) $r['is_active'],
        ];
    }, $rows);

    Response::success(['departments' => $departments]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = Validator::jsonBody();

    $errors = Validator::validate($input, [
        'clinic_id'       => 'required|int',
        'department_name' => 'required|max:100',
        'description'     => 'max:1000',
    ]);
    if ($errors) {
        Response::error('Please check the highlighted fields.', 422, $errors);
    }

    $clinicId    = (int) $input['clinic_id'];
    $name        = trim($input['department_name']);
    $description = isset($input['description']) && $input['description'] !== '' ? trim($input['description']) : null;
    $isActive    = array_key_exists('is_active', $input) ? (bool) $input['is_active'] : true;
    $departmentId = isset($input['department_id']) ? (int) $input['department_id'] : null;

    if (Clinic::findById($clinicId) === null) {
        Response::error('Hospital/clinic not found.', 404);
    }

    if ($departmentId !== null) {
        // ---- Update (also covers activate/deactivate) ----
        $existing = Department::findById($departmentId);
        if ($existing === null) {
            Response::error('Department not found.', 404);
        }
        if ((int) $existing['clinic_id'] !== $clinicId) {
            Response::error('This department does not belong to the selected hospital.', 422);
        }
        if (Department::nameExistsInClinic($clinicId, $name, $departmentId)) {
            Response::error('This hospital already has a department with this name.', 409, ['department_name' => 'This name is already in use.']);
        }

        Department::update($departmentId, $name, $description, $isActive);

        Response::success(['department_id' => $departmentId]);
    }

    // ---- Create ----
    if (Department::nameExistsInClinic($clinicId, $name)) {
        Response::error('This hospital already has a department with this name.', 409, ['department_name' => 'This name is already in use.']);
    }

    $newId = Department::create($clinicId, $name, $description, $isActive);

    Response::success(['department_id' => $newId], 201);
}

Response::error('Method not allowed.', 405);
