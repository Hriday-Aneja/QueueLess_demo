<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed.', 405);
}

Auth::requireRole(ROLE_PATIENT);

$patientId = Auth::extra('patient_id');
if ($patientId === null) {
    Response::error('No patient profile found for this account.', 400);
}

Response::success(['appointments' => Appointment::listForPatient((int) $patientId)]);