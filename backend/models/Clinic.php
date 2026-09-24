<?php

class Clinic
{
    public static function searchNearby(?float $latitude, ?float $longitude, ?string $search): array
    {
        $params = [];
        $where = ['c.is_active = TRUE'];

        if ($latitude !== null && $longitude !== null) {
            $distanceSelect = '(6371 * ACOS(LEAST(1, GREATEST(-1,
                COS(RADIANS(:latitude_cos)) * COS(RADIANS(c.latitude)) *
                COS(RADIANS(c.longitude) - RADIANS(:longitude)) +
                SIN(RADIANS(:latitude_sin)) * SIN(RADIANS(c.latitude))
            )))) AS distance_km';
            $where[] = 'c.latitude IS NOT NULL AND c.longitude IS NOT NULL';
            $orderBy = 'distance_km ASC, c.clinic_name ASC';
            $params['latitude_cos'] = $latitude;
            $params['latitude_sin'] = $latitude;
            $params['longitude'] = $longitude;
        } else {
            $distanceSelect = 'NULL AS distance_km';
            $orderBy = 'c.clinic_name ASC';
        }

        if ($search !== null && $search !== '') {
            $where[] = 'CONCAT_WS(\' \', c.clinic_name, c.address) LIKE :search';
            $params['search'] = '%' . $search . '%';
        }

        $sql = 'SELECT c.clinic_id, c.clinic_name, c.address, c.phone,
                       c.latitude, c.longitude,
                       ' . $distanceSelect . ',
                       GROUP_CONCAT(DISTINCT dep.department_name ORDER BY dep.department_name SEPARATOR \', \') AS departments,
                       COUNT(DISTINCT d.doctor_id) AS doctor_count,
                       COUNT(DISTINCT CASE WHEN qs.current_status IN (\'waiting\', \'next\', \'arriving\', \'checked_in\', \'consulting\', \'late\', \'requeue\') THEN t.token_id END) AS waiting_count,
                       COALESCE(MAX(CASE WHEN qs.current_status IN (\'waiting\', \'next\', \'arriving\', \'checked_in\', \'consulting\', \'late\', \'requeue\') THEN qs.estimated_wait_minutes ELSE 0 END), 0) AS estimated_wait_minutes,
                       CASE
                           WHEN SUM(CASE WHEN qs.current_status = \'consulting\' THEN 1 ELSE 0 END) > 0 THEN \'consulting\'
                           WHEN SUM(CASE WHEN qs.current_status = \'next\' THEN 1 ELSE 0 END) > 0 THEN \'next\'
                           WHEN SUM(CASE WHEN qs.current_status IN (\'waiting\', \'arriving\', \'checked_in\', \'late\', \'requeue\') THEN 1 ELSE 0 END) > 0 THEN \'waiting\'
                           ELSE \'idle\'
                       END AS current_queue_status
                FROM clinics c
                LEFT JOIN departments dep ON dep.clinic_id = c.clinic_id AND dep.is_active = TRUE
                LEFT JOIN doctors d ON d.department_id = dep.department_id AND d.is_active = TRUE
                LEFT JOIN tokens t ON t.department_id = dep.department_id AND t.token_date = CURDATE()
                LEFT JOIN queue_status qs ON qs.token_id = t.token_id
                WHERE ' . implode(' AND ', $where) . '
                GROUP BY c.clinic_id, c.clinic_name, c.address, c.phone, c.latitude, c.longitude
                ORDER BY ' . $orderBy;

        $stmt = get_db_connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

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