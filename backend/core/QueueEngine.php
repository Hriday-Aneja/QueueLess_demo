<?php

class QueueEngine
{
    // ---- Booking / token creation -----------------------------------

    public static function bookAppointment(int $patientId, int $doctorId, int $departmentId, string $date, string $time, string $priority = 'normal', ?string $reason = null): array
    {
        $appointmentId = Appointment::create($patientId, $doctorId, $departmentId, $date, $time, $priority, $reason);
        return TokenGenerator::forAppointment($appointmentId) + ['appointment_id' => $appointmentId];
    }

    public static function createWalkIn(int $doctorId, string $patientName, ?string $patientPhone, string $priority = 'normal'): array
    {
        $patientId = Patient::createWalkIn($patientName, $patientPhone);
        return TokenGenerator::forWalkIn($doctorId, $patientId, $priority);
    }

    // ---- Status / queue reads -----------------------------------------

    public static function getStatus(int $tokenId): array
    {
        $token = self::requireToken($tokenId);
        $doctorId = (int) $token['doctor_id'];
        $date = $token['token_date'];

        self::sweepAndPromote($doctorId, $date);

        $status = QueueStatus::findByTokenId($tokenId);
        $consulting = QueueStatus::currentlyConsulting($doctorId, $date);
        $patientsAhead = QueueStatus::countAhead($doctorId, $date, (int) $status['queue_position']);
        $avgMinutes = QueueRules::effectiveAvgConsultationMinutes($doctorId);
        $waitMinutes = EtaCalculator::estimateWaitMinutes($patientsAhead, $avgMinutes);

        return [
            'my_token'               => (int) $token['token_number'],
            'current_token'          => $consulting['token_number'] ?? null,
            'status'                 => $status['current_status'],
            'patients_ahead'         => $patientsAhead,
            'estimated_wait_minutes' => $waitMinutes,
        ];
    }

    public static function receptionView(int $doctorId, string $date): array
    {
        self::sweepAndPromote($doctorId, $date);
        return ['queue' => Token::listForDoctorQueue($doctorId, $date)];
    }

    // ---- Patient-facing actions -----------------------------------------

    public static function onMyWay(int $tokenId): array
    {
        QueueStatus::transition($tokenId, QueueStateMachine::ARRIVING);
        return ['status' => QueueStateMachine::ARRIVING];
    }

    public static function cancel(int $tokenId): array
    {
        $token = self::requireToken($tokenId);

        QueueStatus::transition($tokenId, QueueStateMachine::CANCELLED);
        Token::markCancelled($tokenId);

        if (!empty($token['appointment_id'])) {
            Appointment::cancel((int) $token['appointment_id']);
        }

        QueueEvents::afterCancellation((int) $token['doctor_id'], $token['token_date']);

        return ['status' => QueueStateMachine::CANCELLED];
    }

    // ---- Reception-facing actions -----------------------------------------

    public static function checkIn(int $tokenId): array
    {
        QueueStatus::transition($tokenId, QueueStateMachine::CHECKED_IN);
        return ['status' => QueueStateMachine::CHECKED_IN];
    }

    public static function markNoShow(int $tokenId): array
    {
        $token = self::requireToken($tokenId);
        QueueStatus::transition($tokenId, QueueStateMachine::NO_SHOW);
        QueueEvents::afterNoShow((int) $token['doctor_id'], $token['token_date']);
        return ['status' => QueueStateMachine::NO_SHOW];
    }

    public static function markLateArrival(int $tokenId): array
    {
        LateArrivalHandler::markLate($tokenId);
        return ['status' => QueueStateMachine::LATE];
    }

    public static function requeue(int $tokenId): array
    {
        return LateArrivalHandler::requeue($tokenId);
    }

    /**
     * Moves a token from NEXT/ARRIVING/CHECKED_IN into CONSULTING.
     * Guards against two consultations running at once for the same
     * doctor+date. Used both for the first patient of the day and
     * internally by completeConsultation() to auto-start the next one.
     */
    public static function startConsultation(int $tokenId): array
    {
        $token = self::requireToken($tokenId);
        $doctorId = (int) $token['doctor_id'];
        $date = $token['token_date'];

        $alreadyConsulting = QueueStatus::currentlyConsulting($doctorId, $date);
        if ($alreadyConsulting !== null && (int) $alreadyConsulting['token_id'] !== $tokenId) {
            throw new RuntimeException('Another consultation is already in progress for this doctor.');
        }

        QueueStatus::transition($tokenId, QueueStateMachine::CONSULTING);
        Consultation::start($tokenId, $doctorId, (int) $token['patient_id']);
        Token::markCalled($tokenId);

        return ['status' => QueueStateMachine::CONSULTING];
    }

    /**
     * Completes the current consultation and, per spec, immediately
     * promotes the patient who was NEXT into CONSULTING, then promotes
     * a new NEXT from the remaining queue.
     */
    public static function completeConsultation(int $tokenId): array
    {
        $token = self::requireToken($tokenId);
        $doctorId = (int) $token['doctor_id'];
        $date = $token['token_date'];

        QueueStatus::transition($tokenId, QueueStateMachine::COMPLETED);
        Consultation::completeByTokenId($tokenId);
        Token::markServed($tokenId);

        if (!empty($token['appointment_id'])) {
            Appointment::markCompleted((int) $token['appointment_id']);
        }

        QueueEvents::afterCompletion($doctorId, $date);

        $nowConsulting = null;
        $candidate = self::findByStatus($doctorId, $date, QueueStateMachine::NEXT);
        if ($candidate !== null) {
            self::startConsultation((int) $candidate['token_id']);
            $nowConsulting = (int) $candidate['token_number'];
        }

        QueueOrdering::promoteNextIfNeeded($doctorId, $date);
        $newNext = self::findByStatus($doctorId, $date, QueueStateMachine::NEXT);

        return [
            'completed_token' => (int) $token['token_number'],
            'now_consulting'  => $nowConsulting,
            'now_next'        => $newNext['token_number'] ?? null,
        ];
    }

    // ---- Internal helpers -----------------------------------------

    private static function sweepAndPromote(int $doctorId, string $date): void
    {
        NoShowHandler::sweep($doctorId, $date);
        QueueOrdering::promoteNextIfNeeded($doctorId, $date);
    }

    private static function requireToken(int $tokenId): array
    {
        $token = Token::findById($tokenId);
        if ($token === null) {
            throw new RuntimeException('Unknown token.');
        }
        return $token;
    }

    private static function findByStatus(int $doctorId, string $date, string $status): ?array
    {
        foreach (Token::listForDoctorQueue($doctorId, $date) as $row) {
            if ($row['current_status'] === $status) {
                return $row;
            }
        }
        return null;
    }
}