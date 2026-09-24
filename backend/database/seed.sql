-- =========================================================
-- QueueLess - Smart Hospital Queue Management System
-- Demo Seed Data
-- MySQL 8.0.44
--
-- Owner: Hriday (Admin Panel + Database + Analytics)
-- Scope: DATA ONLY. Does not create/alter/drop any table.
--        Assumes backend/database/schema.sql has already
--        been imported into the `queueless` database.
--
-- SAFE TO RE-RUN:
--   This script owns the rows in the 12 tables below. Every
--   run first TRUNCATEs just those tables (schema/structure
--   is untouched) and then re-inserts a full, consistent set
--   of demo data. Re-running it always leaves the database in
--   the same known-good demo state.
--
-- DATES:
--   All dates/times are computed relative to CURDATE()/NOW()
--   at the moment this script runs, so "today's" queue is
--   always actually today, no matter when you run it.
-- =========================================================

USE queueless;

-- ---------------------------------------------------------
-- 0. RESET DEMO DATA (children -> parents order not required
--    because FK checks are disabled just for the TRUNCATEs)
-- ---------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE notifications;
TRUNCATE TABLE consultations;
TRUNCATE TABLE queue_status;
TRUNCATE TABLE tokens;
TRUNCATE TABLE appointments;
TRUNCATE TABLE doctor_schedules;
TRUNCATE TABLE queue_rules;
TRUNCATE TABLE doctors;
TRUNCATE TABLE patients;
TRUNCATE TABLE departments;
TRUNCATE TABLE clinics;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------
-- 1. CLINIC
-- ---------------------------------------------------------
INSERT INTO clinics (clinic_name, address, phone, latitude, longitude, is_active)
VALUES (
    'City Care Multispecialty Hospital',
    '221 Ring Road, Lajpat Nagar, New Delhi, Delhi 110024',
    '01141234567',
    28.56770,
    77.24330,
    TRUE
);

-- ---------------------------------------------------------
-- 2. DEPARTMENTS  (all under the one clinic above)
-- ---------------------------------------------------------
INSERT INTO departments (clinic_id, department_name, description, is_active)
SELECT c.clinic_id, d.name, d.description, TRUE
FROM clinics c
CROSS JOIN (
    SELECT 'General Medicine' AS name, 'Primary care, fevers, infections and general check-ups' AS description
    UNION ALL SELECT 'Cardiology', 'Heart and cardiovascular care'
    UNION ALL SELECT 'Dermatology', 'Skin, hair and nail conditions'
    UNION ALL SELECT 'Orthopedics', 'Bones, joints and musculoskeletal care'
    UNION ALL SELECT 'Pediatrics', 'Child health and vaccinations'
    UNION ALL SELECT 'ENT', 'Ear, nose and throat care'
) d
WHERE c.clinic_name = 'City Care Multispecialty Hospital';

-- ---------------------------------------------------------
-- 3. USERS
--    Passwords are bcrypt hashes, verifiable with PHP's
--    password_verify(). Plaintext demo passwords are noted
--    in comments only -- never stored in the table itself.
--
--    Admin password:            Admin@123
--    Everyone else (reception,
--    doctors, patients w/ login): Demo@1234
-- ---------------------------------------------------------

-- 3a. Staff (admin + reception)
INSERT INTO users (full_name, email, phone, password_hash, role, is_active) VALUES
('Hriday Aneja',   'admin@queueless.com',     '9810000001', '$2b$10$C/pnnr8mv7NunhgEkfII8OtLbMVTZIZINqq.eTMPYpVyl51bbcuoC', 'admin',     TRUE),
('Priya Sharma',   'reception@queueless.com', '9810000002', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'reception', TRUE);

-- 3b. Doctor login accounts
INSERT INTO users (full_name, email, phone, password_hash, role, is_active) VALUES
('Dr. Ramesh Sharma',  'dr.ramesh.sharma@queueless.com',  '9810000011', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'doctor', TRUE),
('Dr. Anjali Mehta',   'dr.anjali.mehta@queueless.com',   '9810000012', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'doctor', TRUE),
('Dr. Karan Malhotra', 'dr.karan.malhotra@queueless.com', '9810000013', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'doctor', TRUE),
('Dr. Neha Kapoor',    'dr.neha.kapoor@queueless.com',    '9810000014', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'doctor', TRUE),
('Dr. Suresh Iyer',    'dr.suresh.iyer@queueless.com',    '9810000015', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'doctor', TRUE),
('Dr. Pooja Nair',     'dr.pooja.nair@queueless.com',     '9810000016', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'doctor', TRUE);

