<?php

class Validator
{
    /**
     * @return array<string,string> Field => error message. Empty array = valid.
     */
    public static function validate(array $input, array $rules): array
    {
        $errors = [];

        foreach ($rules as $field => $ruleString) {
            $rulesForField = explode('|', $ruleString);
            $value = $input[$field] ?? null;

            foreach ($rulesForField as $rule) {
                $error = self::applyRule($field, $value, $rule, $input);
                if ($error !== null) {
                    $errors[$field] = $error;
                    break; // stop at first failing rule for this field
                }
            }
        }

        return $errors;
    }

    private static function applyRule(string $field, $value, string $rule, array $input): ?string
    {
        // Support rules with a parameter, e.g. "min:3"
        $param = null;
        if (str_contains($rule, ':')) {
            [$rule, $param] = explode(':', $rule, 2);
        }

        switch ($rule) {
            case 'required':
                if ($value === null || $value === '') {
                    return "$field is required.";
                }
                break;

            case 'int':
                if ($value !== null && $value !== '' && filter_var($value, FILTER_VALIDATE_INT) === false) {
                    return "$field must be a whole number.";
                }
                break;

            case 'email':
                if ($value !== null && $value !== '' && filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
                    return "$field must be a valid email address.";
                }
                break;

            case 'date':
                if ($value !== null && $value !== '' && !self::isValidDate((string) $value)) {
                    return "$field must be a valid date (YYYY-MM-DD).";
                }
                break;

            case 'min':
                if ($value !== null && mb_strlen((string) $value) < (int) $param) {
                    return "$field must be at least $param characters.";
                }
                break;

            case 'max':
                if ($value !== null && mb_strlen((string) $value) > (int) $param) {
                    return "$field must be at most $param characters.";
                }
                break;

            case 'in':
                $allowed = explode(',', (string) $param);
                if ($value !== null && $value !== '' && !in_array((string) $value, $allowed, true)) {
                    return "$field must be one of: " . implode(', ', $allowed) . '.';
                }
                break;
        }

        return null;
    }

    private static function isValidDate(string $date): bool
    {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }

    /**
     * Read and decode a JSON request body into an associative array.
     * Falls back to $_POST for classic form submissions.
     */
    public static function jsonBody(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') {
            return $_POST ?: [];
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }
}