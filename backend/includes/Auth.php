<?php

class Auth
{
    /**
     * Store the logged-in user in the session after successful login.
     */
    public static function login(int $userId, string $role, array $extra = []): void
    {
        $_SESSION['user_id'] = $userId;
        $_SESSION['role']    = $role;
        $_SESSION['extra']   = $extra; // e.g. patient_id, staff name, clinic_id
        session_regenerate_id(true);
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params['path'], $params['domain'],
                $params['secure'], $params['httponly']
            );
        }
        session_destroy();
    }

    public static function isLoggedIn(): bool
    {
        return isset($_SESSION['user_id'], $_SESSION['role']);
    }

    public static function userId(): ?int
    {
        return $_SESSION['user_id'] ?? null;
    }

    public static function role(): ?string
    {
        return $_SESSION['role'] ?? null;
    }

    public static function extra(string $key, $default = null)
    {
        return $_SESSION['extra'][$key] ?? $default;
    }

    /**
     * Stop the request unless the user is logged in.
     * Call this at the top of any endpoint that requires a session.
     */
    public static function requireLogin(): void
    {
        if (!self::isLoggedIn()) {
            Response::error('You must be logged in to do this.', 401);
        }
    }

    /**
     * Stop the request unless the logged-in user has one of the given roles.
     * Example: Auth::requireRole(ROLE_RECEPTION, ROLE_ADMIN);
     */
    public static function requireRole(string ...$allowedRoles): void
    {
        self::requireLogin();

        if (!in_array(self::role(), $allowedRoles, true)) {
            Response::error('You are not authorized to do this.', 403);
        }
    }
}