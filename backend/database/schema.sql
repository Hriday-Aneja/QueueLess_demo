-- =========================================================
-- QueueLess - Smart Hospital Queue Management System
-- Database Schema
-- MySQL 8.x
-- =========================================================

CREATE DATABASE IF NOT EXISTS queueless
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE queueless;

-- =========================================================
-- 1. USERS
-- =========================================================

CREATE TABLE users (
    user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20) UNIQUE,

    password_hash VARCHAR(255) NOT NULL,

    role VARCHAR(20) NOT NULL DEFAULT 'patient',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_users_role (role),
    INDEX idx_users_active (is_active)
);


-- =========================================================
-- 2. CLINICS
-- =========================================================

CREATE TABLE clinics (
    clinic_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    clinic_name VARCHAR(150) NOT NULL,
    address VARCHAR(255),
    phone VARCHAR(20),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_clinic_name (clinic_name)
);


-- =========================================================
-- 3. DEPARTMENTS
-- =========================================================

CREATE TABLE departments (
    department_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    clinic_id INT UNSIGNED NOT NULL,
    department_name VARCHAR(100) NOT NULL,
    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_department_clinic
        FOREIGN KEY (clinic_id)
        REFERENCES clinics(clinic_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    UNIQUE KEY uq_department_clinic_name
        (clinic_id, department_name),

    INDEX idx_departments_clinic (clinic_id)
);


-- =========================================================
-- 4. PATIENTS
-- =========================================================

CREATE TABLE patients (
    patient_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id INT UNSIGNED NULL,

    patient_code VARCHAR(30) NOT NULL UNIQUE,

    date_of_birth DATE,
    gender VARCHAR(20),

    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_patient_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    INDEX idx_patients_user (user_id)
);


-- =========================================================
-- 5. DOCTORS
-- =========================================================

CREATE TABLE doctors (
    doctor_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id INT UNSIGNED NULL,
    department_id INT UNSIGNED NOT NULL,

    doctor_code VARCHAR(30) NOT NULL UNIQUE,

    specialization VARCHAR(100),
    consultation_fee DECIMAL(10,2) DEFAULT 0.00,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_doctor_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT fk_doctor_department
        FOREIGN KEY (department_id)
        REFERENCES departments(department_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_doctors_department (department_id),
    INDEX idx_doctors_active (is_active)
);


-- =========================================================
-- 6. DOCTOR SCHEDULES
-- =========================================================

CREATE TABLE doctor_schedules (
    schedule_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    doctor_id INT UNSIGNED NOT NULL,

    day_of_week TINYINT UNSIGNED NOT NULL,

    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    slot_duration_minutes INT UNSIGNED NOT NULL DEFAULT 15,

    max_appointments INT UNSIGNED DEFAULT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_schedule_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT chk_schedule_day
        CHECK (day_of_week BETWEEN 0 AND 6),

    CONSTRAINT chk_schedule_time
        CHECK (end_time > start_time),

    INDEX idx_schedule_doctor_day
        (doctor_id, day_of_week),

    UNIQUE KEY uq_doctor_schedule
        (doctor_id, day_of_week, start_time, end_time)
);


-- =========================================================
-- 7. APPOINTMENTS
-- =========================================================

CREATE TABLE appointments (
    appointment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    patient_id INT UNSIGNED NOT NULL,
    doctor_id INT UNSIGNED NOT NULL,
    department_id INT UNSIGNED NOT NULL,

    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,

    appointment_type VARCHAR(20) NOT NULL DEFAULT 'appointment',

    priority VARCHAR(20) NOT NULL DEFAULT 'normal',

    status VARCHAR(30) NOT NULL DEFAULT 'scheduled',

    reason VARCHAR(255),

    booked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    checked_in_at DATETIME NULL,
    completed_at DATETIME NULL,
    cancelled_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_appointment_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(patient_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_appointment_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_appointment_department
        FOREIGN KEY (department_id)
        REFERENCES departments(department_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_appointments_date
        (appointment_date),

    INDEX idx_appointments_doctor_date
        (doctor_id, appointment_date),

    INDEX idx_appointments_patient
        (patient_id),

    INDEX idx_appointments_status
        (status),

    INDEX idx_appointments_department_date
        (department_id, appointment_date)
);


-- =========================================================
-- 8. TOKENS
-- =========================================================

CREATE TABLE tokens (
    token_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    appointment_id INT UNSIGNED NULL,

    patient_id INT UNSIGNED NOT NULL,
    doctor_id INT UNSIGNED NOT NULL,
    department_id INT UNSIGNED NOT NULL,

    token_number INT UNSIGNED NOT NULL,

    token_date DATE NOT NULL,

    token_type VARCHAR(20) NOT NULL DEFAULT 'appointment',

    priority VARCHAR(20) NOT NULL DEFAULT 'normal',

    status VARCHAR(30) NOT NULL DEFAULT 'waiting',

    generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    called_at DATETIME NULL,
    served_at DATETIME NULL,
    cancelled_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_token_appointment
        FOREIGN KEY (appointment_id)
        REFERENCES appointments(appointment_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT fk_token_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(patient_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_token_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_token_department
        FOREIGN KEY (department_id)
        REFERENCES departments(department_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    UNIQUE KEY uq_token_per_department_day
        (department_id, token_date, token_number),

    INDEX idx_tokens_queue
        (doctor_id, token_date, status),

    INDEX idx_tokens_department
        (department_id, token_date, status),

    INDEX idx_tokens_patient
        (patient_id)
);


-- =========================================================
-- 9. QUEUE STATUS
-- =========================================================

CREATE TABLE queue_status (
    queue_status_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    token_id INT UNSIGNED NOT NULL UNIQUE,

    current_status VARCHAR(30) NOT NULL DEFAULT 'waiting',

    queue_position INT UNSIGNED NULL,

    estimated_wait_minutes INT UNSIGNED NULL,

    checked_in_at DATETIME NULL,
    called_at DATETIME NULL,
    consultation_started_at DATETIME NULL,
    consultation_completed_at DATETIME NULL,

    no_show_at DATETIME NULL,
    late_arrival_at DATETIME NULL,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_queue_token
        FOREIGN KEY (token_id)
        REFERENCES tokens(token_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX idx_queue_status
        (current_status),

    INDEX idx_queue_position
        (queue_position)
);


-- =========================================================
-- 10. CONSULTATIONS
-- =========================================================

CREATE TABLE consultations (
    consultation_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    token_id INT UNSIGNED NOT NULL,
    patient_id INT UNSIGNED NOT NULL,
    doctor_id INT UNSIGNED NOT NULL,

    started_at DATETIME NOT NULL,
    ended_at DATETIME NULL,

    diagnosis TEXT,
    notes TEXT,

    consultation_status VARCHAR(30) NOT NULL DEFAULT 'in_progress',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_consultation_token
        FOREIGN KEY (token_id)
        REFERENCES tokens(token_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_consultation_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(patient_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_consultation_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_consultation_doctor
        (doctor_id),

    INDEX idx_consultation_patient
        (patient_id),

    INDEX idx_consultation_dates
        (started_at, ended_at)
);


-- =========================================================
-- 11. NOTIFICATIONS
-- =========================================================

CREATE TABLE notifications (
    notification_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id INT UNSIGNED NULL,
    patient_id INT UNSIGNED NULL,

    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,

    notification_type VARCHAR(50) NOT NULL DEFAULT 'general',

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME NULL,

    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_notification_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(patient_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX idx_notifications_user
        (user_id, is_read),

    INDEX idx_notifications_patient
        (patient_id, is_read)
);


-- =========================================================
-- 12. QUEUE RULES
-- =========================================================

CREATE TABLE queue_rules (
    rule_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    clinic_id INT UNSIGNED NULL,
    department_id INT UNSIGNED NULL,

    grace_period_minutes INT UNSIGNED NOT NULL DEFAULT 10,

    average_consultation_minutes INT UNSIGNED NOT NULL DEFAULT 15,

    appointment_priority INT NOT NULL DEFAULT 10,
    walkin_priority INT NOT NULL DEFAULT 5,

    no_show_after_minutes INT UNSIGNED NOT NULL DEFAULT 15,

    late_arrival_rule VARCHAR(30) NOT NULL DEFAULT 'requeue',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_rule_clinic
        FOREIGN KEY (clinic_id)
        REFERENCES clinics(clinic_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_rule_department
        FOREIGN KEY (department_id)
        REFERENCES departments(department_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX idx_rules_clinic
        (clinic_id),

    INDEX idx_rules_department
        (department_id),

    INDEX idx_rules_active
        (is_active)
);


-- =========================================================
-- END OF SCHEMA
-- =========================================================