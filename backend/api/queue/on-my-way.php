<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed.', 405);
}

Auth::requireRole(ROLE_PATIENT);

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

if ((int) $token['patient_id'] !== (int) Auth::extra('patient_id')) {
    Response::error('You are not authorized to update this token.', 403);
}

try {
    $result = QueueEngine::onMyWay($tokenId);
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 409);
}

Response::success($result);