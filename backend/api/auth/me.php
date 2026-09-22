<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed.', 405);
}

Auth::requireLogin();

$user = User::findById(Auth::userId());
if ($user === null) {
    // Session points at a user that no longer exists — clear it.
    Auth::logout();
    Response::error('Session is no longer valid. Please log in again.', 401);
}

$extra = [];
if ($user['role'] === ROLE_PATIENT) {
    $patientId = Auth::extra('patient_id');
    if ($patientId !== null) {
        $extra['patient_id'] = $patientId;
    }
}

Response::success([
    'user_id' => (int) $user['user_id'],
    'role'    => $user['role'],
    'name'    => $user['full_name'],
    'email'   => $user['email'],
] + $extra);