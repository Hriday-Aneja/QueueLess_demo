<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed.', 405);
}

Auth::requireRole(ROLE_ADMIN);

$db = get_db_connection();
$today = date('Y-m-d');

$patientsToday = $db->prepare(
    "SELECT COUNT(DISTINCT patient_id) AS n FROM tokens WHERE token_date = :today"
);
$patientsToday->execute(['today' => $today]);

$doctorCount = $db->query("SELECT COUNT(*) AS n FROM doctors WHERE is_active = TRUE")->fetch();

$avgWait = $db->prepare(
    "SELECT AVG(qs.estimated_wait_minutes) AS avg_wait
     FROM queue_status qs
     JOIN tokens t ON t.token_id = qs.token_id
     WHERE t.token_date = :today AND qs.estimated_wait_minutes IS NOT NULL"
);
$avgWait->execute(['today' => $today]);

Response::success([
    'total_patients_today' => (int) $patientsToday->fetch()['n'],
    'total_doctors'        => (int) $doctorCount['n'],
    'avg_wait_minutes'     => round((float) ($avgWait->fetch()['avg_wait'] ?? 0), 1),
]);