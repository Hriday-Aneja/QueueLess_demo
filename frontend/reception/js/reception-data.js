/* ==========================================================================
   QueueLess — Reception Module Mock Data Layer
   frontend/reception/js/reception-data.js

   Pure front-end mock data. No fetch(), no backend/api calls. Field names
   mirror backend/database/schema.sql (clinics, departments, doctors,
   patients, appointments, tokens) and the status vocabulary of
   backend/core/QueueStateMachine.php, so this layer can later be swapped
   for real API calls without touching any page markup.

   Exposes two globals used by reception.js and the page scripts:
     - ReceptionMockData : mock dataset + query helpers + local mutations
     - MockAuth          : login / logout / getSession backed by localStorage

   Persistence
     - Session : localStorage key  queueless_reception_session
     - Queue   : localStorage key  queueless_reception_state_v1
       Walk-ins, check-ins, no-shows, etc. are written here so every
       reception page sees the same queue. The state is re-seeded
       automatically each new day (tokens are always "today"), and can be
       reset manually with ReceptionMockData.resetDemoData().

   Demo credentials
     reception@queueless.com  /  reception123
   ========================================================================== */

(function (global) {
  'use strict';

  var SESSION_KEY = 'queueless_reception_session';
  var STATE_KEY = 'queueless_reception_state_v1';

  // Statuses of a token that is still waiting to be seen (not yet consulting).
  var PRE_CONSULT = ['waiting', 'next', 'arriving', 'checked_in', 'requeue'];
  // Same ranking as backend/core/QueueRules.php URGENCY_RANK.
  var URGENCY_RANK = { emergency: 0, priority: 1, normal: 2 };
  var VALID_PRIORITIES = ['normal', 'priority', 'emergency'];

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = '0' + s;
    return s;
  }

  function localIso(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
  }

  function todayIso() {
    return localIso(new Date());
  }

  function addDays(iso, days) {
    var d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return localIso(d);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function digitsOnly(value) {
    return String(value || '').replace(/[^0-9]/g, '');
  }

  function ok(data) {
    return { success: true, data: data || {} };
  }

  function fail(message, errors) {
    var out = { success: false, message: message };
    if (errors) out.errors = errors;
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 1. Mock reception user (demo credentials)
   * ------------------------------------------------------------------ */

  var MOCK_RECEPTION_ACCOUNT = {
    email: 'reception@queueless.com',
    password: 'reception123', // demo only — never do this with real auth
    profile: {
      user_id: 601,
      role: 'reception',
      full_name: 'Ananya Bose',
      email: 'reception@queueless.com',
      phone: '+91 98765 40100',
      clinic_id: 1,
      avatar_initials: 'AB',
      is_active: true
    }
  };

  /* ------------------------------------------------------------------ *
   * 2. Static reference data: clinics, departments, doctors
   * ------------------------------------------------------------------ */

  var MOCK_CLINICS = [
    { clinic_id: 1, clinic_name: 'QueueLess Health Clinic \u2014 Sector 12', is_active: true },
    { clinic_id: 2, clinic_name: 'QueueLess City Hospital \u2014 MG Road', is_active: true }
  ];

  var MOCK_DEPARTMENTS = [
    { department_id: 1, department_name: 'General Medicine' },
    { department_id: 2, department_name: 'Cardiology' },
    { department_id: 3, department_name: 'Pediatrics' },
    { department_id: 4, department_name: 'Orthopedics' },
    { department_id: 5, department_name: 'Dermatology' }
  ];

  // doctor_id 101 is the same doctor as frontend/doctor (Dr. Anjali Mehra).
  var MOCK_DOCTORS = [
    { doctor_id: 101, doctor_code: 'DOC-101', full_name: 'Dr. Anjali Mehra', specialization: 'General Medicine', department_id: 1, clinic_id: 1, avg_consultation_minutes: 10, is_active: true },
    { doctor_id: 102, doctor_code: 'DOC-102', full_name: 'Dr. Rohan Kapoor', specialization: 'General Medicine', department_id: 1, clinic_id: 1, avg_consultation_minutes: 12, is_active: true },
    { doctor_id: 103, doctor_code: 'DOC-103', full_name: 'Dr. Priya Nair', specialization: 'Cardiology', department_id: 2, clinic_id: 1, avg_consultation_minutes: 15, is_active: true },
    { doctor_id: 104, doctor_code: 'DOC-104', full_name: 'Dr. Suresh Iyer', specialization: 'Pediatrics', department_id: 3, clinic_id: 1, avg_consultation_minutes: 10, is_active: true },
    { doctor_id: 105, doctor_code: 'DOC-105', full_name: 'Dr. Vivek Sharma', specialization: 'Orthopedics', department_id: 4, clinic_id: 2, avg_consultation_minutes: 15, is_active: true },
    { doctor_id: 106, doctor_code: 'DOC-106', full_name: 'Dr. Kavita Rao', specialization: 'Dermatology', department_id: 5, clinic_id: 2, avg_consultation_minutes: 8, is_active: true }
  ].map(function (d) {
    d.department_name = departmentName(d.department_id);
    return d;
  });

  function departmentName(id) {
    for (var i = 0; i < MOCK_DEPARTMENTS.length; i++) {
      if (MOCK_DEPARTMENTS[i].department_id === id) return MOCK_DEPARTMENTS[i].department_name;
    }
    return '';
  }

  function findDoctor(id) {
    id = Number(id);
    for (var i = 0; i < MOCK_DOCTORS.length; i++) {
      if (MOCK_DOCTORS[i].doctor_id === id) return MOCK_DOCTORS[i];
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * 3. Seed data: patients, appointments, today's queue (tokens)
   *    patient ids 7001–7010 match frontend/doctor mock data.
   * ------------------------------------------------------------------ */

  var PATIENT_SEED = [
    [7001, 'Ramesh Kulkarni', 54, 'Male'],
    [7002, 'Sunita Rao', 41, 'Female'],
    [7003, 'Arjun Verma', 29, 'Male'],
    [7004, 'Fatima Sheikh', 63, 'Female'],
    [7005, 'Vikram Singh', 35, 'Male'],
    [7006, 'Neha Joshi', 47, 'Female'],
    [7007, 'Deepak Nair', 52, 'Male'],
    [7008, 'Pooja Iyer', 33, 'Female'],
    [7009, 'Karan Malhotra', 45, 'Male'],
    [7010, 'Meera Pillai', 38, 'Female'],
    [7011, 'Anil Gupta', 58, 'Male'],
    [7012, 'Lakshmi Menon', 49, 'Female'],
    [7013, 'Rahul Bhatia', 31, 'Male'],
    [7014, 'Sneha Desai', 26, 'Female'],
    [7015, 'Harish Patel', 66, 'Male'],
    [7016, 'Aditi Sharma', 44, 'Female'],
    [7017, 'Manoj Tiwari', 57, 'Male'],
    [7018, 'Divya Reddy', 39, 'Female'],
    [7019, 'Ishaan Kapoor', 7, 'Male'],
    [7020, 'Tara Menon', 5, 'Female'],
    [7021, 'Aarav Jain', 9, 'Male'],
    [7022, 'Suman Das', 61, 'Male'],
    [7023, 'Nikhil Rao', 34, 'Male'],
    [7024, 'Preeti Saxena', 42, 'Female'],
    [7025, 'Zoya Ahmed', 28, 'Female'],
    [7026, 'Gopal Krishnan', 72, 'Male']
  ];

  function apptStatusFor(tokenStatus) {
    switch (tokenStatus) {
      case 'completed': return 'completed';
      case 'cancelled': return 'cancelled';
      case 'no_show': return 'no_show';
      case 'checked_in':
      case 'consulting': return 'checked_in';
      default: return 'scheduled';
    }
  }

  function buildSeedState(today) {
    var tomorrow = addDays(today, 1);
    var inTwoDays = addDays(today, 2);
    var twoDaysAgo = addDays(today, -2);
    var threeDaysAgo = addDays(today, -3);

    var patients = PATIENT_SEED.map(function (p) {
      var n = p[0] - 7000;
      return {
        patient_id: p[0],
        patient_code: 'PT-' + pad(n, 4),
        full_name: p[1],
        age: p[2],
        gender: p[3],
        phone: '+91 98765 4' + pad(n, 4)
      };
    });

    var tokens = [];
    var appointments = [];
    var nextApptId = 5501;

    // o: { id, doctor, number, patient, type, priority, status, date, time, reason }
    function addToken(o) {
      var tok = {
        token_id: o.id,
        token_number: o.number,
        doctor_id: o.doctor,
        patient_id: o.patient,
        appointment_id: null,
        token_type: o.type,
        priority: o.priority || 'normal',
        current_status: o.status,
        token_date: o.date || today,
        appointment_time: o.time || null,
        reason: o.reason || '',
        order_key: o.number
      };
      if (o.type === 'appointment') {
        var appt = {
          appointment_id: nextApptId++,
          patient_id: o.patient,
          doctor_id: o.doctor,
          appointment_date: tok.token_date,
          appointment_time: tok.appointment_time,
          appointment_type: 'appointment',
          status: apptStatusFor(o.status),
          reason: tok.reason,
          token_id: tok.token_id
        };
        tok.appointment_id = appt.appointment_id;
        appointments.push(appt);
      }
      tokens.push(tok);
    }

    // ---- Doctor 101 · General Medicine (same queue as the doctor module)
    addToken({ id: 9001, doctor: 101, number: 1, patient: 7001, type: 'appointment', status: 'completed', time: '09:00', reason: 'Follow-up: blood pressure review' });
    addToken({ id: 9002, doctor: 101, number: 2, patient: 7002, type: 'appointment', status: 'consulting', time: '09:20', reason: 'Persistent cough and mild fever' });
    addToken({ id: 9003, doctor: 101, number: 3, patient: 7003, type: 'appointment', status: 'waiting', time: '09:40', reason: 'General check-up' });
    addToken({ id: 9004, doctor: 101, number: 4, patient: 7004, type: 'walkin', status: 'waiting', reason: 'Joint pain, difficulty walking' });
    addToken({ id: 9005, doctor: 101, number: 5, patient: 7005, type: 'appointment', status: 'checked_in', time: '10:20', reason: 'Skin rash, needs assessment' });
    addToken({ id: 9006, doctor: 101, number: 6, patient: 7006, type: 'appointment', status: 'no_show', time: '10:40', reason: 'Annual wellness check' });

    // ---- Doctor 102 · General Medicine
    addToken({ id: 9101, doctor: 102, number: 1, patient: 7011, type: 'appointment', status: 'completed', time: '09:00', reason: 'Cholesterol review' });
    addToken({ id: 9102, doctor: 102, number: 2, patient: 7012, type: 'appointment', status: 'consulting', time: '09:15', reason: 'Recurring headaches' });
    addToken({ id: 9103, doctor: 102, number: 3, patient: 7013, type: 'appointment', status: 'waiting', time: '09:30', reason: 'Seasonal allergies' });
    addToken({ id: 9104, doctor: 102, number: 4, patient: 7014, type: 'walkin', status: 'waiting', reason: 'Stomach ache since morning' });

    // ---- Doctor 103 · Cardiology (includes an emergency walk-in and an "on the way" patient)
    addToken({ id: 9201, doctor: 103, number: 1, patient: 7015, type: 'appointment', status: 'consulting', time: '09:00', reason: 'Post-angioplasty review' });
    addToken({ id: 9202, doctor: 103, number: 2, patient: 7016, type: 'appointment', status: 'waiting', time: '09:30', reason: 'Palpitations' });
    addToken({ id: 9203, doctor: 103, number: 3, patient: 7017, type: 'walkin', priority: 'emergency', status: 'waiting', reason: 'Chest tightness' });
    addToken({ id: 9204, doctor: 103, number: 4, patient: 7018, type: 'appointment', status: 'arriving', time: '10:00', reason: 'ECG follow-up' });

    // ---- Doctor 104 · Pediatrics
    addToken({ id: 9301, doctor: 104, number: 1, patient: 7019, type: 'appointment', status: 'completed', time: '09:00', reason: 'Vaccination' });
    addToken({ id: 9302, doctor: 104, number: 2, patient: 7020, type: 'appointment', status: 'waiting', time: '09:20', reason: 'Fever for two days' });
    addToken({ id: 9303, doctor: 104, number: 3, patient: 7021, type: 'appointment', status: 'cancelled', time: '09:40', reason: 'Growth check' });

    // ---- Doctor 105 · Orthopedics (clinic 2)
    addToken({ id: 9401, doctor: 105, number: 1, patient: 7022, type: 'appointment', status: 'consulting', time: '10:00', reason: 'Knee replacement follow-up' });
    addToken({ id: 9402, doctor: 105, number: 2, patient: 7023, type: 'appointment', status: 'waiting', time: '10:20', reason: 'Shoulder pain' });
    addToken({ id: 9403, doctor: 105, number: 3, patient: 7024, type: 'walkin', status: 'waiting', reason: 'Twisted ankle' });

    // ---- Doctor 106 · Dermatology has no tokens today (idle doctor), only future ones below.

    // ---- Upcoming / past appointments (not part of today's queue)
    addToken({ id: 9501, doctor: 101, number: 1, patient: 7007, type: 'appointment', status: 'waiting', date: tomorrow, time: '09:30', reason: 'Diabetes management review' });
    addToken({ id: 9502, doctor: 101, number: 2, patient: 7008, type: 'appointment', status: 'waiting', date: tomorrow, time: '11:00', reason: 'New patient consultation' });
    addToken({ id: 9503, doctor: 101, number: 1, patient: 7009, type: 'appointment', status: 'waiting', date: inTwoDays, time: '10:15', reason: 'Post-surgery follow-up' });
    addToken({ id: 9504, doctor: 101, number: 1, patient: 7003, type: 'appointment', status: 'completed', date: twoDaysAgo, time: '09:40', reason: 'General check-up' });
    addToken({ id: 9505, doctor: 101, number: 1, patient: 7010, type: 'appointment', status: 'cancelled', date: threeDaysAgo, time: '15:00', reason: 'Routine dental referral' });
    addToken({ id: 9506, doctor: 106, number: 1, patient: 7025, type: 'appointment', status: 'waiting', date: tomorrow, time: '10:00', reason: 'Acne consultation' });
    addToken({ id: 9507, doctor: 103, number: 1, patient: 7026, type: 'appointment', status: 'waiting', date: tomorrow, time: '09:00', reason: 'Blood pressure check' });

    var state = {
      seedDate: today,
      patients: patients,
      tokens: tokens,
      appointments: appointments
    };

    // Make the seeded "next" markers consistent with the ordering rules.
    MOCK_DOCTORS.forEach(function (d) {
      promote(state, d.doctor_id, today);
    });

    return state;
  }

  /* ------------------------------------------------------------------ *
   * 4. State load / save (localStorage-backed, in-memory fallback)
   * ------------------------------------------------------------------ */

  var memoryState = null;

  function readStorage() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function save(state) {
    memoryState = state;
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) { /* storage unavailable — in-memory copy still works */ }
  }

  function load() {
    var today = todayIso();
    var state = readStorage();
    if (!state && memoryState && memoryState.seedDate === today) state = memoryState;
    if (!state || state.seedDate !== today) {
      state = buildSeedState(today);
      save(state);
    }
    memoryState = state;
    return state;
  }

  /* ------------------------------------------------------------------ *
   * 5. Queue model (ordering, position, ETA) — deliberately small.
   *    This only exists so the demo feels alive; it is not the real
   *    QueueEngine.
   * ------------------------------------------------------------------ */

  function compareTokens(a, b) {
    var ra = URGENCY_RANK[a.priority] !== undefined ? URGENCY_RANK[a.priority] : URGENCY_RANK.normal;
    var rb = URGENCY_RANK[b.priority] !== undefined ? URGENCY_RANK[b.priority] : URGENCY_RANK.normal;
    if (ra !== rb) return ra - rb;
    if (a.order_key !== b.order_key) return a.order_key - b.order_key;
    return a.token_number - b.token_number;
  }

  function tokensFor(state, doctorId, date) {
    doctorId = Number(doctorId);
    return state.tokens.filter(function (t) {
      return t.doctor_id === doctorId && t.token_date === date;
    });
  }

  function isPreConsult(t) {
    return PRE_CONSULT.indexOf(t.current_status) !== -1;
  }

  // Exactly one token per doctor/day is marked "next": the head of the line,
  // provided the head hasn't already checked in / started arriving.
  function promote(state, doctorId, date) {
    var line = tokensFor(state, doctorId, date).filter(isPreConsult).sort(compareTokens);
    line.forEach(function (t) {
      if (t.current_status === 'next' || t.current_status === 'requeue') t.current_status = 'waiting';
    });
    if (line.length && line[0].current_status === 'waiting') {
      line[0].current_status = 'next';
    }
  }

  function findToken(state, tokenId) {
    tokenId = Number(tokenId);
    for (var i = 0; i < state.tokens.length; i++) {
      if (state.tokens[i].token_id === tokenId) return state.tokens[i];
    }
    return null;
  }

  function findPatient(state, patientId) {
    patientId = Number(patientId);
    for (var i = 0; i < state.patients.length; i++) {
      if (state.patients[i].patient_id === patientId) return state.patients[i];
    }
    return null;
  }

  function syncAppointment(state, token) {
    if (!token.appointment_id) return;
    for (var i = 0; i < state.appointments.length; i++) {
      if (state.appointments[i].appointment_id === token.appointment_id) {
        state.appointments[i].status = apptStatusFor(token.current_status);
      }
    }
  }

  function toRow(state, t, pos) {
    var d = findDoctor(t.doctor_id) || {};
    var p = findPatient(state, t.patient_id) || {};
    return {
      token_id: t.token_id,
      token_number: t.token_number,
      patient_id: t.patient_id,
      patient_name: p.full_name || null,
      patient_phone: p.phone || null,
      doctor_id: t.doctor_id,
      doctor_code: d.doctor_code || null,
      specialization: d.specialization || null,
      department_name: d.department_name || null,
      token_type: t.token_type,
      priority: t.priority,
      current_status: t.current_status,
      token_date: t.token_date,
      appointment_date: t.token_date,
      appointment_time: t.appointment_time,
      reason: t.reason,
      queue_position: pos ? pos.position : null,
      patients_ahead: pos ? pos.ahead : null,
      estimated_wait_minutes: pos ? pos.ahead * (d.avg_consultation_minutes || 10) : null
    };
  }

  // Ordered rows for one doctor/day: consulting first, then the waiting line
  // (with position + ETA), then everything else (completed, no-show, ...).
  function computeQueue(state, doctorId, date) {
    var day = tokensFor(state, doctorId, date);
    var consulting = day.filter(function (t) { return t.current_status === 'consulting'; });
    var line = day.filter(isPreConsult).sort(compareTokens);
    var rest = day
      .filter(function (t) { return t.current_status !== 'consulting' && !isPreConsult(t); })
      .sort(function (a, b) { return a.token_number - b.token_number; });

    var positions = {};
    line.forEach(function (t, i) {
      positions[t.token_id] = { position: i + 1, ahead: i + consulting.length };
    });

    return consulting.concat(line, rest).map(function (t) {
      return toRow(state, t, positions[t.token_id]);
    });
  }

  function rowForToken(state, token) {
    var rows = computeQueue(state, token.doctor_id, token.token_date);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].token_id === token.token_id) return rows[i];
    }
    return null;
  }

  function maxOrderKey(state, doctorId, date) {
    return tokensFor(state, doctorId, date).reduce(function (max, t) {
      return Math.max(max, t.order_key);
    }, 0);
  }

  function maxTokenNumber(state, doctorId, date) {
    return tokensFor(state, doctorId, date).reduce(function (max, t) {
      return Math.max(max, t.token_number);
    }, 0);
  }

  /* ------------------------------------------------------------------ *
   * 6. Status transitions (mirror QueueStateMachine allowed moves)
   * ------------------------------------------------------------------ */

  function transition(tokenId, to, allowedFrom, beforeCommit) {
    var state = load();
    var token = findToken(state, tokenId);
    if (!token) return fail('Token not found.');

    if (allowedFrom.indexOf(token.current_status) === -1) {
      return fail('Invalid queue status transition: ' + token.current_status + ' -> ' + to);
    }

    if (beforeCommit) beforeCommit(state, token);
    token.current_status = to;
    syncAppointment(state, token);
    promote(state, token.doctor_id, token.token_date);
    save(state);

    var row = rowForToken(state, token);
    return ok({
      token_id: token.token_id,
      status: token.current_status,
      queue_position: row ? row.queue_position : null,
      estimated_wait_minutes: row ? row.estimated_wait_minutes : null
    });
  }

  /* ------------------------------------------------------------------ *
   * 7. Public data API
   * ------------------------------------------------------------------ */

  var ReceptionMockData = {
    todayIso: todayIso,

    getUser: function () {
      return clone(MOCK_RECEPTION_ACCOUNT.profile);
    },

    // ---- Reference data ------------------------------------------------

    getClinics: function () {
      return clone(MOCK_CLINICS.filter(function (c) { return c.is_active; }));
    },

    getDepartments: function (clinicId) {
      if (clinicId === undefined || clinicId === null || clinicId === '') {
        return clone(MOCK_DEPARTMENTS);
      }
      var ids = {};
      MOCK_DOCTORS.forEach(function (d) {
        if (d.is_active && d.clinic_id === Number(clinicId)) ids[d.department_id] = true;
      });
      return clone(
        MOCK_DEPARTMENTS
          .filter(function (dep) { return ids[dep.department_id]; })
          .sort(function (a, b) { return a.department_name.localeCompare(b.department_name); })
      );
    },

    getDoctors: function (clinicId, departmentId) {
      return clone(
        MOCK_DOCTORS.filter(function (d) {
          if (!d.is_active) return false;
          if (clinicId !== undefined && clinicId !== null && clinicId !== '' && d.clinic_id !== Number(clinicId)) return false;
          if (departmentId !== undefined && departmentId !== null && departmentId !== '' && d.department_id !== Number(departmentId)) return false;
          return true;
        }).sort(function (a, b) { return a.doctor_code.localeCompare(b.doctor_code); })
      );
    },

    getDoctorById: function (doctorId) {
      var d = findDoctor(doctorId);
      return d ? clone(d) : null;
    },

    // ---- Patients / appointments --------------------------------------

    getPatients: function () {
      return clone(load().patients);
    },

    getPatientById: function (patientId) {
      var p = findPatient(load(), patientId);
      return p ? clone(p) : null;
    },

    /**
     * @param {string} q
     * @param {'all'|'name'|'phone'|'code'} by
     */
    searchPatients: function (q, by) {
      var needle = String(q || '').trim().toLowerCase();
      if (!needle) return [];
      var digits = digitsOnly(needle);
      by = by || 'all';

      var matches = load().patients.filter(function (p) {
        var nameHit = p.full_name.toLowerCase().indexOf(needle) !== -1;
        var phoneHit = digits.length > 0 && digitsOnly(p.phone).indexOf(digits) !== -1;
        var codeHit = p.patient_code.toLowerCase().indexOf(needle) !== -1;
        if (by === 'name') return nameHit;
        if (by === 'phone') return phoneHit;
        if (by === 'code') return codeHit;
        return nameHit || phoneHit || codeHit;
      });

      matches.sort(function (a, b) { return a.full_name.localeCompare(b.full_name); });
      return clone(matches.slice(0, 25));
    },

    getAppointments: function () {
      var state = load();
      return clone(state.appointments.map(function (a) {
        var p = findPatient(state, a.patient_id) || {};
        var d = findDoctor(a.doctor_id) || {};
        var out = clone(a);
        out.patient_name = p.full_name || null;
        out.doctor_code = d.doctor_code || null;
        out.specialization = d.specialization || null;
        out.department_name = d.department_name || null;
        return out;
      }));
    },

    /**
     * Every token (appointment or walk-in) for one patient, newest first,
     * with live position / ETA for today's tokens.
     */
    getPatientAppointments: function (patientId) {
      var state = load();
      patientId = Number(patientId);
      var rows = [];
      state.tokens.forEach(function (t) {
        if (t.patient_id !== patientId) return;
        var row = rowForToken(state, t);
        if (row) rows.push(row);
      });
      rows.sort(function (a, b) {
        if (a.token_date !== b.token_date) return a.token_date < b.token_date ? 1 : -1;
        return String(b.appointment_time || '').localeCompare(String(a.appointment_time || ''));
      });
      return clone(rows);
    },

    // ---- Queue ---------------------------------------------------------

    /** Ordered queue rows for one doctor on one date (defaults to today). */
    getQueue: function (doctorId, date) {
      return clone(computeQueue(load(), Number(doctorId), date || todayIso()));
    },

    // ---- Queue actions (local, no backend) -----------------------------

    checkIn: function (tokenId) {
      return transition(tokenId, 'checked_in', ['waiting', 'next', 'arriving']);
    },

    markNoShow: function (tokenId) {
      return transition(tokenId, 'no_show', ['next', 'arriving']);
    },

    markLate: function (tokenId) {
      return transition(tokenId, 'late', ['no_show']);
    },

    /** Puts a no-show / late patient at the back of the line. */
    requeue: function (tokenId) {
      return transition(tokenId, 'requeue', ['no_show', 'late'], function (state, token) {
        token.order_key = maxOrderKey(state, token.doctor_id, token.token_date) + 1;
      });
    },

    cancelToken: function (tokenId) {
      return transition(tokenId, 'cancelled', ['waiting', 'next', 'arriving', 'checked_in', 'late']);
    },

    /** Moves the head of the line into consultation (only if nobody is in). */
    callNext: function (doctorId) {
      var state = load();
      var today = todayIso();
      var day = tokensFor(state, doctorId, today);

      if (day.some(function (t) { return t.current_status === 'consulting'; })) {
        return fail('A consultation is already in progress. Complete it before calling the next patient.');
      }
      var line = day.filter(isPreConsult).sort(compareTokens);
      if (!line.length) return fail('No patients are waiting in this queue.');

      var token = line[0];
      token.current_status = 'consulting';
      syncAppointment(state, token);
      promote(state, token.doctor_id, today);
      save(state);

      var p = findPatient(state, token.patient_id) || {};
      return ok({ token_id: token.token_id, token_number: token.token_number, patient_name: p.full_name || null });
    },

    completeConsultation: function (doctorId) {
      var state = load();
      var today = todayIso();
      var current = tokensFor(state, doctorId, today).filter(function (t) {
        return t.current_status === 'consulting';
      })[0];
      if (!current) return fail('No consultation is in progress.');

      current.current_status = 'completed';
      syncAppointment(state, current);
      promote(state, current.doctor_id, today);
      save(state);

      var p = findPatient(state, current.patient_id) || {};
      return ok({ token_id: current.token_id, token_number: current.token_number, patient_name: p.full_name || null });
    },

    /**
     * Same contract as the walk-in flow needs:
     *   payload: { doctor_id, patient_name, patient_phone?, priority?, patient_id? }
     *   -> { success, data: { token_number, status, queue_position,
     *        patients_ahead, estimated_wait_minutes, avg_consultation_minutes } }
     * Passing patient_id links the token to an existing patient (no duplicate record).
     */
    createWalkin: function (payload) {
      payload = payload || {};
      var errors = {};
      var name = String(payload.patient_name || '').trim();
      var phone = String(payload.patient_phone || '').trim();
      var priority = payload.priority || 'normal';

      if (!name) errors.patient_name = 'Patient name is required.';
      else if (name.length > 120) errors.patient_name = 'Name must be 120 characters or fewer.';
      if (phone.length > 20) errors.patient_phone = 'Phone must be 20 characters or fewer.';
      if (VALID_PRIORITIES.indexOf(priority) === -1) errors.priority = 'Invalid priority.';
      if (Object.keys(errors).length) return fail('Please check the highlighted fields.', errors);

      var doctor = findDoctor(payload.doctor_id);
      if (!doctor) return fail('Doctor not found.');

      var state = load();
      var patient = null;

      if (payload.patient_id) {
        patient = findPatient(state, payload.patient_id);
        if (!patient) return fail('Patient not found.');
      } else {
        if (phone) {
          var taken = state.patients.filter(function (p) {
            return digitsOnly(p.phone) === digitsOnly(phone);
          })[0];
          if (taken) {
            return fail('Please check the highlighted fields.', {
              patient_phone: 'Already registered to ' + taken.full_name + ' (' + taken.patient_code + ').'
            });
          }
        }
        var newId = state.patients.reduce(function (max, p) { return Math.max(max, p.patient_id); }, 7000) + 1;
        patient = {
          patient_id: newId,
          patient_code: 'PT-' + pad(newId - 7000, 4),
          full_name: name,
          age: null,
          gender: null,
          phone: phone || null
        };
        state.patients.push(patient);
      }

      var today = todayIso();
      var newTokenId = state.tokens.reduce(function (max, t) { return Math.max(max, t.token_id); }, 9000) + 1;
      var token = {
        token_id: newTokenId,
        token_number: maxTokenNumber(state, doctor.doctor_id, today) + 1,
        doctor_id: doctor.doctor_id,
        patient_id: patient.patient_id,
        appointment_id: null,
        token_type: 'walkin',
        priority: priority,
        current_status: 'waiting',
        token_date: today,
        appointment_time: null,
        reason: '',
        order_key: maxOrderKey(state, doctor.doctor_id, today) + 1
      };
      state.tokens.push(token);
      promote(state, doctor.doctor_id, today);
      save(state);

      var row = rowForToken(state, token);
      return ok({
        token_id: token.token_id,
        token_number: token.token_number,
        status: token.current_status,
        patient_id: patient.patient_id,
        patient_code: patient.patient_code,
        queue_position: row ? row.queue_position : null,
        patients_ahead: row ? row.patients_ahead : null,
        estimated_wait_minutes: row ? row.estimated_wait_minutes : null,
        avg_consultation_minutes: doctor.avg_consultation_minutes
      });
    },

    /** Throws away all local changes and re-seeds today's demo data. */
    resetDemoData: function () {
      try { localStorage.removeItem(STATE_KEY); } catch (e) { /* no-op */ }
      memoryState = null;
      load();
    }
  };

  /* ------------------------------------------------------------------ *
   * 8. Mock auth / session (localStorage-backed, no backend call)
   *    Same shape and behaviour as MockAuth in frontend/doctor.
   * ------------------------------------------------------------------ */

  var MockAuth = {
    /**
     * @returns {{success:boolean, message?:string, user?:object}}
     */
    login: function (email, password) {
      var normalizedEmail = String(email || '').trim().toLowerCase();

      if (!normalizedEmail || !password) {
        return { success: false, message: 'Please enter both email and password.' };
      }

      if (
        normalizedEmail !== MOCK_RECEPTION_ACCOUNT.email ||
        password !== MOCK_RECEPTION_ACCOUNT.password
      ) {
        return { success: false, message: 'Invalid email or password.' };
      }

      var session = {
        user: ReceptionMockData.getUser(),
        loggedInAt: new Date().toISOString()
      };

      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch (e) {
        // localStorage unavailable (e.g. private mode) — guard() will simply
        // re-check per page, exactly like the doctor module.
      }

      return { success: true, user: session.user };
    },

    logout: function () {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch (e) { /* no-op */ }
    },

    getSession: function () {
      try {
        var raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    isLoggedIn: function () {
      var session = MockAuth.getSession();
      return !!(session && session.user && (session.user.role === 'reception' || session.user.role === 'admin'));
    },

    /**
     * Call at the top of every protected page. Redirects to the login
     * page if there is no mock session.
     */
    guard: function () {
      if (!MockAuth.isLoggedIn()) {
        window.location.href = 'index.html';
      }
    }
  };

  global.ReceptionMockData = ReceptionMockData;
  global.MockAuth = MockAuth;

})(window);
