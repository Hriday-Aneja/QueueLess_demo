<?php
require_once __DIR__ . '/../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed.', 405);
}

Auth::requireRole(ROLE_PATIENT);

$latitudeValue = $_GET['latitude'] ?? null;
$longitudeValue = $_GET['longitude'] ?? null;
$search = isset($_GET['search']) ? trim((string) $_GET['search']) : null;
$hasLatitude = $latitudeValue !== null && $latitudeValue !== '';
$hasLongitude = $longitudeValue !== null && $longitudeValue !== '';

if ($hasLatitude !== $hasLongitude) {
    Response::error('Both latitude and longitude are required for location search.', 422);
}

$latitude = null;
$longitude = null;
if ($hasLatitude && $hasLongitude) {
    if (!is_numeric($latitudeValue) || !is_numeric($longitudeValue)) {
        Response::error('Please provide valid coordinates.', 422);
    }

    $latitude = (float) $latitudeValue;
    $longitude = (float) $longitudeValue;
    if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
        Response::error('Please provide valid coordinates.', 422);
    }
}

Response::success([
    'clinics' => Clinic::searchNearby($latitude, $longitude, $search),
]);