<?php

class QueueOrdering
{
    /**
     * Recomputes queue_position for every active (non-terminal) token
     * of a doctor on a date, ordered by: urgency (emergency first),
     * then token-type weight (from queue_rules), then arrival order
     * (token_number). Call this after any event that changes the
     * queue: new token, cancellation, no-show, requeue, completion.
     */
    public static function recalculate(int $doctorId, string $date, array $pushToEndTokenIds = []): void
    {
        $rules = QueueRules::forDoctor($doctorId);
        $tokens = self::activeTokens($doctorId, $date);

        usort($tokens, function ($a, $b) use ($rules, $pushToEndTokenIds) {
            $aPushed = in_array((int) $a['token_id'], $pushToEndTokenIds, true);
            $bPushed = in_array((int) $b['token_id'], $pushToEndTokenIds, true);

            if ($aPushed !== $bPushed) {
                return $aPushed ? 1 : -1; // pushed tokens always sort after everyone else
            }

            $urgencyDiff = QueueRules::urgencyRank($a['priority']) <=> QueueRules::urgencyRank($b['priority']);
            if ($urgencyDiff !== 0) {
                return $urgencyDiff;
            }

            $weightDiff = QueueRules::typeWeight($rules, $b['token_type']) <=> QueueRules::typeWeight($rules, $a['token_type']);
            if ($weightDiff !== 0) {
                return $weightDiff;
            }

            return $a['token_number'] <=> $b['token_number'];
        });

        $position = 1;
        foreach ($tokens as $token) {
            QueueStatus::setPosition((int) $token['token_id'], $position);
            $position++;
        }
    }

    /**
     * If nobody is currently CONSULTING and nobody is currently NEXT,
     * promotes the token at position 1 to NEXT. Call this right after
     * recalculate() so the queue always has a clear "up next" patient.
     */
    public static function promoteNextIfNeeded(int $doctorId, string $date): void
    {
        if (QueueStatus::currentlyConsulting($doctorId, $date) !== null) {
            return;
        }

        $tokens = self::activeTokens($doctorId, $date);
        foreach ($tokens as $token) {
            if ($token['current_status'] === QueueStateMachine::NEXT) {
                return; // someone is already NEXT
            }
        }

        $candidate = QueueStatus::nextInLine($doctorId, $date);
        if ($candidate !== null && QueueStateMachine::canTransition($candidate['current_status'], QueueStateMachine::NEXT)) {
            QueueStatus::transition((int) $candidate['token_id'], QueueStateMachine::NEXT);
        }
    }

    /**
     * Active tokens (not completed/cancelled/no_show) for a doctor+date,
     * with the fields ordering needs: priority, token_type, token_number.
     */
    private static function activeTokens(int $doctorId, string $date): array
    {
        $stmt = get_db_connection()->prepare(
            "SELECT t.token_id, t.token_number, t.priority, t.token_type, qs.current_status
             FROM tokens t
             JOIN queue_status qs ON qs.token_id = t.token_id
             WHERE t.doctor_id = :doctor_id AND t.token_date = :date
               AND qs.current_status NOT IN ('completed', 'cancelled', 'no_show')"
        );
        $stmt->execute(['doctor_id' => $doctorId, 'date' => $date]);
        return $stmt->fetchAll();
    }
}