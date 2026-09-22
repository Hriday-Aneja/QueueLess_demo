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
}