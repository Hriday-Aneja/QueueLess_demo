<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed.', 405);
}

Auth::requireLogin();

$input = Validator::jsonBody();
$errors = Validator::validate($input, ['notification_id' => 'required|int']);
if ($errors) {
    Response::error('Please check the highlighted fields.', 422, $errors);
}

$marked = Notification::markRead((int) $input['notification_id'], Auth::userId());
if (!$marked) {
    Response::error('Notification not found.', 404);
}

Response::success([]);