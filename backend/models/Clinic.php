<?php

class Clinic
{
    public static function listActive(): array
    {
        $stmt = get_db_connection()->query(
            'SELECT clinic_id, clinic_name, address, phone
             FROM clinics WHERE is_active = TRUE ORDER BY clinic_name'
        );
        return $stmt->fetchAll();
    }

    public static function findById(int $clinicId): ?array
    {
        $stmt = get_db_connection()->prepare('SELECT * FROM clinics WHERE clinic_id = :id');
        $stmt->execute(['id' => $clinicId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /* ---------------------------------------------------------
     * Admin management (Phase 3) — additive only, nothing above
     * this line is changed so patient booking keeps working as-is.
     * --------------------------------------------------------- */

    /** All clinics, active and inactive, for the admin management table. */
    public static function listAllForAdmin(): array
    {
        $stmt = get_db_connection()->query(
            'SELECT clinic_id, clinic_name, address, phone, is_active, created_at
             FROM clinics ORDER BY clinic_name'
        );
        return $stmt->fetchAll();
    }

    public static function nameExists(string $name, ?int $excludeClinicId = null): bool
    {
        $sql = 'SELECT clinic_id FROM clinics WHERE clinic_name = :name';
        $params = ['name' => $name];
        if ($excludeClinicId !== null) {
            $sql .= ' AND clinic_id != :exclude_id';
            $params['exclude_id'] = $excludeClinicId;
        }
        $stmt = get_db_connection()->prepare($sql);
        $stmt->execute($params);
        return (bool) $stmt->fetch();
    }

    public static function create(string $name, ?string $address, ?string $phone, bool $isActive): int
    {
        $stmt = get_db_connection()->prepare(
            'INSERT INTO clinics (clinic_name, address, phone, is_active)
             VALUES (:name, :address, :phone, :is_active)'
        );
        $stmt->execute([
            'name'      => $name,
            'address'   => $address,
            'phone'     => $phone,
            'is_active' => $isActive ? 1 : 0,
        ]);
        return (int) get_db_connection()->lastInsertId();
    }

    public static function update(int $clinicId, string $name, ?string $address, ?string $phone, bool $isActive): void
    {
        $stmt = get_db_connection()->prepare(
            'UPDATE clinics
             SET clinic_name = :name, address = :address, phone = :phone, is_active = :is_active
             WHERE clinic_id = :id'
        );
        $stmt->execute([
            'name'      => $name,
            'address'   => $address,
            'phone'     => $phone,
            'is_active' => $isActive ? 1 : 0,
            'id'        => $clinicId,
        ]);
    }
}