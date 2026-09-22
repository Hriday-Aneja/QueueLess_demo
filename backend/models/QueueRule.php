<?php

class QueueRule
{
    private const DEFAULTS = [
        'grace_period_minutes'          => DEFAULT_GRACE_PERIOD_MINUTES,
        'average_consultation_minutes'  => DEFAULT_AVG_CONSULTATION_MINUTES,
        'appointment_priority'          => 10,
        'walkin_priority'               => 5,
        'no_show_after_minutes'         => 15,
        'late_arrival_rule'             => 'requeue',
    ];

    /**
     * Resolves the effective rule set for a department: a
     * department-specific rule row wins, then a clinic-wide rule row,
     * then the hard-coded config defaults. Staff configure these rows;
     * the Queue Engine only ever reads and executes them.
     */
    public static function forDepartment(int $departmentId, int $clinicId): array
    {
        $db = get_db_connection();

        $deptStmt = $db->prepare(
            'SELECT * FROM queue_rules WHERE department_id = :department_id AND is_active = TRUE LIMIT 1'
        );
        $deptStmt->execute(['department_id' => $departmentId]);
        $rule = $deptStmt->fetch();
        if ($rule) {
            return $rule;
        }

        $clinicStmt = $db->prepare(
            'SELECT * FROM queue_rules WHERE clinic_id = :clinic_id AND department_id IS NULL AND is_active = TRUE LIMIT 1'
        );
        $clinicStmt->execute(['clinic_id' => $clinicId]);
        $rule = $clinicStmt->fetch();
        if ($rule) {
            return $rule;
        }

        return self::DEFAULTS;
    }

    public static function upsert(?int $clinicId, ?int $departmentId, array $data): void
    {
        $db = get_db_connection();

        $existing = null;
        if ($departmentId !== null) {
            $stmt = $db->prepare('SELECT rule_id FROM queue_rules WHERE department_id = :department_id');
            $stmt->execute(['department_id' => $departmentId]);
            $existing = $stmt->fetch();
        } elseif ($clinicId !== null) {
            $stmt = $db->prepare('SELECT rule_id FROM queue_rules WHERE clinic_id = :clinic_id AND department_id IS NULL');
            $stmt->execute(['clinic_id' => $clinicId]);
            $existing = $stmt->fetch();
        }

        $fields = array_merge(self::DEFAULTS, $data);

        if ($existing) {
            $stmt = $db->prepare(
                'UPDATE queue_rules SET
                    grace_period_minutes = :grace_period_minutes,
                    average_consultation_minutes = :average_consultation_minutes,
                    appointment_priority = :appointment_priority,
                    walkin_priority = :walkin_priority,
                    no_show_after_minutes = :no_show_after_minutes,
                    late_arrival_rule = :late_arrival_rule
                 WHERE rule_id = :rule_id'
            );
            $fields['rule_id'] = $existing['rule_id'];
            $stmt->execute($fields);
            return;
        }

        $stmt = $db->prepare(
            'INSERT INTO queue_rules
                (clinic_id, department_id, grace_period_minutes, average_consultation_minutes,
                 appointment_priority, walkin_priority, no_show_after_minutes, late_arrival_rule)
             VALUES
                (:clinic_id, :department_id, :grace_period_minutes, :average_consultation_minutes,
                 :appointment_priority, :walkin_priority, :no_show_after_minutes, :late_arrival_rule)'
        );
        $fields['clinic_id'] = $clinicId;
        $fields['department_id'] = $departmentId;
        $stmt->execute($fields);
    }
}