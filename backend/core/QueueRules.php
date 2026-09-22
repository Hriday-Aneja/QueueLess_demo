<?php

class QueueRules
{
    // Urgency ranking for the tokens.priority column. Lower = seen sooner.
    private const URGENCY_RANK = [
        'emergency' => 0,
        'priority'  => 1,
        'normal'    => 2,
    ];

    /**
     * Resolves the effective rule row for a doctor (department rule,
     * falling back to clinic rule, falling back to config defaults).
     */
    public static function forDoctor(int $doctorId): array
    {
        $doctor = Doctor::findById($doctorId);
        if ($doctor === null) {
            throw new RuntimeException('Unknown doctor.');
        }

        return QueueRule::forDepartment((int) $doctor['department_id'], (int) $doctor['clinic_id']);
    }

    public static function gracePeriodMinutes(int $doctorId): int
    {
        return (int) self::forDoctor($doctorId)['grace_period_minutes'];
    }

    public static function noShowAfterMinutes(int $doctorId): int
    {
        return (int) self::forDoctor($doctorId)['no_show_after_minutes'];
    }

    public static function lateArrivalRule(int $doctorId): string
    {
        return (string) self::forDoctor($doctorId)['late_arrival_rule'];
    }

    /**
     * The configured (staff-set) average consultation time, ignoring
     * any real historical data.
     */
    public static function configuredAvgConsultationMinutes(int $doctorId): int
    {
        return (int) self::forDoctor($doctorId)['average_consultation_minutes'];
    }

    /**
     * Prefers a real rolling average from completed consultations once
     * there's enough history, otherwise falls back to the
     * configured/default value. This is what EtaCalculator should be
     * fed for a realistic estimate.
     */
    public static function effectiveAvgConsultationMinutes(int $doctorId): int
    {
        $real = Consultation::averageMinutesForDoctor($doctorId);
        if ($real !== null && $real > 0) {
            return (int) round($real);
        }
        return self::configuredAvgConsultationMinutes($doctorId);
    }

    /**
     * Higher number = seen sooner. Comes from queue_rules'
     * appointment_priority / walkin_priority columns.
     */
    public static function typeWeight(array $rules, string $tokenType): int
    {
        return $tokenType === 'walkin'
            ? (int) $rules['walkin_priority']
            : (int) $rules['appointment_priority'];
    }

    /**
     * Lower number = seen sooner. Based on the tokens.priority column
     * ('emergency' | 'priority' | 'normal').
     */
    public static function urgencyRank(string $priority): int
    {
        return self::URGENCY_RANK[$priority] ?? self::URGENCY_RANK['normal'];
    }
}