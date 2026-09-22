<?php

class QueueStatus
{
    public static function createForToken(int $tokenId, int $queuePosition): void
    {
        $stmt = get_db_connection()->prepare(
            'INSERT INTO queue_status (token_id, current_status, queue_position)
             VALUES (:token_id, :status, :position)'
        );
        $stmt->execute([
            'token_id' => $tokenId,
            'status'   => QueueStateMachine::WAITING,
            'position' => $queuePosition,
        ]);
    }

    public static function findByTokenId(int $tokenId): ?array
    {
        $stmt = get_db_connection()->prepare('SELECT * FROM queue_status WHERE token_id = :token_id');
        $stmt->execute(['token_id' => $tokenId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Validates the transition against QueueStateMachine, then writes
     * the new status plus any timestamp columns relevant to it.
     */
    public static function transition(int $tokenId, string $newStatus): void
    {
        $current = self::findByTokenId($tokenId);
        if ($current === null) {
            throw new RuntimeException('No queue_status row for this token.');
        }

        QueueStateMachine::assertTransition($current['current_status'], $newStatus);

        $extraColumn = match ($newStatus) {
            QueueStateMachine::CHECKED_IN => 'checked_in_at',
            QueueStateMachine::CONSULTING => 'consultation_started_at',
            QueueStateMachine::COMPLETED  => 'consultation_completed_at',
            QueueStateMachine::NO_SHOW    => 'no_show_at',
            QueueStateMachine::LATE       => 'late_arrival_at',
            default                       => null,
        };

        $sql = 'UPDATE queue_status SET current_status = :status';
        $params = ['status' => $newStatus, 'token_id' => $tokenId];

        if ($extraColumn !== null) {
            $sql .= ", $extraColumn = NOW()";
        }
        if ($newStatus === QueueStateMachine::ARRIVING) {
            // arrived_at isn't a dedicated column in this schema; reuse
            // checked_in_at to mean "patient has signaled they're here/coming".
            $sql .= ', checked_in_at = COALESCE(checked_in_at, NOW())';
        }

        $sql .= ' WHERE token_id = :token_id';

        $stmt = get_db_connection()->prepare($sql);
        $stmt->execute($params);

        // Keep tokens.status in sync so both tables always agree.
        Token::updateStatus($tokenId, $newStatus);
    }

    public static function setPosition(int $tokenId, ?int $position): void
    {
        $stmt = get_db_connection()->prepare(
            'UPDATE queue_status SET queue_position = :position WHERE token_id = :token_id'
        );
        $stmt->execute(['position' => $position, 'token_id' => $tokenId]);
    }

    public static function setEstimatedWait(int $tokenId, int $minutes): void
    {
        $stmt = get_db_connection()->prepare(
            'UPDATE queue_status SET estimated_wait_minutes = :minutes WHERE token_id = :token_id'
        );
        $stmt->execute(['minutes' => $minutes, 'token_id' => $tokenId]);
    }

    /**
     * How many active (not completed/cancelled/no_show) tokens are
     * ahead of the given queue_position for this doctor+date. Used by
     * EtaCalculator's "patients ahead" input.
     */
    public static function countAhead(int $doctorId, string $date, int $queuePosition): int
    {
        $stmt = get_db_connection()->prepare(
            "SELECT COUNT(*) AS n
             FROM queue_status qs
             JOIN tokens t ON t.token_id = qs.token_id
             WHERE t.doctor_id = :doctor_id AND t.token_date = :date
               AND qs.queue_position < :position
               AND qs.current_status NOT IN ('completed', 'cancelled', 'no_show')"
        );
        $stmt->execute(['doctor_id' => $doctorId, 'date' => $date, 'position' => $queuePosition]);
        return (int) $stmt->fetch()['n'];
    }

    public static function currentlyConsulting(int $doctorId, string $date): ?array
    {
        $stmt = get_db_connection()->prepare(
            "SELECT qs.*, t.token_number
             FROM queue_status qs
             JOIN tokens t ON t.token_id = qs.token_id
             WHERE t.doctor_id = :doctor_id AND t.token_date = :date
               AND qs.current_status = 'consulting'
             LIMIT 1"
        );
        $stmt->execute(['doctor_id' => $doctorId, 'date' => $date]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function nextInLine(int $doctorId, string $date): ?array
    {
        $stmt = get_db_connection()->prepare(
            "SELECT qs.*, t.token_number
             FROM queue_status qs
             JOIN tokens t ON t.token_id = qs.token_id
             WHERE t.doctor_id = :doctor_id AND t.token_date = :date
               AND qs.current_status IN ('waiting', 'next', 'arriving', 'checked_in')
             ORDER BY qs.queue_position ASC
             LIMIT 1"
        );
        $stmt->execute(['doctor_id' => $doctorId, 'date' => $date]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Tokens whose grace period has expired while still NEXT/ARRIVING —
     * used by NoShowHandler's lazy sweep.
     */
    public static function pastGraceDeadline(string $now): array
    {
        // grace_deadline isn't a stored column in this schema; the sweep
        // instead compares (status became NEXT at) + grace period, which
        // NoShowHandler computes using queue_rules. This helper just
        // returns candidates currently in NEXT/ARRIVING for the caller
        // to check individually.
        $stmt = get_db_connection()->prepare(
            "SELECT qs.*, t.doctor_id, t.department_id, t.token_date
             FROM queue_status qs
             JOIN tokens t ON t.token_id = qs.token_id
             WHERE qs.current_status IN ('next', 'arriving')"
        );
        $stmt->execute();
        return $stmt->fetchAll();
    }
}