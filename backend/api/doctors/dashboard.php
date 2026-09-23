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

// Date is never taken from the client for this endpoint — always
// today's queue for the logged-in doctor.
$date = date('Y-m-d');

try {
    $result = QueueEngine::doctorDashboard((int) $doctorId, $date);
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 404);
}

Response::success($result);