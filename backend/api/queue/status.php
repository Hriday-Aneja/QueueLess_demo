<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed.', 405);
}

Auth::requireLogin();

$errors = Validator::validate($_GET, ['token_id' => 'required|int']);
if ($errors) {
    Response::error('Please check the highlighted fields.', 422, $errors);
}

$tokenId = (int) $_GET['token_id'];
$token = Token::findById($tokenId);
if ($token === null) {
    Response::error('Token not found.', 404);
}

if (Auth::role() === ROLE_PATIENT && (int) $token['patient_id'] !== (int) Auth::extra('patient_id')) {
    Response::error('You are not authorized to view this token.', 403);
}

Response::success(QueueEngine::getStatus($tokenId));