-- 3c. Patient login accounts (8 of the 12 demo patients have an
--     account; the other 4 are walk-in-only, see patients below)
INSERT INTO users (full_name, email, phone, password_hash, role, is_active) VALUES
('Rohit Verma',   'rohit.verma@example.com',   '9910000001', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'patient', TRUE),
('Sunita Yadav',  'sunita.yadav@example.com',  '9910000002', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'patient', TRUE),
('Kavita Joshi',  'kavita.joshi@example.com',  '9910000004', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'patient', TRUE),
('Vikram Singh',  'vikram.singh@example.com',  '9910000005', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'patient', TRUE),
('Arjun Chawla',  'arjun.chawla@example.com',  '9910000007', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'patient', TRUE),
('Deepika Rao',   'deepika.rao@example.com',   '9910000009', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'patient', TRUE),
('Manoj Tiwari',  'manoj.tiwari@example.com',  '9910000010', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'patient', TRUE),
('Rajesh Nair',   'rajesh.nair@example.com',   '9910000012', '$2b$10$UYW.n3z27Vq20ABglFbFleVP49okmqs4KySBrnwJfDLbmCdIR8D8q', 'patient', TRUE);

-- ---------------------------------------------------------
-- 4. DOCTORS  (linked to the user + department rows above)
-- ---------------------------------------------------------
INSERT INTO doctors (user_id, department_id, doctor_code, specialization, consultation_fee, is_active)
SELECT u.user_id, dep.department_id, x.doctor_code, x.specialization, x.fee, TRUE
FROM (
    SELECT 'dr.ramesh.sharma@queueless.com'  AS email, 'DOC-001' AS doctor_code, 'General Physician'   AS specialization, 500.00 AS fee, 'General Medicine' AS dept
    UNION ALL SELECT 'dr.anjali.mehta@queueless.com',   'DOC-002', 'Cardiologist',         900.00, 'Cardiology'
    UNION ALL SELECT 'dr.karan.malhotra@queueless.com', 'DOC-003', 'Dermatologist',        700.00, 'Dermatology'
    UNION ALL SELECT 'dr.neha.kapoor@queueless.com',    'DOC-004', 'Orthopedic Surgeon',   800.00, 'Orthopedics'
    UNION ALL SELECT 'dr.suresh.iyer@queueless.com',    'DOC-005', 'Pediatrician',         600.00, 'Pediatrics'
    UNION ALL SELECT 'dr.pooja.nair@queueless.com',     'DOC-006', 'ENT Specialist',       650.00, 'ENT'
) x
JOIN users u        ON u.email = x.email
JOIN departments dep ON dep.department_name = x.dept
                     AND dep.clinic_id = (SELECT clinic_id FROM clinics WHERE clinic_name = 'City Care Multispecialty Hospital');

-- ---------------------------------------------------------
-- 5. DOCTOR SCHEDULES
--    Every doctor: Mon-Sat (day_of_week 1-6), 09:00-14:00,
--    15-minute slots, closed Sunday.
-- ---------------------------------------------------------
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, max_appointments, is_active)
SELECT d.doctor_id, wd.day, '09:00:00', '14:00:00', 15, 20, TRUE
FROM doctors d
CROSS JOIN (
    SELECT 1 AS day UNION ALL SELECT 2 UNION ALL SELECT 3
    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
) wd;

-- ---------------------------------------------------------
-- 6. PATIENTS
--    8 linked to a user login, 4 are walk-in-only (user_id NULL)
-- ---------------------------------------------------------
INSERT INTO patients (user_id, patient_code, date_of_birth, gender, emergency_contact_name, emergency_contact_phone)
SELECT u.user_id, x.code, x.dob, x.gender, x.ec_name, x.ec_phone
FROM (
    SELECT 'rohit.verma@example.com'  AS email, 'PT-0001' AS code, '1990-04-12' AS dob, 'Male'   AS gender, 'Sanjay Verma'   AS ec_name, '9920000001' AS ec_phone
    UNION ALL SELECT 'sunita.yadav@example.com',  'PT-0002', '1985-11-02', 'Female', 'Ravi Yadav',      '9920000002'
    UNION ALL SELECT 'kavita.joshi@example.com',  'PT-0004', '1979-01-25', 'Female', 'Anil Joshi',      '9920000004'
    UNION ALL SELECT 'vikram.singh@example.com',  'PT-0005', '1992-09-08', 'Male',   'Harpreet Singh',  '9920000005'
    UNION ALL SELECT 'arjun.chawla@example.com',  'PT-0007', '1988-06-30', 'Male',   'Meera Chawla',    '9920000007'
    UNION ALL SELECT 'deepika.rao@example.com',   'PT-0009', '1994-05-17', 'Female', 'Krishna Rao',     '9920000009'
    UNION ALL SELECT 'manoj.tiwari@example.com',  'PT-0010', '1982-08-22', 'Male',   'Sarita Tiwari',   '9920000010'
    UNION ALL SELECT 'rajesh.nair@example.com',   'PT-0012', '1970-02-28', 'Male',   'Lakshmi Nair',    '9920000012'
) x
JOIN users u ON u.email = x.email;

