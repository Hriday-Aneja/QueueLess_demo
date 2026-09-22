<?php

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('This script can only be run from the command line.');
}

require_once __DIR__ . '/../config/config.php';

$localConfig = __DIR__ . '/../config/config.local.php';
if (!file_exists($localConfig)) {
    fwrite(STDERR, "Missing config.local.php. Copy config.local.example.php and fill in your DB credentials.\n");
    exit(1);
}
require_once $localConfig;
require_once __DIR__ . '/../config/database.php';

spl_autoload_register(function (string $class) {
    foreach (['core', 'models'] as $folder) {
        $path = __DIR__ . '/../' . $folder . '/' . $class . '.php';
        if (file_exists($path)) {
            require_once $path;
            return;
        }
    }
});

$today = date('Y-m-d');
$db = get_db_connection();

$stmt = $db->prepare(
    "SELECT DISTINCT doctor_id FROM tokens WHERE token_date = :today"
);
$stmt->execute(['today' => $today]);
$doctorIds = array_column($stmt->fetchAll(), 'doctor_id');

echo "[" . date('Y-m-d H:i:s') . "] Sweeping grace periods for " . count($doctorIds) . " doctor(s) on $today...\n";

foreach ($doctorIds as $doctorId) {
    try {
        NoShowHandler::sweep((int) $doctorId, $today);
        echo "  doctor_id $doctorId: ok\n";
    } catch (Throwable $e) {
        fwrite(STDERR, "  doctor_id $doctorId: FAILED - " . $e->getMessage() . "\n");
    }
}

echo "[" . date('Y-m-d H:i:s') . "] Sweep complete.\n";