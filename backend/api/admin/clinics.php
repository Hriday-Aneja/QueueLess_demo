<?php
/**
 * GET  /admin/clinics.php            -> list every clinic (active + inactive)
 *                                        with its active departments nested in,
 *                                        for the admin table + the Doctor form's
 *                                        clinic/department dropdowns.
 * POST /admin/clinics.php             -> create a clinic, or update one when
 *                                        `clinic_id` is present in the body
 *                                        (this also covers activate/deactivate:
 *                                        the client sends the full row back
 *                                        with is_active flipped).
 *
 * Admin-only. Clinics are never hard-deleted here (see Part A) — only
 * is_active is toggled, so existing departments/doctors are never orphaned.
 */

require_once __DIR__ . '/../../includes/bootstrap.php';

Auth::requireRole(ROLE_ADMIN);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $clinics = Clinic::listAllForAdmin();

    foreach ($clinics as &$clinic) {
        $clinic['clinic_id'] = (int) $clinic['clinic_id'];
        $clinic['is_active'] = (bool) $clinic['is_active'];
        $clinic['departments'] = Department::listByClinic($clinic['clinic_id']);
    }
    unset($clinic);

    Response::success(['clinics' => $clinics]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = Validator::jsonBody();

    $errors = Validator::validate($input, [
        'clinic_name' => 'required|max:150',
        'address'     => 'max:255',
        'phone'       => 'max:20',
    ]);
    if ($errors) {
        Response::error('Please check the highlighted fields.', 422, $errors);
    }

    $name      = trim($input['clinic_name']);
    $address   = isset($input['address']) && $input['address'] !== '' ? trim($input['address']) : null;
    $phone     = isset($input['phone']) && $input['phone'] !== '' ? trim($input['phone']) : null;
    $isActive  = array_key_exists('is_active', $input) ? (bool) $input['is_active'] : true;
    $clinicId  = isset($input['clinic_id']) ? (int) $input['clinic_id'] : null;

    if ($clinicId !== null) {
        // ---- Update (also covers activate/deactivate) ----
        if (Clinic::findById($clinicId) === null) {
            Response::error('Hospital/clinic not found.', 404);
        }
        if (Clinic::nameExists($name, $clinicId)) {
            Response::error('Another hospital/clinic already uses this name.', 409, ['clinic_name' => 'This name is already in use.']);
        }

        Clinic::update($clinicId, $name, $address, $phone, $isActive);

        Response::success(['clinic_id' => $clinicId]);
    }

    // ---- Create ----
    if (Clinic::nameExists($name)) {
        Response::error('A hospital/clinic with this name already exists.', 409, ['clinic_name' => 'This name is already in use.']);
    }

    $newId = Clinic::create($name, $address, $phone, $isActive);

    Response::success(['clinic_id' => $newId], 201);
}

Response::error('Method not allowed.', 405);