-- Walk-in-only patients (no login account)
INSERT INTO patients (user_id, patient_code, date_of_birth, gender, emergency_contact_name, emergency_contact_phone) VALUES
(NULL, 'PT-0003', '1998-07-19', 'Male',   'Rekha Gupta',    '9920000003'),
(NULL, 'PT-0006', '2001-03-14', 'Female', 'Suresh Kumar',   '9920000006'),
(NULL, 'PT-0008', '1975-02-20', 'Male',   'Neeta Malhotra', '9920000008'),
(NULL, 'PT-0011', '1996-10-11', 'Female', 'Vinod Kapoor',   '9920000011');

-- ---------------------------------------------------------
-- 7. QUEUE RULES
-- ---------------------------------------------------------
-- Global default for the clinic
INSERT INTO queue_rules (clinic_id, department_id, grace_period_minutes, average_consultation_minutes, appointment_priority, walkin_priority, no_show_after_minutes, late_arrival_rule, is_active)
SELECT clinic_id, NULL, 10, 15, 10, 5, 15, 'requeue', TRUE
FROM clinics WHERE clinic_name = 'City Care Multispecialty Hospital';

-- Cardiology needs longer consultations
INSERT INTO queue_rules (clinic_id, department_id, grace_period_minutes, average_consultation_minutes, appointment_priority, walkin_priority, no_show_after_minutes, late_arrival_rule, is_active)
SELECT c.clinic_id, dep.department_id, 15, 20, 10, 5, 15, 'requeue', TRUE
FROM clinics c
JOIN departments dep ON dep.clinic_id = c.clinic_id AND dep.department_name = 'Cardiology'
WHERE c.clinic_name = 'City Care Multispecialty Hospital';

-- General Medicine runs a faster, higher-volume queue
INSERT INTO queue_rules (clinic_id, department_id, grace_period_minutes, average_consultation_minutes, appointment_priority, walkin_priority, no_show_after_minutes, late_arrival_rule, is_active)
SELECT c.clinic_id, dep.department_id, 10, 12, 10, 6, 10, 'hold', TRUE
FROM clinics c
JOIN departments dep ON dep.clinic_id = c.clinic_id AND dep.department_name = 'General Medicine'
WHERE c.clinic_name = 'City Care Multispecialty Hospital';

-- ---------------------------------------------------------
-- 8. APPOINTMENTS
--    Section A: TODAY  (General Medicine, Cardiology, ENT)
--    Section B: YESTERDAY (General Medicine, for history)
--    Section C: OLDER PAST (2-5 days ago, other departments)
-- ---------------------------------------------------------

-- ---- 8A. TODAY : General Medicine (Dr. Ramesh Sharma) ----
INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, appointment_time, appointment_type, priority, status, reason, booked_at, checked_in_at, completed_at, cancelled_at)
SELECT p.patient_id, doc.doctor_id, doc.department_id, CURDATE(), a.appt_time, a.appt_type, a.priority, a.status, a.reason,
       DATE_SUB(NOW(), INTERVAL a.booked_hours_ago HOUR),
       IF(a.checked_in_time IS NULL, NULL, TIMESTAMP(CURDATE(), a.checked_in_time)),
       IF(a.completed_time  IS NULL, NULL, TIMESTAMP(CURDATE(), a.completed_time)),
       NULL
FROM (
    SELECT 'PT-0001' AS code, '09:00:00' AS appt_time, 'appointment' AS appt_type, 'normal' AS priority, 'completed' AS status, 'Fever and cold'        AS reason, 30 AS booked_hours_ago, '08:55:00' AS checked_in_time, '09:14:00' AS completed_time
    UNION ALL SELECT 'PT-0002', '09:15:00', 'appointment', 'normal', 'completed', 'Routine check-up',      26, '09:12:00', '09:33:00'
    UNION ALL SELECT 'PT-0003', '09:22:00', 'walkin',      'normal', 'completed', 'Stomach pain',           2, '09:20:00', '09:40:00'
    UNION ALL SELECT 'PT-0004', '09:45:00', 'appointment', 'normal', 'checked_in', 'Persistent headache',   20, '09:50:00', NULL
    UNION ALL SELECT 'PT-0005', '10:00:00', 'appointment', 'normal', 'scheduled',  'Follow-up consultation', 18, '10:05:00', NULL
    UNION ALL SELECT 'PT-0006', '10:15:00', 'walkin',      'normal', 'scheduled',  'Body ache and fatigue',  1, NULL,        NULL
    UNION ALL SELECT 'PT-0007', '10:30:00', 'appointment', 'normal', 'no_show',    'Diabetes review',       22, NULL,        NULL
    UNION ALL SELECT 'PT-0008', '10:10:00', 'walkin',      'emergency', 'scheduled', 'Severe chest discomfort', 1, '10:10:00', NULL
) a
JOIN patients p ON p.patient_code = a.code
JOIN doctors doc ON doc.doctor_code = 'DOC-001';

