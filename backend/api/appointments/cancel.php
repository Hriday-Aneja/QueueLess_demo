<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed.', 405);
}

Auth::requireRole(ROLE_PATIENT, ROLE_RECEPTION, ROLE_ADMIN);

$input = Validator::jsonBody();

if (empty($input['appointment_id']) && empty($input['token_id'])) {
    Response::error('Provide either appointment_id or token_id.', 422);
}

if (!empty($input['appointment_id'])) {
    $token = Token::findByAppointmentId((int) $input['appointment_id']);
    if ($token === null) {
        Response::error('No token found for this appointment.', 404);
    }
} else {
    $token = Token::findById((int) $input['token_id']);
    if ($token === null) {
        Response::error('Token not found.', 404);
    }
}

if (Auth::role() === ROLE_PATIENT && (int) $token['patient_id'] !== (int) Auth::extra('patient_id')) {
    Response::error('You are not authorized to cancel this appointment.', 403);
}

try {
    $result = QueueEngine::cancel((int) $token['token_id']);
} catch (InvalidArgumentException | RuntimeException $e) {
    Response::error($e->getMessage(), 409);
}

Response::success($result);