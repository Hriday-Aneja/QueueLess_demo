<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed.', 405);
}

Auth::requireRole(ROLE_RECEPTION, ROLE_ADMIN);

$errors = Validator::validate($_GET, [
    'doctor_id' => 'required|int',
    'date'      => 'required|date',
]);
if ($errors) {
    Response::error('Please check the highlighted fields.', 422, $errors);
}

Response::success(QueueEngine::receptionView((int) $_GET['doctor_id'], $_GET['date']));