-- ---- 8A. TODAY : Cardiology (Dr. Anjali Mehta) ----
INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, appointment_time, appointment_type, priority, status, reason, booked_at, checked_in_at, completed_at, cancelled_at)
SELECT p.patient_id, doc.doctor_id, doc.department_id, CURDATE(), a.appt_time, a.appt_type, a.priority, a.status, a.reason,
       DATE_SUB(NOW(), INTERVAL a.booked_hours_ago HOUR),
       IF(a.checked_in_time IS NULL, NULL, TIMESTAMP(CURDATE(), a.checked_in_time)),
       IF(a.completed_time  IS NULL, NULL, TIMESTAMP(CURDATE(), a.completed_time)),
       IF(a.cancelled, DATE_SUB(NOW(), INTERVAL 20 HOUR), NULL)
FROM (
    SELECT 'PT-0009' AS code, '10:00:00' AS appt_time, 'appointment' AS appt_type, 'normal' AS priority, 'completed' AS status, 'Chest pain evaluation' AS reason, 28 AS booked_hours_ago, '09:55:00' AS checked_in_time, '10:22:00' AS completed_time, FALSE AS cancelled
    UNION ALL SELECT 'PT-0010', '10:20:00', 'appointment', 'normal', 'checked_in', 'High blood pressure',   24, '10:15:00', NULL, FALSE
    UNION ALL SELECT 'PT-0011', '10:35:00', 'walkin',      'normal', 'scheduled',  'Palpitations',           1, '10:35:00', NULL, FALSE
    UNION ALL SELECT 'PT-0012', '11:00:00', 'appointment', 'normal', 'cancelled',  'Annual heart check-up', 40, NULL,       NULL, TRUE
) a
JOIN patients p ON p.patient_code = a.code
JOIN doctors doc ON doc.doctor_code = 'DOC-002';

-- ---- 8A. TODAY : ENT (Dr. Pooja Nair) ----
INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, appointment_time, appointment_type, priority, status, reason, booked_at, checked_in_at, completed_at, cancelled_at)
SELECT p.patient_id, doc.doctor_id, doc.department_id, CURDATE(), a.appt_time, a.appt_type, a.priority, a.status, a.reason,
       DATE_SUB(NOW(), INTERVAL a.booked_hours_ago HOUR),
       IF(a.checked_in_time IS NULL, NULL, TIMESTAMP(CURDATE(), a.checked_in_time)),
       IF(a.completed_time  IS NULL, NULL, TIMESTAMP(CURDATE(), a.completed_time)),
       NULL
FROM (
    SELECT 'PT-0001' AS code, '09:30:00' AS appt_time, 'appointment' AS appt_type, 'normal' AS priority, 'completed' AS status, 'Ear infection' AS reason, 27 AS booked_hours_ago, '09:25:00' AS checked_in_time, '09:45:00' AS completed_time
    UNION ALL SELECT 'PT-0003', '10:40:00', 'walkin', 'normal', 'scheduled', 'Throat irritation', 1, '10:40:00', NULL
) a
JOIN patients p ON p.patient_code = a.code
JOIN doctors doc ON doc.doctor_code = 'DOC-006';

-- ---- 8B. YESTERDAY : General Medicine (for queue/analytics history) ----
INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, appointment_time, appointment_type, priority, status, reason, booked_at, checked_in_at, completed_at, cancelled_at)
SELECT p.patient_id, doc.doctor_id, doc.department_id, DATE_SUB(CURDATE(), INTERVAL 1 DAY), a.appt_time, a.appt_type, 'normal', 'completed', a.reason,
       DATE_SUB(NOW(), INTERVAL 48 HOUR),
       TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), a.checked_in_time),
       TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), a.completed_time),
       NULL
FROM (
    SELECT 'PT-0002' AS code, '09:00:00' AS appt_time, 'appointment' AS appt_type, 'General check-up' AS reason, '08:55:00' AS checked_in_time, '09:15:00' AS completed_time
    UNION ALL SELECT 'PT-0009', '09:20:00', 'appointment', 'Recurring cough', '09:15:00', '09:35:00'
    UNION ALL SELECT 'PT-0010', '09:40:00', 'walkin',      'Minor injury dressing', '09:38:00', '09:58:00'
) a
JOIN patients p ON p.patient_code = a.code
JOIN doctors doc ON doc.doctor_code = 'DOC-001';

