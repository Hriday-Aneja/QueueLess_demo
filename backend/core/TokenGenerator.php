<?php

class TokenGenerator
{
    public static function forAppointment(int $appointmentId): array
    {
        $appointment = Appointment::findById($appointmentId);
        if ($appointment === null) {
            throw new RuntimeException('Unknown appointment.');
        }

        return self::generate(
            (int) $appointment['doctor_id'],
            (int) $appointment['department_id'],
            (int) $appointment['patient_id'],
            $appointmentId,
            $appointment['appointment_date'],
            'appointment',
            $appointment['priority']
        );
    }

    public static function forWalkIn(int $doctorId, int $patientId, string $priority = 'normal'): array
    {
        $doctor = Doctor::findById($doctorId);
        if ($doctor === null) {
            throw new RuntimeException('Unknown doctor.');
        }

        return self::generate(
            $doctorId,
            (int) $doctor['department_id'],
            $patientId,
            null,
            date('Y-m-d'),
            'walkin',
            $priority
        );
    }

    private static function generate(
        int $doctorId,
        int $departmentId,
        int $patientId,
        ?int $appointmentId,
        string $date,
        string $type,
        string $priority
    ): array {
        $created = Token::create($departmentId, $doctorId, $patientId, $appointmentId, $date, $type, $priority);
        $tokenId = $created['token_id'];

        // Position is set properly by the recalculate() call right after;
        // 0 here is just a placeholder to satisfy the NOT NULL-ish intent.
        QueueStatus::createForToken($tokenId, 0);

        QueueEvents::afterTokenCreated($doctorId, $date);

        $status = QueueStatus::findByTokenId($tokenId);
        $patientsAhead = QueueStatus::countAhead($doctorId, $date, (int) $status['queue_position']);
        $avgMinutes = QueueRules::effectiveAvgConsultationMinutes($doctorId);
        $eta = EtaCalculator::estimateWaitBreakdown($patientsAhead, $avgMinutes);

        QueueStatus::setEstimatedWait($tokenId, $eta['estimated_wait_minutes']);

        return [
            'token_id'      => $tokenId,
            'token_number'  => $created['token_number'],
            'status'        => $status['current_status'],
            'queue_position' => (int) $status['queue_position'],
        ] + $eta;
    }
}