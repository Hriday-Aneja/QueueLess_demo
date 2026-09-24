<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed.', 405);
}

Auth::requireRole(ROLE_DOCTOR);

$doctorId = Auth::extra('doctor_id');
if ($doctorId === null) {
    Response::error('No doctor profile found for this account.', 400);
}

Response::success(['appointments' => Token::listForDoctorAllDates((int) $doctorId)]);