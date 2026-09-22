<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

Auth::requireRole(ROLE_ADMIN);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $errors = Validator::validate($_GET, ['clinic_id' => 'required|int']);
    if ($errors) {
        Response::error('Please check the highlighted fields.', 422, $errors);
    }

    $departmentId = isset($_GET['department_id']) ? (int) $_GET['department_id'] : 0;

    Response::success(QueueRule::forDepartment($departmentId, (int) $_GET['clinic_id']));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = Validator::jsonBody();

    $errors = Validator::validate($input, [
        'clinic_id'                    => 'required|int',
        'grace_period_minutes'         => 'int',
        'average_consultation_minutes' => 'int',
        'appointment_priority'         => 'int',
        'walkin_priority'              => 'int',
        'no_show_after_minutes'        => 'int',
        'late_arrival_rule'            => 'max:30',
    ]);
    if ($errors) {
        Response::error('Please check the highlighted fields.', 422, $errors);
    }

    $clinicId = (int) $input['clinic_id'];
    $departmentId = isset($input['department_id']) ? (int) $input['department_id'] : null;

    QueueRule::upsert($clinicId, $departmentId, $input);

    Response::success(QueueRule::forDepartment($departmentId ?? 0, $clinicId));
    exit;
}

Response::error('Method not allowed.', 405);