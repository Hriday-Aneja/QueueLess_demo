<?php

class Patient
{
    public static function findById(int $patientId): ?array
    {
        $stmt = get_db_connection()->prepare('SELECT * FROM patients WHERE patient_id = :id');
        $stmt->execute(['id' => $patientId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findByUserId(int $userId): ?array
    {
        $stmt = get_db_connection()->prepare('SELECT * FROM patients WHERE user_id = :user_id');
        $stmt->execute(['user_id' => $userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function searchForReception(string $query): array
    {
        $stmt = get_db_connection()->prepare(
            'SELECT p.patient_id, p.patient_code, u.full_name, u.phone
             FROM patients p
             LEFT JOIN users u ON u.user_id = p.user_id
             WHERE p.patient_code LIKE :query
                OR u.full_name LIKE :query
                OR u.phone LIKE :query
             ORDER BY u.full_name ASC
             LIMIT 50'
        );
        $stmt->execute(['query' => '%' . $query . '%']);
        return $stmt->fetchAll();
    }

    /**
     * Creates a patient row. $userId is null for a walk-in with no login.
     * patient_code is generated as PT-0001, PT-0002, ... from the new row's id.
     */
    public static function create(?int $userId, ?string $dob = null, ?string $gender = null, ?string $emergencyName = null, ?string $emergencyPhone = null): int
    {
        $db = get_db_connection();

        $stmt = $db->prepare(
            "INSERT INTO patients (user_id, patient_code, date_of_birth, gender, emergency_contact_name, emergency_contact_phone)
             VALUES (:user_id, :placeholder_code, :dob, :gender, :ec_name, :ec_phone)"
        );
        $stmt->execute([
            'user_id'          => $userId,
            'placeholder_code' => 'PENDING', // temporary, replaced below
            'dob'              => $dob,
            'gender'           => $gender,
            'ec_name'          => $emergencyName,
            'ec_phone'         => $emergencyPhone,
        ]);

        $patientId = (int) $db->lastInsertId();
        $code = 'PT-' . str_pad((string) $patientId, 4, '0', STR_PAD_LEFT);

        $update = $db->prepare('UPDATE patients SET patient_code = :code WHERE patient_id = :id');
        $update->execute(['code' => $code, 'id' => $patientId]);

        return $patientId;
    }

    /**
     * Creates a bare walk-in patient with just a name/phone captured via
     * the linked user row (reception creates a minimal user of role
     * 'patient' first, then a patient row pointing at it). Kept here for
     * convenience so tokens/walkin.php has a single call to make.
     */
    public static function createWalkIn(string $name, ?string $phone): int
    {
        $db = get_db_connection();
        $db->beginTransaction();
        try {
            $userStmt = $db->prepare(
                "INSERT INTO users (full_name, email, phone, password_hash, role)
                 VALUES (:name, :email, :phone, :hash, 'patient')"
            );
            // Walk-ins without a real email get a unique placeholder so the
            // UNIQUE constraint on users.email never collides.
            $placeholderEmail = 'walkin_' . uniqid() . '@queueless.local';
            $userStmt->execute([
                'name'  => $name,
                'email' => $placeholderEmail,
                'phone' => $phone,
                'hash'  => password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT),
            ]);
            $userId = (int) $db->lastInsertId();

            $patientId = self::create($userId);

            $db->commit();
            return $patientId;
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }
}