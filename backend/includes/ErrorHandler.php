<?php


class ErrorHandler
{
    public static function register(): void
    {
        set_error_handler([self::class, 'handleError']);
        set_exception_handler([self::class, 'handleException']);
    }

    public static function handleError(int $severity, string $message, string $file, int $line): bool
    {
        self::log("PHP ERROR [$severity] $message in $file:$line");

        // Don't let a warning/notice halt execution; only fatal-ish
        // severities should stop the request.
        if (!(error_reporting() & $severity)) {
            return true;
        }

        if (in_array($severity, [E_ERROR, E_USER_ERROR, E_PARSE, E_CORE_ERROR], true)) {
            Response::error('Something went wrong on the server.', 500);
        }

        return true;
    }

    public static function handleException(Throwable $e): void
    {
        self::log('UNCAUGHT EXCEPTION: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());

        $message = (defined('APP_DEBUG') && APP_DEBUG)
            ? $e->getMessage() // helpful while developing locally
            : 'Something went wrong on the server.';

        Response::error($message, 500);
    }

    private static function log(string $line): void
    {
        $entry = '[' . date('Y-m-d H:i:s') . '] ' . $line . PHP_EOL;

        if (defined('LOG_FILE')) {
            @file_put_contents(LOG_FILE, $entry, FILE_APPEND);
        } else {
            error_log($entry);
        }
    }
}