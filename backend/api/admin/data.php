<?php
/**
 * GET /admin/data.php
 *
 * Admin Dashboard statistics API (Hriday — Admin/Database/Analytics).
 *
 * Read-only aggregation over the tables Arnav's Queue Engine writes to
 * (tokens, queue_status, appointments, consultations). This endpoint does
 * NOT calculate queue order, priority, or ETA — it only reads timestamps
 * and statuses that already exist and reports on them. All values are
 * computed fresh from the database on every request (nothing hardcoded).
 *
 * Auth: admin only (session-based, via the shared Auth/session system).
 * Method: GET only.
 */

require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed.', 405);
}

Auth::requireRole(ROLE_ADMIN);

$db    = get_db_connection();
$today = date('Y-m-d');

/*
 * Status buckets.
 *
 * NOTE: the seed data (and, at the time of writing, the live queue
 * engine) uses 'in_progress' for an active consultation, while
 * core/QueueStateMachine.php defines the canonical name as 'consulting'.
 * Both are treated as "in progress" here so the dashboard stays correct
 * either way. This is a read-only reporting concern, not a change to
 * the Queue Engine's state machine.
 */
const WAITING_STATUSES     = ['waiting', 'next', 'arriving', 'checked_in'];
const IN_PROGRESS_STATUSES = ['in_progress', 'consulting'];
const DONE_STATUS          = 'completed';
const NO_SHOW_STATUS       = 'no_show';
const CANCELLED_STATUS     = 'cancelled';

/**
 * Small helper: build a "IN (?, ?, ...)" placeholder list and return
 * [sql fragment, params] so every query below stays a prepared statement.
 */
function in_clause(string $column, array $values, string $prefix): array
{
    $placeholders = [];
    $params = [];
    foreach (array_values($values) as $i => $value) {
        $key = ':' . $prefix . $i;
        $placeholders[] = $key;
        $params[$key] = $value;
    }
    return [$column . ' IN (' . implode(',', $placeholders) . ')', $params];
}

/* =========================================================
 * 1. KPI CARDS
 * ========================================================= */

// -- Total Patients Today: distinct patients with a queue token today.
$stmt = $db->prepare(
    'SELECT COUNT(DISTINCT patient_id) AS n FROM tokens WHERE token_date = :today'
);
$stmt->execute(['today' => $today]);
$patientsToday = (int) $stmt->fetch()['n'];

// -- Appointments Today: every appointment (booked + walk-in) dated today.
$stmt = $db->prepare(
    'SELECT COUNT(*) AS n FROM appointments WHERE appointment_date = :today'
);
$stmt->execute(['today' => $today]);
$appointmentsToday = (int) $stmt->fetch()['n'];

// -- Patients Served: tokens completed today.
$stmt = $db->prepare(
    "SELECT COUNT(*) AS n FROM tokens WHERE token_date = :today AND status = :done"
);
$stmt->execute(['today' => $today, 'done' => DONE_STATUS]);
$patientsServed = (int) $stmt->fetch()['n'];

// -- Currently Waiting / Currently In Progress: from live queue_status,
//    falling back to the token's own status if it has no queue_status row.
[$waitingSql, $waitingParams] = in_clause('COALESCE(qs.current_status, t.status)', WAITING_STATUSES, 'w');
$stmt = $db->prepare(
    "SELECT COUNT(*) AS n
     FROM tokens t
     LEFT JOIN queue_status qs ON qs.token_id = t.token_id
     WHERE t.token_date = :today AND $waitingSql"
);
$stmt->execute(array_merge(['today' => $today], $waitingParams));
$currentlyWaiting = (int) $stmt->fetch()['n'];

[$progressSql, $progressParams] = in_clause('COALESCE(qs.current_status, t.status)', IN_PROGRESS_STATUSES, 'p');
$stmt = $db->prepare(
    "SELECT COUNT(*) AS n
     FROM tokens t
     LEFT JOIN queue_status qs ON qs.token_id = t.token_id
     WHERE t.token_date = :today AND $progressSql"
);
$stmt->execute(array_merge(['today' => $today], $progressParams));
$currentlyInProgress = (int) $stmt->fetch()['n'];

