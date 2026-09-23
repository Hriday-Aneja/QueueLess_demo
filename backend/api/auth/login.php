<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed.', 405);
}

$input = Validator::jsonBody();

$errors = Validator::validate($input, [
    'email'    => 'required|email',
    'password' => 'required',
]);
if ($errors) {
    Response::error('Please check the highlighted fields.', 422, $errors);
}

$user = User::findByEmailWithPassword($input['email']);

if ($user === null || !password_verify($input['password'], $user['password_hash'])) {
    Response::error('Invalid email or password.', 401);
}

if (!$user['is_active']) {
    Response::error('This account has been disabled.', 403);
}

$extra = [];
if ($user['role'] === ROLE_PATIENT) {
    $patient = Patient::findByUserId((int) $user['user_id']);
    if ($patient !== null) {
        $extra['patient_id'] = (int) $patient['patient_id'];
    }
} elseif ($user['role'] === ROLE_DOCTOR) {
    $doctor = Doctor::findByUserId((int) $user['user_id']);
    if ($doctor !== null) {
        $extra['doctor_id'] = (int) $doctor['doctor_id'];
    }
}

Auth::login((int) $user['user_id'], $user['role'], $extra);

Response::success([
    'user_id' => (int) $user['user_id'],
    'role'    => $user['role'],
    'name'    => $user['full_name'],
] + $extra);