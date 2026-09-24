<?php

class Token
{
    /**
     * Creates a token with a unique, sequential token_number for the
     * given department + date. Uses a transaction with a row lock on
     * the max existing number, and the schema's UNIQUE KEY
     * (department_id, token_date, token_number) as a hard backstop
     * against duplicates from concurrent requests.
     */
    public static function create(
        int $departmentId,
        int $doctorId,
        int $patientId,
        ?int $appointmentId,
        string $date,
        string $type, // 'appointment' | 'walkin'
        string $priority = 'normal'
    ): array {
        $db = get_db_connection();

        $attempts = 0;
        while ($attempts < 5) {
            $attempts++;
            $db->beginTransaction();
            try {
                $lockStmt = $db->prepare(
                    'SELECT COALESCE(MAX(token_number), 0) AS max_number
                     FROM tokens
                     WHERE department_id = :department_id AND token_date = :date
                     FOR UPDATE'
                );
                $lockStmt->execute(['department_id' => $departmentId, 'date' => $date]);
                $nextNumber = (int) $lockStmt->fetch()['max_number'] + 1;

                $insert = $db->prepare(
                    'INSERT INTO tokens
                        (appointment_id, patient_id, doctor_id, department_id,
                         token_number, token_date, token_type, priority, status)
                     VALUES
                        (:appointment_id, :patient_id, :doctor_id, :department_id,
                         :token_number, :date, :type, :priority, :status)'
                );
                $insert->execute([
                    'appointment_id' => $appointmentId,
                    'patient_id'     => $patientId,
                    'doctor_id'      => $doctorId,
                    'department_id'  => $departmentId,
                    'token_number'   => $nextNumber,
                    'date'           => $date,
                    'type'           => $type,
                    'priority'       => $priority,
                    'status'         => QueueStateMachine::WAITING,
                ]);
                $tokenId = (int) $db->lastInsertId();

                $db->commit();

                return ['token_id' => $tokenId, 'token_number' => $nextNumber];
            } catch (PDOException $e) {
                $db->rollBack();
                // Duplicate key (race with another request) -> retry with a fresh number.
                if ($e->getCode() === '23000' && $attempts < 5) {
                    continue;
                }
                throw $e;
            }
        }

        throw new RuntimeException('Could not generate a unique token after several attempts.');
    }

    public static function findById(int $tokenId): ?array
    {
        $stmt = get_db_connection()->prepare('SELECT * FROM tokens WHERE token_id = :id');
        $stmt->execute(['id' => $tokenId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findByAppointmentId(int $appointmentId): ?array
    {
        $stmt = get_db_connection()->prepare('SELECT * FROM tokens WHERE appointment_id = :id');
        $stmt->execute(['id' => $appointmentId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function updateStatus(int $tokenId, string $status): void
    {
        $stmt = get_db_connection()->prepare('UPDATE tokens SET status = :status WHERE token_id = :id');
        $stmt->execute(['status' => $status, 'id' => $tokenId]);
    }

    public static function markCalled(int $tokenId): void
    {
        $stmt = get_db_connection()->prepare('UPDATE tokens SET called_at = NOW() WHERE token_id = :id');
        $stmt->execute(['id' => $tokenId]);
    }

    public static function markServed(int $tokenId): void
    {
        $stmt = get_db_connection()->prepare('UPDATE tokens SET served_at = NOW() WHERE token_id = :id');
        $stmt->execute(['id' => $tokenId]);
    }

    public static function markCancelled(int $tokenId): void
    {
        $stmt = get_db_connection()->prepare('UPDATE tokens SET cancelled_at = NOW() WHERE token_id = :id');
        $stmt->execute(['id' => $tokenId]);
    }

    /**
     * Full queue for a doctor on a date, in queue order, joined with
     * live status and the patient's display name. Used by
     * reception-view.php and by QueueOrdering/QueueEngine.
     */
    public static function listForDoctorQueue(int $doctorId, string $date): array
    {
        $stmt = get_db_connection()->prepare(
            'SELECT t.token_id, t.token_number, t.priority, t.token_type,
                    qs.current_status, qs.queue_position, qs.estimated_wait_minutes,
                    u.full_name AS patient_name
             FROM tokens t
             JOIN queue_status qs ON qs.token_id = t.token_id
             JOIN patients p ON p.patient_id = t.patient_id
             LEFT JOIN users u ON u.user_id = p.user_id
             WHERE t.doctor_id = :doctor_id AND t.token_date = :date
             ORDER BY qs.queue_position IS NULL, qs.queue_position, t.token_number'
        );
        $stmt->execute(['doctor_id' => $doctorId, 'date' => $date]);
        return $stmt->fetchAll();
    }

    /**
     * A doctor's own appointments across ALL dates (today, upcoming, past),
     * for the doctor Appointments tab. Sourced from tokens rather than the
     * appointments table alone, since walk-ins have no appointments row —
     * this way both appointment_type values ("appointment"/"walkin") are
     * covered by one list, matching what the doctor Appointments page
     * expects (appointment_date, appointment_time, patient_name,
     * appointment_type, reason, status).
     */
    public static function listForDoctorAllDates(int $doctorId): array
    {
        $stmt = get_db_connection()->prepare(
            "SELECT t.token_id,
                    t.token_date AS appointment_date,
                    COALESCE(a.appointment_time, TIME(t.created_at)) AS appointment_time,
                    u.full_name AS patient_name,
                    t.token_type AS appointment_type,
                    COALESCE(a.reason, '') AS reason,
                    qs.current_status AS status
             FROM tokens t
             JOIN patients p ON p.patient_id = t.patient_id
             LEFT JOIN users u ON u.user_id = p.user_id
             LEFT JOIN appointments a ON a.appointment_id = t.appointment_id
             LEFT JOIN queue_status qs ON qs.token_id = t.token_id
             WHERE t.doctor_id = :doctor_id
             ORDER BY t.token_date DESC, appointment_time DESC"
        );
        $stmt->execute(['doctor_id' => $doctorId]);
        return $stmt->fetchAll();
    }
}