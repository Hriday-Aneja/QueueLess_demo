<?php

// This file is git-ignored (see .gitignore) — it never leaves your machine.
// Values below match a fresh MySQL Community Server 8.0.44 install with a
// root account that has no password. Since XAMPP's own MySQL is NOT used
// (port 3306 is already taken by the standalone server), these should be
// correct as-is. If you set a root password during MySQL install, or
// created a dedicated 'queueless' DB user, update DB_USER / DB_PASS below.

define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'queueless');
define('DB_USER', 'root');
define('DB_PASS', 'root');
define('DB_CHARSET', 'utf8mb4');
