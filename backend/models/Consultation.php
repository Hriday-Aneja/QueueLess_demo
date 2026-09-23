<?php

class Consultation
{
    public static function start(int $tokenId, int $doctorId, int $patientId): int
    {
        $stmt = get_db_connection()->prepare(
            "INSERT INTO consultations (token_id, doctor_id, patient_id, started_at, consultation_status)
             VALUES (:token_id, :doctor_id, :patient_id, NOW(), 'in_progress')"
        );
        $stmt->execute(['token_id' => $tokenId, 'doctor_id' => $doctorId, 'patient_id' => $patientId]);
        return (int) get_db_connection()->lastInsertId();
    }

    public static function updateNotes(int $tokenId, string $notes): bool
    {
        $stmt = get_db_connection()->prepare(
            "UPDATE consultations SET notes = :notes
             WHERE token_id = :token_id AND consultation_status = 'in_progress'"
        );
        $stmt->execute(['notes' => $notes, 'token_id' => $tokenId]);
        return $stmt->rowCount() > 0;
    }

    public static function completeByTokenId(int $tokenId, ?string $notes = null): void
    {
        $stmt = get_db_connection()->prepare(
            "UPDATE consultations
             SET ended_at = NOW(), consultation_status = 'completed', notes = COALESCE(:notes, notes)
             WHERE token_id = :token_id AND consultation_status = 'in_progress'"
        );
        $stmt->execute(['notes' => $notes, 'token_id' => $tokenId]);
    }

    /**
     * Real average consultation duration (minutes) for a doctor, based
     * on completed consultations. QueueRules falls back to its
     * configured default when this returns null (not enough data yet).
     */
    public static function averageMinutesForDoctor(int $doctorId, int $lastNConsultations = 20): ?float
    {
        $stmt = get_db_connection()->prepare(
            "SELECT AVG(TIMESTAMPDIFF(MINUTE, started_at, ended_at)) AS avg_minutes
             FROM (
                 SELECT started_at, ended_at
                 FROM consultations
                 WHERE doctor_id = :doctor_id AND consultation_status = 'completed' AND ended_at IS NOT NULL
                 ORDER BY ended_at DESC
                 LIMIT :limit
             ) recent"
        );
        $stmt->bindValue('doctor_id', $doctorId, PDO::PARAM_INT);
        $stmt->bindValue('limit', $lastNConsultations, PDO::PARAM_INT);
        $stmt->execute();
        $avg = $stmt->fetch()['avg_minutes'] ?? null;
        return $avg !== null ? (float) $avg : null;
    }
}