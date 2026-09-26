<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed.', 405);
}

Auth::requireLogin();

$input = Validator::jsonBody();

$errors = Validator::validate($input, [
    'doctor_id'     => 'required|int',
    'patient_id'    => 'int',
    'patient_name'  => 'max:120',
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
    if (Auth::role() === ROLE_PATIENT) {
        $patientId = Auth::extra('patient_id');
        if ($patientId === null) {
            Response::error('No patient profile found for this account.', 400);
        }
        $result = TokenGenerator::forWalkIn((int) $input['doctor_id'], (int) $patientId);
    } elseif (Auth::role() === ROLE_RECEPTION || Auth::role() === ROLE_ADMIN) {
        if (empty($input['patient_name']) && empty($input['patient_id'])) {
            Response::error('Patient details are required.', 422);
        }
        if (!empty($input['patient_id'])) {
            $patient = Patient::findById((int) $input['patient_id']);
            if ($patient === null) Response::error('Patient not found.', 404);
            $result = TokenGenerator::forWalkIn((int) $input['doctor_id'], (int) $input['patient_id'], $input['priority'] ?? 'normal');
        } else {
            $result = QueueEngine::createWalkIn(
                (int) $input['doctor_id'], $input['patient_name'], $input['patient_phone'] ?? null, $input['priority'] ?? 'normal'
            );
        }
    } else {
        Response::error('You are not authorized to do this.', 403);
    }
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 409);
}

Response::success($result, 201);