// -- Average Waiting Time: actual measured minutes from check-in to the
//    consultation starting, for today's tokens that reached that point.
//    (This reports on history already recorded by the Queue Engine — it
//    does not compute a live ETA, which is Arnav's territory.)
$stmt = $db->prepare(
    "SELECT AVG(TIMESTAMPDIFF(MINUTE, qs.checked_in_at, qs.consultation_started_at)) AS avg_wait
     FROM queue_status qs
     JOIN tokens t ON t.token_id = qs.token_id
     WHERE t.token_date = :today
       AND qs.checked_in_at IS NOT NULL
       AND qs.consultation_started_at IS NOT NULL
       AND qs.consultation_started_at >= qs.checked_in_at"
);
$stmt->execute(['today' => $today]);
$avgWaitRow = $stmt->fetch();
$avgWaitingMinutes = $avgWaitRow['avg_wait'] !== null ? round((float) $avgWaitRow['avg_wait'], 1) : null;

// -- No-show count / rate (of today's tokens).
$stmt = $db->prepare(
    "SELECT COUNT(*) AS n FROM tokens WHERE token_date = :today AND status = :no_show"
);
$stmt->execute(['today' => $today, 'no_show' => NO_SHOW_STATUS]);
$noShowCount = (int) $stmt->fetch()['n'];

$stmt = $db->prepare('SELECT COUNT(*) AS n FROM tokens WHERE token_date = :today');
$stmt->execute(['today' => $today]);
$totalTokensToday = (int) $stmt->fetch()['n'];

$noShowRate = $totalTokensToday > 0
    ? round(($noShowCount / $totalTokensToday) * 100, 1)
    : 0.0;

// -- Active Doctors.
$stmt = $db->query('SELECT COUNT(*) AS n FROM doctors WHERE is_active = TRUE');
$activeDoctors = (int) $stmt->fetch()['n'];

$stmt = $db->query('SELECT COUNT(*) AS n FROM doctors');
$totalDoctors = (int) $stmt->fetch()['n'];

/* =========================================================
 * 2. APPOINTMENT STATUS BREAKDOWN (today) — powers a chart
 * ========================================================= */

$stmt = $db->prepare(
    "SELECT status, COUNT(*) AS n
     FROM appointments
     WHERE appointment_date = :today
     GROUP BY status"
);
$stmt->execute(['today' => $today]);

$statusBreakdown = [
    'scheduled'   => 0,
    'checked_in'  => 0,
    'completed'   => 0,
    'cancelled'   => 0,
    'no_show'     => 0,
];
foreach ($stmt->fetchAll() as $row) {
    $statusBreakdown[$row['status']] = (int) $row['n'];
}

// Appointment type breakdown (booked vs walk-in) — same source data.
$stmt = $db->prepare(
    "SELECT appointment_type, COUNT(*) AS n
     FROM appointments
     WHERE appointment_date = :today
     GROUP BY appointment_type"
);
$stmt->execute(['today' => $today]);

$typeBreakdown = ['appointment' => 0, 'walkin' => 0];
foreach ($stmt->fetchAll() as $row) {
    $typeBreakdown[$row['appointment_type']] = (int) $row['n'];
}

/* =========================================================
 * 3. HOURLY LOAD (peak hours) — today's appointments by hour
 * ========================================================= */

$stmt = $db->prepare(
    "SELECT HOUR(appointment_time) AS hr, COUNT(*) AS n
     FROM appointments
     WHERE appointment_date = :today
     GROUP BY HOUR(appointment_time)
     ORDER BY hr"
);
$stmt->execute(['today' => $today]);

$hourlyLoad = [];
foreach ($stmt->fetchAll() as $row) {
    $hourlyLoad[] = [
        'hour'  => sprintf('%02d:00', (int) $row['hr']),
        'count' => (int) $row['n'],
    ];
}

/* =========================================================
 * 4. TODAY'S APPOINTMENT SUMMARY TABLE
 * ========================================================= */

