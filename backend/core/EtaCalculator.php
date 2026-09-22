<?php

class EtaCalculator
{
    /**
     * @param int $patientsAhead          How many patients are ahead in the queue.
     * @param int $avgConsultationMinutes Average consultation time in minutes
     *                                    for this doctor/clinic. Falls back to
     *                                    the config default if not provided.
     * @return int Estimated wait time in minutes.
     */
    public static function estimateWaitMinutes(int $patientsAhead, ?int $avgConsultationMinutes = null): int
    {
        if ($patientsAhead < 0) {
            $patientsAhead = 0;
        }

        $avg = $avgConsultationMinutes ?? DEFAULT_AVG_CONSULTATION_MINUTES;
        if ($avg < 1) {
            $avg = DEFAULT_AVG_CONSULTATION_MINUTES;
        }

        return $patientsAhead * $avg;
    }

    /**
     * Same as above, but also returns the pieces used, which is handy
     * for the JSON response so the frontend can show "5 patients ahead
     * × 5 min = ~25 min" without recomputing it.
     */
    public static function estimateWaitBreakdown(int $patientsAhead, ?int $avgConsultationMinutes = null): array
    {
        $avg = $avgConsultationMinutes ?? DEFAULT_AVG_CONSULTATION_MINUTES;
        if ($avg < 1) {
            $avg = DEFAULT_AVG_CONSULTATION_MINUTES;
        }
        if ($patientsAhead < 0) {
            $patientsAhead = 0;
        }

        return [
            'patients_ahead'          => $patientsAhead,
            'avg_consultation_minutes' => $avg,
            'estimated_wait_minutes'  => $patientsAhead * $avg,
        ];
    }
}