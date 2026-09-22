<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed.', 405);
}

Auth::requireRole(ROLE_PATIENT);

$input = Validator::jsonBody();

$errors = Validator::validate($input, [
    'doctor_id'        => 'required|int',
    'appointment_date' => 'required|date',
    'slot_time'        => 'required',
]);
if ($errors) {
    Response::error('Please check the highlighted fields.', 422, $errors);
}

$patientId = Auth::extra('patient_id');
if ($patientId === null) {
    Response::error('No patient profile found for this account.', 400);
}

$doctor = Doctor::findById((int) $input['doctor_id']);
if ($doctor === null) {
    Response::error('Doctor not found.', 404);
}

// Confirm the slot is still open before booking, to catch the common
// case of two patients racing for the same slot.
$openSlots = Schedule::availableSlots((int) $input['doctor_id'], $input['appointment_date']);
if (!in_array($input['slot_time'], $openSlots, true)) {
    Response::error('That time slot is no longer available. Please pick another.', 409);
}

// Priority is never taken from patient input — only reception/admin can
// mark a token as priority/emergency. Patient bookings are always normal.
try {
    $result = QueueEngine::bookAppointment(
        (int) $patientId,
        (int) $input['doctor_id'],
        (int) $doctor['department_id'],
        $input['appointment_date'],
        $input['slot_time'],
        'normal',
        $input['reason'] ?? null
    );
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 409);
}

Response::success($result, 201);