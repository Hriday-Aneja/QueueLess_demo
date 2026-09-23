<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed.', 405);
}

Auth::requireRole(ROLE_RECEPTION, ROLE_ADMIN, ROLE_DOCTOR);

$input = Validator::jsonBody();
$errors = Validator::validate($input, ['token_id' => 'required|int']);
if ($errors) {
    Response::error('Please check the highlighted fields.', 422, $errors);
}

$tokenId = (int) $input['token_id'];
$token = Token::findById($tokenId);
if ($token === null) {
    Response::error('Token not found.', 404);
}

if (Auth::role() === ROLE_DOCTOR && (int) $token['doctor_id'] !== (int) Auth::extra('doctor_id')) {
    Response::error('You are not authorized to act on this token.', 403);
}

try {
    $result = QueueEngine::startConsultation($tokenId);
} catch (InvalidArgumentException | RuntimeException $e) {
    Response::error($e->getMessage(), 409);
}

Response::success($result);