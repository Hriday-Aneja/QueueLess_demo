<?php

class User
{
    public static function findById(int $userId): ?array
    {
        $stmt = get_db_connection()->prepare(
            'SELECT user_id, full_name, email, phone, role, is_active, created_at
             FROM users WHERE user_id = :id'
        );
        $stmt->execute(['id' => $userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Includes password_hash — only use this for login checks, never
     * return it in an API response.
     */
    public static function findByEmailWithPassword(string $email): ?array
    {
        $stmt = get_db_connection()->prepare(
            'SELECT user_id, full_name, email, phone, role, password_hash, is_active
             FROM users WHERE email = :email'
        );
        $stmt->execute(['email' => $email]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function emailExists(string $email): bool
    {
        $stmt = get_db_connection()->prepare('SELECT user_id FROM users WHERE email = :email');
        $stmt->execute(['email' => $email]);
        return (bool) $stmt->fetch();
    }

    public static function create(string $fullName, string $email, ?string $phone, string $passwordHash, string $role): int
    {
        $stmt = get_db_connection()->prepare(
            'INSERT INTO users (full_name, email, phone, password_hash, role)
             VALUES (:full_name, :email, :phone, :password_hash, :role)'
        );
        $stmt->execute([
            'full_name'      => $fullName,
            'email'          => $email,
            'phone'          => $phone,
            'password_hash'  => $passwordHash,
            'role'           => $role,
        ]);
        return (int) get_db_connection()->lastInsertId();
    }
}