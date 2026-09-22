<?php

// ---- Timezone ---------------------------------------------------------
date_default_timezone_set('Asia/Kolkata');

// ---- Queue Engine defaults ---------------------------------------------
// These are fallback/default values. Real values can be overridden per
// doctor/clinic via the `queue_rules` table (see core/QueueRules.php).

// Default grace period (in minutes) given to a patient once they become
// NEXT, before they are marked NO_SHOW.
define('DEFAULT_GRACE_PERIOD_MINUTES', 10);

// Default average consultation time (in minutes) used for ETA
// calculation when no doctor-specific value is configured.
define('DEFAULT_AVG_CONSULTATION_MINUTES', 5);

// ---- Session ------------------------------------------------------------
define('SESSION_NAME', 'queueless_session');
define('SESSION_LIFETIME_SECONDS', 60 * 60 * 8); // 8 hours

// ---- Roles ---------------------------------------------------------------
define('ROLE_PATIENT', 'patient');
define('ROLE_RECEPTION', 'reception');
define('ROLE_ADMIN', 'admin');

// ---- Environment ----------------------------------------------------------
// Set to false in production so PHP errors are never shown to the browser.
define('APP_DEBUG', true);

// ---- Paths ------------------------------------------------------------
define('BACKEND_ROOT', dirname(__DIR__));
define('LOG_FILE', BACKEND_ROOT . '/logs/app.log');