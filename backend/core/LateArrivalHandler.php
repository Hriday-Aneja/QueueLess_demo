<?php

class LateArrivalHandler
{
    /**
     * Reception marks a NO_SHOW patient as having arrived late. Does
     * NOT touch the queue order yet — the doctor keeps consulting
     * whoever they're with. Call requeue() separately to place the
     * patient back in line.
     */
    public static function markLate(int $tokenId): void
    {
        QueueStatus::transition($tokenId, QueueStateMachine::LATE);
    }

    /**
     * Places a LATE patient back into the active queue. Per the
     * configured late_arrival_rule, the MVP always sends them to the
     * back of the queue rather than restoring their original arrival
     * order — this never interrupts whoever is currently CONSULTING.
     */
    public static function requeue(int $tokenId): array
    {
        $token = Token::findById($tokenId);
        if ($token === null) {
            throw new RuntimeException('Unknown token.');
        }

        $status = QueueStatus::findByTokenId($tokenId);
        if ($status === null || $status['current_status'] !== QueueStateMachine::LATE) {
            throw new RuntimeException('Token is not in LATE status.');
        }

        QueueStatus::transition($tokenId, QueueStateMachine::REQUEUE);
        QueueStatus::transition($tokenId, QueueStateMachine::WAITING);

        $doctorId = (int) $token['doctor_id'];
        $date = $token['token_date'];

        QueueEvents::afterRequeue($doctorId, $date, $tokenId);

        $updated = QueueStatus::findByTokenId($tokenId);

        return [
            'status'         => $updated['current_status'],
            'queue_position' => (int) $updated['queue_position'],
        ];
    }
}