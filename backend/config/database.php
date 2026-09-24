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

    $port = defined('DB_PORT') && DB_PORT !== '' ? DB_PORT : '3306';
    $dsn = 'mysql:host=' . DB_HOST . ';port=' . $port . ';dbname=' . DB_NAME . ';charset=' . (defined('DB_CHARSET') ? DB_CHARSET : 'utf8mb4');

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    if (!extension_loaded('pdo_mysql')) {
        error_log('[DB CONNECT FAILED] pdo_mysql extension is not enabled in the PHP runtime serving Apache.');
        throw new RuntimeException('Database connection failed.');
    }

    if (DB_PASS === 'YOUR_ACTUAL_MYSQL_PASSWORD') {
        error_log('[DB CONNECT FAILED] DB_PASS still contains the config.local.php placeholder.');
        throw new RuntimeException('Database connection failed.');
    }

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        // PHP's date_default_timezone_set() (config.php) has no effect on
        // MySQL's own NOW()/CURRENT_TIMESTAMP, which run on the DB
        // server's SYSTEM timezone. NoShowHandler/LateArrivalHandler
        // compute grace-period deadlines by strtotime()-parsing a
        // queue_status.updated_at string written by MySQL and comparing
        // it against PHP's time() -- if the two disagree, that math is
        // silently wrong (tokens can be marked NO_SHOW within seconds of
        // being created). Pinning the session to the same fixed offset
        // PHP uses keeps both sides reading and writing the same clock,
        // regardless of the DB server's own OS timezone.
        $pdo->exec("SET time_zone = '+05:30'");
    } catch (PDOException $e) {
        // Log connection metadata and the server's reason, but never the
        // password or the full DSN. ErrorHandler returns a generic response.
        error_log(sprintf(
            '[DB CONNECT FAILED] host=%s port=%s database=%s user=%s code=%s message=%s',
            DB_HOST,
            $port,
            DB_NAME,
            DB_USER,
            (string) $e->getCode(),
            $e->getMessage()
        ));
        throw new RuntimeException('Database connection failed.');
    }

    return $pdo;
}