$stmt = $db->prepare(
    "SELECT a.appointment_id, a.appointment_time, a.appointment_type, a.priority, a.status,
            COALESCE(pu.full_name, CONCAT('Patient #', p.patient_id)) AS patient_name,
            COALESCE(du.full_name, d.doctor_code) AS doctor_name,
            dep.department_name
     FROM appointments a
     JOIN patients p ON p.patient_id = a.patient_id
     LEFT JOIN users pu ON pu.user_id = p.user_id
     JOIN doctors d ON d.doctor_id = a.doctor_id
     LEFT JOIN users du ON du.user_id = d.user_id
     JOIN departments dep ON dep.department_id = a.department_id
     WHERE a.appointment_date = :today
     ORDER BY a.appointment_time ASC
     LIMIT 100"
);
$stmt->execute(['today' => $today]);

$appointments = array_map(function (array $row): array {
    return [
        'appointment_id'   => (int) $row['appointment_id'],
        'time'             => substr($row['appointment_time'], 0, 5),
        'patient_name'     => $row['patient_name'],
        'doctor_name'      => $row['doctor_name'],
        'department_name'  => $row['department_name'],
        'type'             => $row['appointment_type'],
        'priority'         => $row['priority'],
        'status'           => $row['status'],
    ];
}, $stmt->fetchAll());

/* =========================================================
 * 5. CURRENT QUEUE SUMMARY (today's active tokens, all doctors)
 * ========================================================= */

$stmt = $db->prepare(
    "SELECT t.token_id, t.token_number, t.token_type, t.priority,
            COALESCE(qs.current_status, t.status) AS status,
            qs.queue_position, qs.estimated_wait_minutes,
            COALESCE(pu.full_name, CONCAT('Patient #', p.patient_id)) AS patient_name,
            COALESCE(du.full_name, d.doctor_code) AS doctor_name,
            dep.department_name
     FROM tokens t
     LEFT JOIN queue_status qs ON qs.token_id = t.token_id
     JOIN patients p ON p.patient_id = t.patient_id
     LEFT JOIN users pu ON pu.user_id = p.user_id
     JOIN doctors d ON d.doctor_id = t.doctor_id
     LEFT JOIN users du ON du.user_id = d.user_id
     JOIN departments dep ON dep.department_id = t.department_id
     WHERE t.token_date = :today
       AND COALESCE(qs.current_status, t.status) NOT IN ('completed', 'cancelled', 'no_show')
     ORDER BY dep.department_name, d.doctor_code,
              qs.queue_position IS NULL, qs.queue_position, t.token_number"
);
$stmt->execute(['today' => $today]);

$queue = array_map(function (array $row): array {
    return [
        'token_id'         => (int) $row['token_id'],
        'token_number'     => (int) $row['token_number'],
        'patient_name'     => $row['patient_name'],
        'doctor_name'      => $row['doctor_name'],
        'department_name'  => $row['department_name'],
        'type'             => $row['token_type'],
        'priority'         => $row['priority'],
        'status'           => $row['status'],
        'queue_position'   => $row['queue_position'] !== null ? (int) $row['queue_position'] : null,
        'eta_minutes'      => $row['estimated_wait_minutes'] !== null ? (int) $row['estimated_wait_minutes'] : null,
    ];
}, $stmt->fetchAll());

/* =========================================================
 * RESPONSE
 * ========================================================= */

Response::success([
    'date' => $today,

    'kpis' => [
        'patients_today'        => $patientsToday,
        'appointments_today'    => $appointmentsToday,
        'patients_served'       => $patientsServed,
        'currently_waiting'     => $currentlyWaiting,
        'currently_in_progress' => $currentlyInProgress,
        'avg_waiting_minutes'   => $avgWaitingMinutes,
        'no_show_count'         => $noShowCount,
        'no_show_rate'          => $noShowRate,
        'active_doctors'        => $activeDoctors,
        'total_doctors'         => $totalDoctors,
    ],

    'status_breakdown' => $statusBreakdown,
    'type_breakdown'   => $typeBreakdown,
    'hourly_load'      => $hourlyLoad,

    'appointments' => $appointments,
    'queue'        => $queue,

    'generated_at' => date('Y-m-d H:i:s'),
]);
