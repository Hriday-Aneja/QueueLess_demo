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
                    d.department_id, dep.department_name
             FROM doctors d
             JOIN departments dep ON dep.department_id = d.department_id
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
}