<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed.', 405);
}

$input = Validator::jsonBody();

$errors = Validator::validate($input, [
    'full_name' => 'required|max:120',
    'email'     => 'required|email',
    'phone'     => 'max:20',
    'password'  => 'required|min:6',
]);
if ($errors) {
    Response::error('Please check the highlighted fields.', 422, $errors);
}

if (User::emailExists($input['email'])) {
    Response::error('An account with this email already exists.', 409);
}

// Public self-registration is for patients only. Reception/admin
// accounts are provisioned separately (seed data or the admin panel),
// never through this open endpoint.
$passwordHash = password_hash($input['password'], PASSWORD_DEFAULT);
$userId = User::create($input['full_name'], $input['email'], $input['phone'] ?? null, $passwordHash, ROLE_PATIENT);

$patientId = Patient::create(
    $userId,
    $input['date_of_birth'] ?? null,
    $input['gender'] ?? null
);

Auth::login($userId, ROLE_PATIENT, ['patient_id' => $patientId]);

Response::success([
    'user_id'    => $userId,
    'patient_id' => $patientId,
    'role'       => ROLE_PATIENT,
], 201);