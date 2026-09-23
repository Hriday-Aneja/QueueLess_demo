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

    public static function emailExists(string $email, ?int $excludeUserId = null): bool
    {
        $sql = 'SELECT user_id FROM users WHERE email = :email';
        $params = ['email' => $email];
        if ($excludeUserId !== null) {
            $sql .= ' AND user_id != :exclude_id';
            $params['exclude_id'] = $excludeUserId;
        }
        $stmt = get_db_connection()->prepare($sql);
        $stmt->execute($params);
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

    /* ---------------------------------------------------------
     * Admin management (Phase 3) — additive only.
     * --------------------------------------------------------- */

    public static function update(int $userId, string $fullName, string $email, ?string $phone): void
    {
        $stmt = get_db_connection()->prepare(
            'UPDATE users SET full_name = :full_name, email = :email, phone = :phone
             WHERE user_id = :id'
        );
        $stmt->execute([
            'full_name' => $fullName,
            'email'     => $email,
            'phone'     => $phone,
            'id'        => $userId,
        ]);
    }

    public static function setActive(int $userId, bool $isActive): void
    {
        $stmt = get_db_connection()->prepare(
            'UPDATE users SET is_active = :is_active WHERE user_id = :id'
        );
        $stmt->execute(['is_active' => $isActive ? 1 : 0, 'id' => $userId]);
    }
}