-- ---- 8C. OLDER PAST APPOINTMENTS (2-5 days ago, other departments) ----
INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, appointment_time, appointment_type, priority, status, reason, booked_at, checked_in_at, completed_at, cancelled_at)
SELECT p.patient_id, doc.doctor_id, doc.department_id,
       DATE_SUB(CURDATE(), INTERVAL a.days_ago DAY), a.appt_time, 'appointment', 'normal', a.status, a.reason,
       DATE_SUB(NOW(), INTERVAL (a.days_ago + 3) DAY),
       IF(a.status = 'completed', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL a.days_ago DAY), '09:00:00'), NULL),
       IF(a.status = 'completed', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL a.days_ago DAY), a.appt_time), NULL),
       IF(a.status = 'cancelled', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL a.days_ago DAY), '08:00:00'), NULL)
FROM (
    SELECT 'PT-0004' AS code, 'DOC-002' AS doc_code, 3 AS days_ago, '11:00:00' AS appt_time, 'completed' AS status, 'Chest pain follow-up' AS reason
    UNION ALL SELECT 'PT-0006', 'DOC-003', 2, '11:30:00', 'completed', 'Skin rash'
    UNION ALL SELECT 'PT-0007', 'DOC-004', 2, '12:00:00', 'no_show',   'Knee pain review'
    UNION ALL SELECT 'PT-0011', 'DOC-005', 4, '10:00:00', 'cancelled', 'Child vaccination'
    UNION ALL SELECT 'PT-0012', 'DOC-006', 5, '11:15:00', 'completed', 'Hearing check-up'
) a
JOIN patients p ON p.patient_code = a.code
JOIN doctors doc ON doc.doctor_code = a.doc_code;

-- ---------------------------------------------------------
-- 9. TOKENS
--    Generated for every TODAY appointment (matches the
--    "live queue" screen) plus the 3 YESTERDAY General
--    Medicine visits (feeds historical wait-time analytics).
--    token_number restarts at 1 per department per day.
-- ---------------------------------------------------------

-- ---- TODAY : General Medicine tokens 1-8 ----
INSERT INTO tokens (appointment_id, patient_id, doctor_id, department_id, token_number, token_date, token_type, priority, status, generated_at, called_at, served_at, cancelled_at)
SELECT ap.appointment_id, ap.patient_id, ap.doctor_id, ap.department_id, t.token_no, CURDATE(), ap.appointment_type, ap.priority, t.token_status,
       ap.booked_at,
       IF(t.called_time IS NULL, NULL, TIMESTAMP(CURDATE(), t.called_time)),
       IF(t.served_time IS NULL, NULL, TIMESTAMP(CURDATE(), t.served_time)),
       NULL
FROM appointments ap
JOIN patients pt ON pt.patient_id = ap.patient_id
JOIN (
    SELECT 'PT-0001' AS code, 1 AS token_no, 'completed' AS token_status, '09:00:00' AS called_time, '09:14:00' AS served_time
    UNION ALL SELECT 'PT-0002', 2, 'completed',  '09:16:00', '09:33:00'
    UNION ALL SELECT 'PT-0003', 3, 'completed',  '09:22:00', '09:40:00'
    UNION ALL SELECT 'PT-0004', 4, 'in_progress','10:12:00', NULL
    UNION ALL SELECT 'PT-0005', 5, 'waiting',    NULL,       NULL
    UNION ALL SELECT 'PT-0006', 6, 'waiting',    NULL,       NULL
    UNION ALL SELECT 'PT-0007', 7, 'no_show',    NULL,       NULL
    UNION ALL SELECT 'PT-0008', 8, 'waiting',    NULL,       NULL
) t ON t.code = pt.patient_code
WHERE ap.department_id = (SELECT doc.department_id FROM doctors doc WHERE doc.doctor_code = 'DOC-001')
  AND ap.appointment_date = CURDATE();

-- ---- TODAY : Cardiology tokens 1-4 ----
INSERT INTO tokens (appointment_id, patient_id, doctor_id, department_id, token_number, token_date, token_type, priority, status, generated_at, called_at, served_at, cancelled_at)
SELECT ap.appointment_id, ap.patient_id, ap.doctor_id, ap.department_id, t.token_no, CURDATE(), ap.appointment_type, ap.priority, t.token_status,
       ap.booked_at,
       IF(t.called_time IS NULL, NULL, TIMESTAMP(CURDATE(), t.called_time)),
       IF(t.served_time IS NULL, NULL, TIMESTAMP(CURDATE(), t.served_time)),
       IF(t.token_status = 'cancelled', DATE_SUB(NOW(), INTERVAL 20 HOUR), NULL)
