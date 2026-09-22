<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed.', 405);
}

$errors = Validator::validate($_GET, ['clinic_id' => 'required|int']);
if ($errors) {
    Response::error('Please check the highlighted fields.', 422, $errors);
}

Response::success(['doctors' => Doctor::listByClinic((int) $_GET['clinic_id'])]);