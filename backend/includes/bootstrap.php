<?php

// ---- Error visibility (ErrorHandler decides what the CLIENT sees) -------
error_reporting(E_ALL);
ini_set('display_errors', '0'); // never print raw errors to the browser

// ---- Session -------------------------------------------------------------
define('BOOTSTRAPPED', true);

$backendRoot = dirname(__DIR__);

require_once $backendRoot . '/config/config.php';

session_name(SESSION_NAME);
session_set_cookie_params([
    'lifetime' => SESSION_LIFETIME_SECONDS,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

// ---- Local (git-ignored) DB credentials ----------------------------------
$localConfig = $backendRoot . '/config/config.local.php';
if (!file_exists($localConfig)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Server is not configured. Copy config.local.example.php to config.local.php and fill in your DB credentials.',
    ]);
    exit;
}
require_once $localConfig;
require_once $backendRoot . '/config/database.php';

// ---- Autoload core/ and models/ classes -----------------------------------
spl_autoload_register(function (string $class) use ($backendRoot) {
    foreach (['core', 'models'] as $folder) {
        $path = $backendRoot . '/' . $folder . '/' . $class . '.php';
        if (file_exists($path)) {
            require_once $path;
            return;
        }
    }
});

// ---- includes/ that aren't autoloaded (plain static helper classes) -------
require_once $backendRoot . '/includes/Response.php';
require_once $backendRoot . '/includes/ErrorHandler.php';
require_once $backendRoot . '/includes/Auth.php';
require_once $backendRoot . '/includes/Validator.php';

ErrorHandler::register();

// ---- CORS / content type ---------------------------------------------------
// Frontend and backend are served from the same origin (same
// localhost/queueless/ path), so no CORS headers are required.
header('Content-Type: application/json');