FROM appointments ap
JOIN patients pt ON pt.patient_id = ap.patient_id
JOIN (
    SELECT 'PT-0009' AS code, 1 AS token_no, 'completed'  AS token_status, '10:00:00' AS called_time, '10:22:00' AS served_time
    UNION ALL SELECT 'PT-0010', 2, 'in_progress', '10:24:00', NULL
    UNION ALL SELECT 'PT-0011', 3, 'waiting',      NULL,       NULL
    UNION ALL SELECT 'PT-0012', 4, 'cancelled',    NULL,       NULL
) t ON t.code = pt.patient_code
WHERE ap.department_id = (SELECT doc.department_id FROM doctors doc WHERE doc.doctor_code = 'DOC-002')
  AND ap.appointment_date = CURDATE();

-- ---- TODAY : ENT tokens 1-2 ----
INSERT INTO tokens (appointment_id, patient_id, doctor_id, department_id, token_number, token_date, token_type, priority, status, generated_at, called_at, served_at, cancelled_at)
SELECT ap.appointment_id, ap.patient_id, ap.doctor_id, ap.department_id, t.token_no, CURDATE(), ap.appointment_type, ap.priority, t.token_status,
       ap.booked_at,
       IF(t.called_time IS NULL, NULL, TIMESTAMP(CURDATE(), t.called_time)),
       IF(t.served_time IS NULL, NULL, TIMESTAMP(CURDATE(), t.served_time)),
       NULL
FROM appointments ap
JOIN patients pt ON pt.patient_id = ap.patient_id
JOIN (
    SELECT 'PT-0001' AS code, 1 AS token_no, 'completed' AS token_status, '09:30:00' AS called_time, '09:45:00' AS served_time
    UNION ALL SELECT 'PT-0003', 2, 'waiting', NULL, NULL
) t ON t.code = pt.patient_code
WHERE ap.department_id = (SELECT doc.department_id FROM doctors doc WHERE doc.doctor_code = 'DOC-006')
  AND ap.appointment_date = CURDATE();

-- ---- YESTERDAY : General Medicine tokens 1-3 (history) ----
INSERT INTO tokens (appointment_id, patient_id, doctor_id, department_id, token_number, token_date, token_type, priority, status, generated_at, called_at, served_at, cancelled_at)
SELECT ap.appointment_id, ap.patient_id, ap.doctor_id, ap.department_id, t.token_no, DATE_SUB(CURDATE(), INTERVAL 1 DAY), ap.appointment_type, 'normal', 'completed',
       ap.booked_at,
       TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), t.called_time),
       TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), t.served_time),
       NULL
FROM appointments ap
JOIN patients pt ON pt.patient_id = ap.patient_id
JOIN (
    SELECT 'PT-0002' AS code, 1 AS token_no, '09:00:00' AS called_time, '09:15:00' AS served_time
    UNION ALL SELECT 'PT-0009', 2, '09:20:00', '09:35:00'
    UNION ALL SELECT 'PT-0010', 3, '09:40:00', '09:58:00'
) t ON t.code = pt.patient_code
WHERE ap.department_id = (SELECT doc.department_id FROM doctors doc WHERE doc.doctor_code = 'DOC-001')
  AND ap.appointment_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY);

-- ---------------------------------------------------------
-- 10. QUEUE STATUS  (one row per token, per UNIQUE(token_id))
-- ---------------------------------------------------------
INSERT INTO queue_status (token_id, current_status, queue_position, estimated_wait_minutes, checked_in_at, called_at, consultation_started_at, consultation_completed_at, no_show_at, late_arrival_at)
SELECT tk.token_id, q.current_status, q.queue_position, q.estimated_wait_minutes,
       ap.checked_in_at, tk.called_at,
       IF(q.consult_started_time IS NULL, NULL, TIMESTAMP(tk.token_date, q.consult_started_time)),
       IF(q.consult_ended_time   IS NULL, NULL, TIMESTAMP(tk.token_date, q.consult_ended_time)),
       IF(q.no_show, TIMESTAMP(tk.token_date, '10:45:00'), NULL),
       NULL
FROM tokens tk
JOIN patients pt ON pt.patient_id = tk.patient_id
JOIN appointments ap ON ap.appointment_id = tk.appointment_id
JOIN (
    -- General Medicine, today
    SELECT 'PT-0001' AS code, 1 AS token_no, 'completed'   AS current_status, NULL AS queue_position, NULL AS estimated_wait_minutes, '09:02:00' AS consult_started_time, '09:14:00' AS consult_ended_time, FALSE AS no_show
    UNION ALL SELECT 'PT-0002', 2, 'completed',   NULL, NULL, '09:17:00', '09:33:00', FALSE
    UNION ALL SELECT 'PT-0003', 3, 'completed',   NULL, NULL, '09:23:00', '09:40:00', FALSE
    UNION ALL SELECT 'PT-0004', 4, 'in_progress', 0,    0,    '10:15:00', NULL,       FALSE
    UNION ALL SELECT 'PT-0005', 5, 'waiting',     2,    20,   NULL,       NULL,       FALSE
    UNION ALL SELECT 'PT-0006', 6, 'waiting',     3,    35,   NULL,       NULL,       FALSE
    UNION ALL SELECT 'PT-0007', 7, 'no_show',     NULL, NULL, NULL,       NULL,       TRUE
    UNION ALL SELECT 'PT-0008', 8, 'waiting',     1,    5,    NULL,       NULL,       FALSE
) q ON q.code = pt.patient_code AND q.token_no = tk.token_number
WHERE tk.token_date = CURDATE()
  AND tk.department_id = (SELECT doc.department_id FROM doctors doc WHERE doc.doctor_code = 'DOC-001');

