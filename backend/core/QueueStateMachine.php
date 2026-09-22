<?php
/**
 * Location: backend/core/QueueStateMachine.php
 *
 * Defines every valid queue status and which transitions between
 * statuses are allowed. This file has no database calls — it is
 * pure logic, so QueueEngine.php and NoShowHandler.php etc. can all
 * ask it "is this transition allowed?" before writing anything.
 *
 * States:
 *   WAITING    → patient is in the queue, not yet next
 *   NEXT       → patient is next to be consulted
 *   ARRIVING   → patient tapped "I'm on my way"
 *   CHECKED_IN → reception has checked the patient in physically
 *   CONSULTING → patient is currently with the doctor
 *   COMPLETED  → consultation finished
 *   CANCELLED  → appointment/token cancelled
 *   NO_SHOW    → patient did not arrive within the grace period
 *   LATE       → patient arrived after their turn was given up
 *   REQUEUE    → a late/no-show patient has been placed back in the queue
 */

class QueueStateMachine
{
    public const WAITING    = 'waiting';
    public const NEXT       = 'next';
    public const ARRIVING   = 'arriving';
    public const CHECKED_IN = 'checked_in';
    public const CONSULTING = 'consulting';
    public const COMPLETED  = 'completed';
    public const CANCELLED  = 'cancelled';
    public const NO_SHOW    = 'no_show';
    public const LATE       = 'late';
    public const REQUEUE    = 'requeue';

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