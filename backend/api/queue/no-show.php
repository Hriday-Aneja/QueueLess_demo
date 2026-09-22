<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed.', 405);
}

Auth::requireRole(ROLE_RECEPTION, ROLE_ADMIN);

$input = Validator::jsonBody();
$errors = Validator::validate($input, ['token_id' => 'required|int']);
if ($errors) {
    Response::error('Please check the highlighted fields.', 422, $errors);
}

$tokenId = (int) $input['token_id'];
if (Token::findById($tokenId) === null) {
    Response::error('Token not found.', 404);
}

try {
    $result = QueueEngine::markNoShow($tokenId);
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 409);
}

Response::success($result);