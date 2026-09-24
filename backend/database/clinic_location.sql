-- QueueLess clinic location upgrade.
-- Safe to run against an existing database before importing the updated seed.

USE queueless;

SET @has_latitude = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'clinics'
      AND column_name = 'latitude'
);
SET @sql = IF(
    @has_latitude = 0,
    'ALTER TABLE clinics ADD COLUMN latitude DECIMAL(10,8) NULL AFTER phone',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_longitude = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'clinics'
      AND column_name = 'longitude'
);
SET @sql = IF(
    @has_longitude = 0,
    'ALTER TABLE clinics ADD COLUMN longitude DECIMAL(11,8) NULL AFTER latitude',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE clinics
SET latitude = 28.56770,
    longitude = 77.24330
WHERE clinic_name = 'City Care Multispecialty Hospital'
  AND (latitude IS NULL OR longitude IS NULL);