INSERT INTO queue_status (token_id, current_status, queue_position, estimated_wait_minutes, checked_in_at, called_at, consultation_started_at, consultation_completed_at, no_show_at, late_arrival_at)
SELECT tk.token_id, q.current_status, q.queue_position, q.estimated_wait_minutes,
       ap.checked_in_at, tk.called_at,
       IF(q.consult_started_time IS NULL, NULL, TIMESTAMP(tk.token_date, q.consult_started_time)),
       IF(q.consult_ended_time   IS NULL, NULL, TIMESTAMP(tk.token_date, q.consult_ended_time)),
       NULL, NULL
FROM tokens tk
JOIN patients pt ON pt.patient_id = tk.patient_id
JOIN appointments ap ON ap.appointment_id = tk.appointment_id
JOIN (
    -- Cardiology, today
    SELECT 'PT-0009' AS code, 1 AS token_no, 'completed'   AS current_status, NULL AS queue_position, NULL AS estimated_wait_minutes, '10:02:00' AS consult_started_time, '10:22:00' AS consult_ended_time
    UNION ALL SELECT 'PT-0010', 2, 'in_progress', 0,    0,  '10:25:00', NULL
    UNION ALL SELECT 'PT-0011', 3, 'waiting',     1,    20, NULL,       NULL
    UNION ALL SELECT 'PT-0012', 4, 'cancelled',   NULL, NULL, NULL,     NULL
) q ON q.code = pt.patient_code AND q.token_no = tk.token_number
WHERE tk.token_date = CURDATE()
  AND tk.department_id = (SELECT doc.department_id FROM doctors doc WHERE doc.doctor_code = 'DOC-002');

INSERT INTO queue_status (token_id, current_status, queue_position, estimated_wait_minutes, checked_in_at, called_at, consultation_started_at, consultation_completed_at, no_show_at, late_arrival_at)
SELECT tk.token_id, q.current_status, q.queue_position, q.estimated_wait_minutes,
       ap.checked_in_at, tk.called_at,
       IF(q.consult_started_time IS NULL, NULL, TIMESTAMP(tk.token_date, q.consult_started_time)),
       IF(q.consult_ended_time   IS NULL, NULL, TIMESTAMP(tk.token_date, q.consult_ended_time)),
       NULL, NULL
FROM tokens tk
JOIN patients pt ON pt.patient_id = tk.patient_id
JOIN appointments ap ON ap.appointment_id = tk.appointment_id
JOIN (
    -- ENT, today
    SELECT 'PT-0001' AS code, 1 AS token_no, 'completed' AS current_status, NULL AS queue_position, NULL AS estimated_wait_minutes, '09:31:00' AS consult_started_time, '09:45:00' AS consult_ended_time
    UNION ALL SELECT 'PT-0003', 2, 'waiting', 1, 15, NULL, NULL
) q ON q.code = pt.patient_code AND q.token_no = tk.token_number
WHERE tk.token_date = CURDATE()
  AND tk.department_id = (SELECT doc.department_id FROM doctors doc WHERE doc.doctor_code = 'DOC-006');

INSERT INTO queue_status (token_id, current_status, queue_position, estimated_wait_minutes, checked_in_at, called_at, consultation_started_at, consultation_completed_at, no_show_at, late_arrival_at)
SELECT tk.token_id, 'completed', NULL, NULL,
       ap.checked_in_at, tk.called_at,
       TIMESTAMP(tk.token_date, q.consult_started_time),
       TIMESTAMP(tk.token_date, q.consult_ended_time),
       NULL, NULL
FROM tokens tk
JOIN patients pt ON pt.patient_id = tk.patient_id
JOIN appointments ap ON ap.appointment_id = tk.appointment_id
JOIN (
    -- General Medicine, yesterday
    SELECT 'PT-0002' AS code, 1 AS token_no, '09:02:00' AS consult_started_time, '09:15:00' AS consult_ended_time
    UNION ALL SELECT 'PT-0009', 2, '09:21:00', '09:35:00'
    UNION ALL SELECT 'PT-0010', 3, '09:41:00', '09:58:00'
) q ON q.code = pt.patient_code AND q.token_no = tk.token_number
WHERE tk.token_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY);

