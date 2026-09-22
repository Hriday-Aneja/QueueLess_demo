<?php

class Appointment
{
    public static function create(int $patientId, int $doctorId, int $departmentId, string $date, string $time, string $priority = 'normal', ?string $reason = null): int
    {
        $stmt = get_db_connection()->prepare(
            "INSERT INTO appointments
                (patient_id, doctor_id, department_id, appointment_date, appointment_time,
                 appointment_type, priority, status, reason)
             VALUES
                (:patient_id, :doctor_id, :department_id, :date, :time,
                 'appointment', :priority, 'scheduled', :reason)"
        );
        $stmt->execute([
            'patient_id'    => $patientId,
            'doctor_id'     => $doctorId,
            'department_id' => $departmentId,
            'date'          => $date,
            'time'          => $time,
            'priority'      => $priority,
            'reason'        => $reason,
        ]);
        return (int) get_db_connection()->lastInsertId();
    }

    public static function findById(int $appointmentId): ?array
    {
        $stmt = get_db_connection()->prepare('SELECT * FROM appointments WHERE appointment_id = :id');
        $stmt->execute(['id' => $appointmentId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function cancel(int $appointmentId): bool
    {
        $stmt = get_db_connection()->prepare(
            "UPDATE appointments SET status = 'cancelled', cancelled_at = NOW()
             WHERE appointment_id = :id AND status != 'cancelled'"
        );
        $stmt->execute(['id' => $appointmentId]);
        return $stmt->rowCount() > 0;
    }

    public static function markCompleted(int $appointmentId): void
    {
        $stmt = get_db_connection()->prepare(
            "UPDATE appointments SET status = 'completed', completed_at = NOW() WHERE appointment_id = :id"
        );
        $stmt->execute(['id' => $appointmentId]);
    }

    public static function listForPatient(int $patientId): array
    {
        $stmt = get_db_connection()->prepare(
            'SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.status,
                    d.doctor_code, dep.department_name
             FROM appointments a
             JOIN doctors d ON d.doctor_id = a.doctor_id
             JOIN departments dep ON dep.department_id = a.department_id
             WHERE a.patient_id = :patient_id
             ORDER BY a.appointment_date DESC, a.appointment_time DESC'
        );
        $stmt->execute(['patient_id' => $patientId]);
        return $stmt->fetchAll();
    }
}