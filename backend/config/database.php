<?php

function get_db_connection(): PDO
{
    static $pdo = null;

    if ($pdo !== null) {
        return $pdo;
    }

    if (!defined('DB_HOST') || !defined('DB_NAME') || !defined('DB_USER') || !defined('DB_PASS')) {
        throw new RuntimeException(
            'Database credentials are not defined. Did you create backend/config/config.local.php from config.local.example.php?'
        );
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . (defined('DB_CHARSET') ? DB_CHARSET : 'utf8mb4');

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        // Never leak raw DB errors to the client. Log details, throw a
        // generic exception that ErrorHandler.php will turn into a
        // clean JSON error response.
        error_log('[DB CONNECT FAILED] ' . $e->getMessage());
        throw new RuntimeException('Database connection failed.');
    }

    return $pdo;
}