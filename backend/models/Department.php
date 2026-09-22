<?php

class Department
{
    public static function listByClinic(int $clinicId): array
    {
        $stmt = get_db_connection()->prepare(
            'SELECT department_id, clinic_id, department_name, description
             FROM departments WHERE clinic_id = :clinic_id AND is_active = TRUE
             ORDER BY department_name'
        );
        $stmt->execute(['clinic_id' => $clinicId]);
        return $stmt->fetchAll();
    }

    public static function findById(int $departmentId): ?array
    {
        $stmt = get_db_connection()->prepare('SELECT * FROM departments WHERE department_id = :id');
        $stmt->execute(['id' => $departmentId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
}