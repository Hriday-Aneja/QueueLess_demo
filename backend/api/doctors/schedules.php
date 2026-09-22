<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed.', 405);
}

$errors = Validator::validate($_GET, [
    'doctor_id' => 'required|int',
    'date'      => 'required|date',
]);
if ($errors) {
    Response::error('Please check the highlighted fields.', 422, $errors);
}

$doctor = Doctor::findById((int) $_GET['doctor_id']);
if ($doctor === null) {
    Response::error('Doctor not found.', 404);
}

$slots = Schedule::availableSlots((int) $_GET['doctor_id'], $_GET['date']);

Response::success([
    'available' => !empty($slots),
    'slots'     => $slots,
]);