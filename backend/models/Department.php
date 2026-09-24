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

    /* ---------------------------------------------------------
     * Admin management (Phase 3.1) — additive only, nothing above
     * this line changes so Doctor management / booking keep
     * working exactly as before (they only ever see active
     * departments via listByClinic()).
     * --------------------------------------------------------- */

    /** All departments for a clinic, active and inactive, for the admin table. */
    public static function listAllByClinicForAdmin(int $clinicId): array
    {
        $stmt = get_db_connection()->prepare(
            'SELECT department_id, clinic_id, department_name, description, is_active
             FROM departments WHERE clinic_id = :clinic_id
             ORDER BY department_name'
        );
        $stmt->execute(['clinic_id' => $clinicId]);
        return $stmt->fetchAll();
    }

    public static function nameExistsInClinic(int $clinicId, string $name, ?int $excludeDepartmentId = null): bool
    {
        $sql = 'SELECT department_id FROM departments WHERE clinic_id = :clinic_id AND department_name = :name';
        $params = ['clinic_id' => $clinicId, 'name' => $name];
        if ($excludeDepartmentId !== null) {
            $sql .= ' AND department_id != :exclude_id';
            $params['exclude_id'] = $excludeDepartmentId;
        }
        $stmt = get_db_connection()->prepare($sql);
        $stmt->execute($params);
        return (bool) $stmt->fetch();
    }

    public static function create(int $clinicId, string $name, ?string $description, bool $isActive): int
    {
        $stmt = get_db_connection()->prepare(
            'INSERT INTO departments (clinic_id, department_name, description, is_active)
             VALUES (:clinic_id, :name, :description, :is_active)'
        );
        $stmt->execute([
            'clinic_id'   => $clinicId,
            'name'        => $name,
            'description' => $description,
            'is_active'   => $isActive ? 1 : 0,
        ]);
        return (int) get_db_connection()->lastInsertId();
    }

    public static function update(int $departmentId, string $name, ?string $description, bool $isActive): void
    {
        $stmt = get_db_connection()->prepare(
            'UPDATE departments SET department_name = :name, description = :description, is_active = :is_active
             WHERE department_id = :id'
        );
        $stmt->execute([
            'name'        => $name,
            'description' => $description,
            'is_active'   => $isActive ? 1 : 0,
            'id'          => $departmentId,
        ]);
    }
}