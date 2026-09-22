<?php

class QueueEvents
{
    public static function afterTokenCreated(int $doctorId, string $date): void
    {
        self::recalcAndPromote($doctorId, $date);
    }

    public static function afterCancellation(int $doctorId, string $date): void
    {
        self::recalcAndPromote($doctorId, $date);
    }

    public static function afterNoShow(int $doctorId, string $date): void
    {
        self::recalcAndPromote($doctorId, $date);
    }

    public static function afterCompletion(int $doctorId, string $date): void
    {
        self::recalcAndPromote($doctorId, $date);
    }

    /**
     * A requeued (late-arrival) token is pushed to the back of the
     * queue instead of resuming its original arrival-order position.
     */
    public static function afterRequeue(int $doctorId, string $date, int $tokenId): void
    {
        QueueOrdering::recalculate($doctorId, $date, [$tokenId]);
        QueueOrdering::promoteNextIfNeeded($doctorId, $date);
    }

    private static function recalcAndPromote(int $doctorId, string $date): void
    {
        QueueOrdering::recalculate($doctorId, $date);
        QueueOrdering::promoteNextIfNeeded($doctorId, $date);
    }
}