-- ---------------------------------------------------------
-- 11. CONSULTATIONS
--     One row per token that was actually seen by a doctor
--     (completed or currently in_progress). No-shows and
--     cancellations never reach a consultation.
-- ---------------------------------------------------------
INSERT INTO consultations (token_id, patient_id, doctor_id, started_at, ended_at, diagnosis, notes, consultation_status)
SELECT qs.token_id, tk.patient_id, tk.doctor_id,
       qs.consultation_started_at, qs.consultation_completed_at,
       c.diagnosis, c.notes,
       IF(qs.consultation_completed_at IS NULL, 'in_progress', 'completed')
FROM queue_status qs
JOIN tokens tk ON tk.token_id = qs.token_id
JOIN patients pt ON pt.patient_id = tk.patient_id
JOIN doctors doc ON doc.doctor_id = tk.doctor_id
JOIN (
    -- doc_code disambiguates token_no, since token numbering restarts per department
    SELECT 'PT-0001' AS code, 'DOC-001' AS doc_code, CURDATE() AS token_date, 1 AS token_no, 'Viral fever'              AS diagnosis, 'Prescribed antipyretics and rest for 3 days.'        AS notes
    UNION ALL SELECT 'PT-0002', 'DOC-001', CURDATE(), 2, 'Healthy, no concerns',       'Routine check-up completed, all vitals normal.'
    UNION ALL SELECT 'PT-0003', 'DOC-001', CURDATE(), 3, 'Mild gastritis',             'Advised bland diet and antacids for 5 days.'
    UNION ALL SELECT 'PT-0004', 'DOC-001', CURDATE(), 4, 'Tension headache (pending)', 'Consultation in progress, awaiting BP reading.'
    UNION ALL SELECT 'PT-0009', 'DOC-002', CURDATE(), 1, 'Stable angina',              'ECG normal, prescribed beta blockers, follow-up in 2 weeks.'
    UNION ALL SELECT 'PT-0010', 'DOC-002', CURDATE(), 2, 'Hypertension (pending)',     'Consultation in progress, monitoring BP.'
    UNION ALL SELECT 'PT-0001', 'DOC-006', CURDATE(), 1, 'Mild ear infection',         'Prescribed ear drops for 7 days.'
    UNION ALL SELECT 'PT-0002', 'DOC-001', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 1, 'Healthy, no concerns', 'Routine check-up completed.'
    UNION ALL SELECT 'PT-0009', 'DOC-001', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 2, 'Persistent dry cough',  'Prescribed cough syrup, advised follow-up if not improved in a week.'
    UNION ALL SELECT 'PT-0010', 'DOC-001', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 3, 'Minor laceration',      'Wound cleaned and dressed, tetanus shot given.'
) c ON c.code = pt.patient_code AND c.doc_code = doc.doctor_code AND c.token_date = tk.token_date AND c.token_no = tk.token_number;

-- ---------------------------------------------------------
-- 12. NOTIFICATIONS
-- ---------------------------------------------------------
INSERT INTO notifications (user_id, patient_id, title, message, notification_type, is_read, read_at)
SELECT u.user_id, p.patient_id, n.title, n.message, n.notification_type, n.is_read,
       IF(n.is_read, DATE_SUB(NOW(), INTERVAL 1 HOUR), NULL)
FROM patients p
LEFT JOIN users u ON u.user_id = p.user_id
JOIN (
    SELECT 'PT-0005' AS code, 'You''re Next!' AS title, 'Please head to General Medicine (Dr. Sharma). Estimated wait: ~20 min.' AS message, 'turn_near' AS notification_type, FALSE AS is_read
    UNION ALL SELECT 'PT-0008', 'Token Confirmed', 'Your emergency walk-in token #8 for General Medicine has been generated.', 'token_confirmation', TRUE
    UNION ALL SELECT 'PT-0007', 'Missed Turn', 'You were marked as a no-show for your 10:30 AM General Medicine appointment.', 'no_show_alert', TRUE
    UNION ALL SELECT 'PT-0012', 'Appointment Cancelled', 'Your Cardiology appointment with Dr. Mehta has been cancelled as requested.', 'cancellation', TRUE
    UNION ALL SELECT 'PT-0010', 'Please Proceed to Consultation', 'Dr. Mehta is ready to see you now in Cardiology.', 'turn_call', TRUE
    UNION ALL SELECT 'PT-0003', 'Thank You for Visiting', 'Thanks for visiting City Care Hospital today. Feel better soon!', 'general', FALSE
) n ON n.code = p.patient_code;

-- =========================================================
-- END OF SEED DATA
-- =========================================================