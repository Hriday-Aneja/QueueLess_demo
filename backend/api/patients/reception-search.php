<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') Response::error('Method not allowed.', 405);
Auth::requireRole(ROLE_RECEPTION, ROLE_ADMIN);

$errors = Validator::validate($_GET, ['q' => 'required|min:2|max:120', 'patient_id' => 'int']);
if ($errors) Response::error('Please check the highlighted fields.', 422, $errors);

$patients = !empty($_GET['patient_id'])
    ? (($patient = Patient::findById((int) $_GET['patient_id'])) ? [$patient] : [])
    : Patient::searchForReception(trim($_GET['q']));

foreach ($patients as &$patient) {
    if (empty($patient['full_name']) && !empty($patient['user_id'])) {
        $user = User::findById((int) $patient['user_id']);
        $patient['full_name'] = $user['full_name'] ?? null;
        $patient['phone'] = $user['phone'] ?? null;
    }
    $patient['appointments'] = Appointment::listForReceptionPatient((int) $patient['patient_id']);
}

Response::success(['patients' => $patients]);