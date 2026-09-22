<?php


class QueueStateMachine
{
    public const WAITING    = 'WAITING';
    public const NEXT       = 'NEXT';
    public const ARRIVING   = 'ARRIVING';
    public const CHECKED_IN = 'CHECKED_IN';
    public const CONSULTING = 'CONSULTING';
    public const COMPLETED  = 'COMPLETED';
    public const CANCELLED  = 'CANCELLED';
    public const NO_SHOW    = 'NO_SHOW';
    public const LATE       = 'LATE';
    public const REQUEUE    = 'REQUEUE';

    public const ALL_STATES = [
        self::WAITING, self::NEXT, self::ARRIVING, self::CHECKED_IN,
        self::CONSULTING, self::COMPLETED, self::CANCELLED,
        self::NO_SHOW, self::LATE, self::REQUEUE,
    ];

    /**
     * Map of current state => list of states it may move to.
     * Anything not listed here is not a valid transition.
     */
    private const TRANSITIONS = [
        self::WAITING    => [self::NEXT, self::ARRIVING, self::CANCELLED],
        self::NEXT       => [self::ARRIVING, self::CHECKED_IN, self::CONSULTING, self::NO_SHOW, self::CANCELLED],
        self::ARRIVING   => [self::CHECKED_IN, self::NEXT, self::CONSULTING, self::NO_SHOW, self::CANCELLED],
        self::CHECKED_IN => [self::CONSULTING, self::CANCELLED],
        self::CONSULTING => [self::COMPLETED],
        self::NO_SHOW    => [self::LATE, self::REQUEUE],
        self::LATE       => [self::REQUEUE, self::CANCELLED],
        self::REQUEUE    => [self::WAITING, self::NEXT],
        // Terminal states: no transitions out.
        self::COMPLETED  => [],
        self::CANCELLED  => [],
    ];

    public static function isValidState(string $state): bool
    {
        return in_array($state, self::ALL_STATES, true);
    }

    /**
     * Whether moving from $from to $to is an allowed transition.
     */
    public static function canTransition(string $from, string $to): bool
    {
        if (!self::isValidState($from) || !self::isValidState($to)) {
            return false;
        }

        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }

    /**
     * Throws if the transition is not allowed. Call this from
     * QueueEngine.php / models before writing a new status.
     *
     * @throws InvalidArgumentException
     */
    public static function assertTransition(string $from, string $to): void
    {
        if (!self::canTransition($from, $to)) {
            throw new InvalidArgumentException("Invalid queue status transition: $from -> $to");
        }
    }

    public static function isTerminal(string $state): bool
    {
        return self::isValidState($state) && empty(self::TRANSITIONS[$state]);
    }
}