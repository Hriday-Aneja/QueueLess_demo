<?php

class Notification
{
    public static function create(?int $userId, ?int $patientId, string $title, string $message, string $type = 'general'): int
    {
        $stmt = get_db_connection()->prepare(
            'INSERT INTO notifications (user_id, patient_id, title, message, notification_type)
             VALUES (:user_id, :patient_id, :title, :message, :type)'
        );
        $stmt->execute([
            'user_id'    => $userId,
            'patient_id' => $patientId,
            'title'      => $title,
            'message'    => $message,
            'type'       => $type,
        ]);
        return (int) get_db_connection()->lastInsertId();
    }

    public static function listForUser(int $userId): array
    {
        $stmt = get_db_connection()->prepare(
            'SELECT notification_id, title, message, notification_type, is_read, created_at
             FROM notifications WHERE user_id = :user_id
             ORDER BY created_at DESC LIMIT 50'
        );
        $stmt->execute(['user_id' => $userId]);
        return $stmt->fetchAll();
    }

    public static function markRead(int $notificationId, int $userId): bool
    {
        $stmt = get_db_connection()->prepare(
            'UPDATE notifications SET is_read = TRUE, read_at = NOW()
             WHERE notification_id = :id AND user_id = :user_id'
        );
        $stmt->execute(['id' => $notificationId, 'user_id' => $userId]);
        return $stmt->rowCount() > 0;
    }
}