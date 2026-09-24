<?php

class Doctor
{
    public static function findById(int $doctorId): ?array
    {
        $stmt = get_db_connection()->prepare(
            'SELECT d.*, dep.department_name, dep.clinic_id
             FROM doctors d
             JOIN departments dep ON dep.department_id = d.department_id
             WHERE d.doctor_id = :id'
        );
        $stmt->execute(['id' => $doctorId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function listByClinic(int $clinicId): array
    {
        $stmt = get_db_connection()->prepare(
            'SELECT d.doctor_id, d.doctor_code, d.specialization, d.consultation_fee,
                    d.department_id, dep.department_name, u.full_name AS doctor_name
             FROM doctors d
             JOIN departments dep ON dep.department_id = d.department_id
             LEFT JOIN users u ON u.user_id = d.user_id
             WHERE dep.clinic_id = :clinic_id AND d.is_active = TRUE
             ORDER BY dep.department_name, d.doctor_code'
        );
        $stmt->execute(['clinic_id' => $clinicId]);
        return $stmt->fetchAll();
    }

    public static function listByDepartment(int $departmentId): array
    {
        $stmt = get_db_connection()->prepare(
            'SELECT doctor_id, doctor_code, specialization, consultation_fee
             FROM doctors WHERE department_id = :department_id AND is_active = TRUE
             ORDER BY doctor_code'
        );
        $stmt->execute(['department_id' => $departmentId]);
        return $stmt->fetchAll();
    }

    /**
     * Used at login to attach the doctor's own doctor_id to their
     * session. Required for the Doctor Interface.
     */
    public static function findByUserId(int $userId): ?array
    {
        $stmt = get_db_connection()->prepare(
            'SELECT d.*, dep.department_name, dep.clinic_id
             FROM doctors d
             JOIN departments dep ON dep.department_id = d.department_id
             WHERE d.user_id = :user_id'
        );
        $stmt->execute(['user_id' => $userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /* ---------------------------------------------------------
     * Admin management (Phase 3) — additive only, nothing above
     * this line is changed so the Queue Engine / booking flow
     * keep working exactly as before.
     * --------------------------------------------------------- */

    public static function codeExists(string $doctorCode, ?int $excludeDoctorId = null): bool
    {
        $sql = 'SELECT doctor_id FROM doctors WHERE doctor_code = :code';
        $params = ['code' => $doctorCode];
        if ($excludeDoctorId !== null) {
            $sql .= ' AND doctor_id != :exclude_id';
            $params['exclude_id'] = $excludeDoctorId;
        }
        $stmt = get_db_connection()->prepare($sql);
        $stmt->execute($params);
        return (bool) $stmt->fetch();
    }

    /**
     * Filterable, joined listing for the admin Doctors page.
     * $filters: clinic_id, department_id, status ('active'|'inactive'|'all'), search
     */
    public static function listForAdmin(array $filters): array
    {
        $where = [];
        $params = [];

        if (!empty($filters['clinic_id'])) {
            $where[] = 'dep.clinic_id = :clinic_id';
            $params['clinic_id'] = (int) $filters['clinic_id'];
        }
        if (!empty($filters['department_id'])) {
            $where[] = 'd.department_id = :department_id';
            $params['department_id'] = (int) $filters['department_id'];
        }
        if (($filters['status'] ?? 'all') === 'active') {
            $where[] = 'd.is_active = TRUE';
        } elseif (($filters['status'] ?? 'all') === 'inactive') {
            $where[] = 'd.is_active = FALSE';
        }
        if (!empty($filters['search'])) {
            $where[] = '(u.full_name LIKE :search OR d.doctor_code LIKE :search)';
            $params['search'] = '%' . $filters['search'] . '%';
        }

        $sql = 'SELECT d.doctor_id, d.doctor_code, d.specialization, d.consultation_fee, d.is_active,
                       d.department_id, dep.department_name, dep.clinic_id, c.clinic_name,
                       u.user_id, u.full_name, u.email, u.phone
                FROM doctors d
                JOIN departments dep ON dep.department_id = d.department_id
                JOIN clinics c ON c.clinic_id = dep.clinic_id
                LEFT JOIN users u ON u.user_id = d.user_id';

        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY c.clinic_name, dep.department_name, d.doctor_code';

        $stmt = get_db_connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function create(
        ?int $userId,
        int $departmentId,
        string $doctorCode,
        ?string $specialization,
        float $consultationFee,
        bool $isActive
    ): int {
        $stmt = get_db_connection()->prepare(
            'INSERT INTO doctors (user_id, department_id, doctor_code, specialization, consultation_fee, is_active)
             VALUES (:user_id, :department_id, :doctor_code, :specialization, :fee, :is_active)'
        );
        $stmt->execute([
            'user_id'        => $userId,
            'department_id'  => $departmentId,
            'doctor_code'    => $doctorCode,
            'specialization' => $specialization,
            'fee'            => $consultationFee,
            'is_active'      => $isActive ? 1 : 0,
        ]);
        return (int) get_db_connection()->lastInsertId();
    }

    public static function update(
        int $doctorId,
        int $departmentId,
        string $doctorCode,
        ?string $specialization,
        float $consultationFee,
        bool $isActive
    ): void {
        $stmt = get_db_connection()->prepare(
            'UPDATE doctors
             SET department_id = :department_id, doctor_code = :doctor_code,
                 specialization = :specialization, consultation_fee = :fee, is_active = :is_active
             WHERE doctor_id = :id'
        );
        $stmt->execute([
            'department_id'  => $departmentId,
            'doctor_code'    => $doctorCode,
            'specialization' => $specialization,
            'fee'            => $consultationFee,
            'is_active'      => $isActive ? 1 : 0,
            'id'             => $doctorId,
        ]);
    }
}