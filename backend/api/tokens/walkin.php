<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed.', 405);
}

Auth::requireRole(ROLE_RECEPTION, ROLE_ADMIN);

$input = Validator::jsonBody();

$errors = Validator::validate($input, [
    'doctor_id'     => 'required|int',
    'patient_name'  => 'required|max:120',
    'patient_phone' => 'max:20',
    'priority'      => 'in:normal,priority,emergency',
]);
if ($errors) {
    Response::error('Please check the highlighted fields.', 422, $errors);
}

$doctor = Doctor::findById((int) $input['doctor_id']);
if ($doctor === null) {
    Response::error('Doctor not found.', 404);
}

try {
    $result = QueueEngine::createWalkIn(
        (int) $input['doctor_id'],
        $input['patient_name'],
        $input['patient_phone'] ?? null,
        $input['priority'] ?? 'normal'
    );
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 409);
}

Response::success($result, 201);