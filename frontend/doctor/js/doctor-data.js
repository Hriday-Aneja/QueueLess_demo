/* ==========================================================================
   QueueLess — Doctor Module Mock Data Layer
   frontend/doctor/js/doctor-data.js

   Pure front-end mock data. No fetch(), no backend/api calls, no queue
   engine logic. Field names mirror backend/database/schema.sql (doctors,
   tokens, appointments tables) so this can be swapped for real API calls
   later without touching any page markup.

   Exposes two globals used by doctor.js and the page scripts:
     - DoctorMockData  : the mock dataset + small query helpers
     - MockAuth        : login/logout/session helpers backed by localStorage
   ========================================================================== */

(function (global) {
  'use strict';

  var SESSION_KEY = 'queueless_doctor_session';

  /* ------------------------------------------------------------------ *
   * 1. Mock "logged in" doctor account (demo credentials)
   * ------------------------------------------------------------------ */

  var MOCK_DOCTOR_ACCOUNT = {
    email: 'doctor@queueless.com',
    password: 'doctor123', // demo only — never do this with real auth
    profile: {
      doctor_id: 101,
      user_id: 501,
      doctor_code: 'DOC-101',
      full_name: 'Dr. Anjali Mehra',
      email: 'doctor@queueless.com',
      phone: '+91 98765 43210',
      specialization: 'General Medicine',
      department_name: 'General Medicine',
      clinic_name: 'QueueLess Health Clinic — Sector 12',
      consultation_fee: 500.0,
      years_experience: 9,
      qualifications: 'MBBS, MD (General Medicine)',
      bio: 'Focused on preventive care and chronic condition management, with a calm, unhurried approach to every consultation.',
      avatar_initials: 'AM',
      is_active: true
    }
  };

  /* ------------------------------------------------------------------ *
   * 2. Mock today's queue (tokens) for this doctor
   *    status: waiting | in_progress | completed | no_show | cancelled
   * ------------------------------------------------------------------ */

  var today = new Date().toISOString().slice(0, 10);

  var MOCK_QUEUE_TODAY = [
    {
      token_id: 9001,
      token_number: 1,
      patient_id: 7001,
      patient_name: 'Ramesh Kulkarni',
      patient_age: 54,
      patient_gender: 'Male',
      token_type: 'appointment',
      priority: 'normal',
      status: 'completed',
      token_date: today,
      appointment_time: '09:00',
      reason: 'Follow-up: blood pressure review'
    },
    {
      token_id: 9002,
      token_number: 2,
      patient_id: 7002,
      patient_name: 'Sunita Rao',
      patient_age: 41,
      patient_gender: 'Female',
      token_type: 'appointment',
      priority: 'urgent',
      status: 'in_progress',
      token_date: today,
      appointment_time: '09:20',
      reason: 'Persistent cough and mild fever'
    },
    {
      token_id: 9003,
      token_number: 3,
      patient_id: 7003,
      patient_name: 'Arjun Verma',
      patient_age: 29,
      patient_gender: 'Male',
      token_type: 'appointment',
      priority: 'normal',
      status: 'waiting',
      token_date: today,
      appointment_time: '09:40',
      reason: 'General check-up'
    },
    {
      token_id: 9004,
      token_number: 4,
      patient_id: 7004,
      patient_name: 'Fatima Sheikh',
      patient_age: 63,
      patient_gender: 'Female',
      token_type: 'walkin',
      priority: 'normal',
      status: 'waiting',
      token_date: today,
      appointment_time: '10:00',
      reason: 'Joint pain, difficulty walking'
    },
    {
      token_id: 9005,
      token_number: 5,
      patient_id: 7005,
      patient_name: 'Vikram Singh',
      patient_age: 35,
      patient_gender: 'Male',
      token_type: 'appointment',
      priority: 'normal',
      status: 'waiting',
      token_date: today,
      appointment_time: '10:20',
      reason: 'Skin rash, needs assessment'
    },
    {
      token_id: 9006,
      token_number: 6,
      patient_id: 7006,
      patient_name: 'Neha Joshi',
      patient_age: 47,
      patient_gender: 'Female',
      token_type: 'appointment',
      priority: 'normal',
      status: 'no_show',
      token_date: today,
      appointment_time: '10:40',
      reason: 'Annual wellness check'
    }
  ];

  /* ------------------------------------------------------------------ *
   * 3. Mock upcoming appointments (beyond today)
   * ------------------------------------------------------------------ */

  var MOCK_APPOINTMENTS = [
    {
      appointment_id: 5501,
      patient_id: 7002,
      patient_name: 'Sunita Rao',
      appointment_date: today,
      appointment_time: '09:20',
      appointment_type: 'appointment',
      status: 'checked_in',
      reason: 'Persistent cough and mild fever'
    },
    {
      appointment_id: 5502,
      patient_id: 7007,
      patient_name: 'Deepak Nair',
      appointment_date: addDays(today, 1),
      appointment_time: '09:30',
      appointment_type: 'appointment',
      status: 'scheduled',
      reason: 'Diabetes management review'
    },
    {
      appointment_id: 5503,
      patient_id: 7008,
      patient_name: 'Pooja Iyer',
      appointment_date: addDays(today, 1),
      appointment_time: '11:00',
      appointment_type: 'appointment',
      status: 'scheduled',
      reason: 'New patient consultation'
    },
    {
      appointment_id: 5504,
      patient_id: 7009,
      patient_name: 'Karan Malhotra',
      appointment_date: addDays(today, 2),
      appointment_time: '10:15',
      appointment_type: 'appointment',
      status: 'scheduled',
      reason: 'Post-surgery follow-up'
    },
    {
      appointment_id: 5505,
      patient_id: 7003,
      patient_name: 'Arjun Verma',
      appointment_date: addDays(today, -2),
      appointment_time: '09:40',
      appointment_type: 'appointment',
      status: 'completed',
      reason: 'General check-up'
    },
    {
      appointment_id: 5506,
      patient_id: 7010,
      patient_name: 'Meera Pillai',
      appointment_date: addDays(today, -3),
      appointment_time: '15:00',
      appointment_type: 'appointment',
      status: 'cancelled',
      reason: 'Routine dental referral'
    }
  ];

  /* ------------------------------------------------------------------ *
   * 4. Mock patient consultation history (keyed by patient_id)
   *    Used by the Consultation Screen for quick context.
   * ------------------------------------------------------------------ */

  var MOCK_PATIENT_HISTORY = {
    7002: [
      { date: addDays(today, -30), note: 'Mild seasonal allergy. Prescribed antihistamine.' },
      { date: addDays(today, -90), note: 'Routine check-up. No concerns.' }
    ],
    7003: [
      { date: addDays(today, -180), note: 'Sports injury, knee. Advised rest and physiotherapy.' }
    ],
    7004: [
      { date: addDays(today, -14), note: 'Reported early joint stiffness. Recommended vitamin D test.' }
    ]
  };

  function addDays(isoDate, days) {
    var d = new Date(isoDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /* ------------------------------------------------------------------ *
   * 5. Query helpers (read-only — no mutation of underlying "backend")
   * ------------------------------------------------------------------ */

  var DoctorMockData = {
    getProfile: function () {
      return clone(MOCK_DOCTOR_ACCOUNT.profile);
    },

    getTodayQueue: function () {
      return clone(MOCK_QUEUE_TODAY);
    },

    getCurrentPatient: function () {
      var found = MOCK_QUEUE_TODAY.filter(function (t) { return t.status === 'in_progress'; })[0];
      return found ? clone(found) : null;
    },

    getNextPatient: function () {
      var waiting = MOCK_QUEUE_TODAY
        .filter(function (t) { return t.status === 'waiting'; })
        .sort(function (a, b) { return a.token_number - b.token_number; });
      return waiting.length ? clone(waiting[0]) : null;
    },

    getWaitingCount: function () {
      return MOCK_QUEUE_TODAY.filter(function (t) { return t.status === 'waiting'; }).length;
    },

    getCompletedCount: function () {
      return MOCK_QUEUE_TODAY.filter(function (t) { return t.status === 'completed'; }).length;
    },

    getTokenById: function (tokenId) {
      var found = MOCK_QUEUE_TODAY.filter(function (t) { return t.token_id === Number(tokenId); })[0];
      return found ? clone(found) : null;
    },

    getAppointments: function () {
      return clone(MOCK_APPOINTMENTS);
    },

    getPatientHistory: function (patientId) {
      return clone(MOCK_PATIENT_HISTORY[Number(patientId)] || []);
    },

    /**
     * Local-only status mutation so the Dashboard / Consultation screens feel
     * interactive in the demo. This never touches a real queue engine —
     * it just updates the in-memory + localStorage-mirrored mock array.
     */
    setTokenStatus: function (tokenId, newStatus) {
      var token = MOCK_QUEUE_TODAY.filter(function (t) { return t.token_id === Number(tokenId); })[0];
      if (token) {
        token.status = newStatus;
      }
      return token ? clone(token) : null;
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /* ------------------------------------------------------------------ *
   * 6. Mock auth / session (localStorage-backed, no backend call)
   * ------------------------------------------------------------------ */

  var MockAuth = {
    /**
     * @returns {{success:boolean, message?:string, doctor?:object}}
     */
    login: function (email, password) {
      var normalizedEmail = String(email || '').trim().toLowerCase();

      if (!normalizedEmail || !password) {
        return { success: false, message: 'Please enter both email and password.' };
      }

      if (
        normalizedEmail !== MOCK_DOCTOR_ACCOUNT.email ||
        password !== MOCK_DOCTOR_ACCOUNT.password
      ) {
        return { success: false, message: 'Invalid email or password.' };
      }

      var session = {
        doctor: DoctorMockData.getProfile(),
        loggedInAt: new Date().toISOString()
      };

      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch (e) {
        // localStorage unavailable (e.g. private mode) — still allow
        // navigation for this demo, guard() will simply re-check per page.
      }

      return { success: true, doctor: session.doctor };
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
      return !!MockAuth.getSession();
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

  global.DoctorMockData = DoctorMockData;
  global.MockAuth = MockAuth;

})(window);