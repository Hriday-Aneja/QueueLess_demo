<?php

class Schedule
{
    public static function forDoctorAndDay(int $doctorId, int $dayOfWeek): array
    {
        $stmt = get_db_connection()->prepare(
            'SELECT schedule_id, start_time, end_time, slot_duration_minutes, max_appointments
             FROM doctor_schedules
             WHERE doctor_id = :doctor_id AND day_of_week = :day AND is_active = TRUE'
        );
        $stmt->execute(['doctor_id' => $doctorId, 'day' => $dayOfWeek]);
        return $stmt->fetchAll();
    }

    /**
     * Builds a list of bookable time slots for a doctor on a given date,
     * based on their schedule for that weekday minus already-booked
     * appointment times.
     *
     * @return string[] e.g. ["09:00", "09:15", "09:30"]
     */
    public static function availableSlots(int $doctorId, string $date): array
    {
        $dayOfWeek = (int) date('w', strtotime($date)); // 0=Sunday..6=Saturday
        $blocks = self::forDoctorAndDay($doctorId, $dayOfWeek);

        if (empty($blocks)) {
            return [];
        }

        $stmt = get_db_connection()->prepare(
            "SELECT appointment_time FROM appointments
             WHERE doctor_id = :doctor_id AND appointment_date = :date AND status != 'cancelled'"
        );
        $stmt->execute(['doctor_id' => $doctorId, 'date' => $date]);
        $booked = array_map(fn($r) => substr($r['appointment_time'], 0, 5), $stmt->fetchAll());

        $slots = [];
        foreach ($blocks as $block) {
            $start = strtotime($block['start_time']);
            $end   = strtotime($block['end_time']);
            $step  = max(1, (int) $block['slot_duration_minutes']) * 60;

            for ($t = $start; $t < $end; $t += $step) {
                $slot = date('H:i', $t);
                if (!in_array($slot, $booked, true)) {
                    $slots[] = $slot;
                }
            }
        }

        return $slots;
    }
}