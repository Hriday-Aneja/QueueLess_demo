<?php

class NoShowHandler
{
    /**
     * Lazy sweep: no cron is required for the MVP. queue/status.php and
     * reception-view.php both call this before reading the queue, so
     * grace-period expiry is always caught on the next request that
     * touches this doctor's queue. cron/sweep_grace_periods.php can
     * call this too for doctors nobody is actively polling.
     *
     * NOTE: this schema has no dedicated "became NEXT at" column, so
     * queue_status.updated_at is used as an approximation of when the
     * token entered its current status. In practice it holds because a
     * NEXT/ARRIVING token's row isn't touched again until its next
     * transition. A future schema revision could add a proper
     * grace_deadline column for precision.
     */
    public static function sweep(int $doctorId, string $date): void
    {
        $graceMinutes = QueueRules::gracePeriodMinutes($doctorId);
        $changed = false;

        foreach (self::candidates($doctorId, $date) as $candidate) {
            $becameCurrentAt = strtotime($candidate['updated_at']);
            $deadline = $becameCurrentAt + ($graceMinutes * 60);

            if (time() >= $deadline) {
                QueueStatus::transition((int) $candidate['token_id'], QueueStateMachine::NO_SHOW);
                $changed = true;
            }
        }

        if ($changed) {
            QueueEvents::afterNoShow($doctorId, $date);
        }
    }

    private static function candidates(int $doctorId, string $date): array
    {
        $all = QueueStatus::pastGraceDeadline(date('Y-m-d H:i:s'));

        return array_filter($all, function ($row) use ($doctorId, $date) {
            return (int) $row['doctor_id'] === $doctorId && $row['token_date'] === $date;
        });
    }
}