const API_BASE = '/queueless/backend/api';

/**
 * Core request function. Every other function below calls this.
 * Always sends/receives JSON and includes the session cookie.
 */
async function apiRequest(method, path, body = null) {
  const options = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch (networkErr) {
    return { success: false, message: 'Network error. Please check your connection.' };
  }

  let json;
  try {
    json = await response.json();
  } catch (parseErr) {
    console.error('API returned a non-JSON response', { method, path, status: response.status });
    return { success: false, message: 'Unexpected server response.' };
  }

  if (!response.ok || json.success === false) {
    console.error('API request failed', { method, path, status: response.status, response: json });
  }

  return json;
}

function apiGet(path) {
  return apiRequest('GET', path);
}

function apiPost(path, body) {
  return apiRequest('POST', path, body);
}

// ---- Auth ----
const Api = {
  register: (data) => apiPost('/auth/register.php', data),
  login: (data) => apiPost('/auth/login.php', data),
  logout: () => apiPost('/auth/logout.php', {}),
  me: () => apiGet('/auth/me.php'),

  // ---- Clinics / Doctors ----
  listClinics: () => apiGet('/clinics/list.php'),
  nearbyClinics: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') query.set(key, value);
    });
    const qs = query.toString();
    return apiGet('/clinics/nearby.php' + (qs ? `?${qs}` : ''));
  },
  listDoctors: (clinicId) => apiGet(`/doctors/list.php?clinic_id=${clinicId}`),
  doctorSchedule: (doctorId, date) => apiGet(`/doctors/schedules.php?doctor_id=${doctorId}&date=${date}`),
  receptionSearchPatients: (query, patientId = null) => {
    const params = new URLSearchParams({ q: query });
    if (patientId !== null && patientId !== undefined) params.set('patient_id', patientId);
    return apiGet(`/patients/reception-search.php?${params.toString()}`);
  },

  // ---- Appointments ----
  bookAppointment: (data) => apiPost('/appointments/book.php', data),
  cancelAppointment: (data) => apiPost('/appointments/cancel.php', data),
  appointmentHistory: () => apiGet('/appointments/history.php'),

  // ---- Tokens ----
  createWalkin: (data) => apiPost('/tokens/walkin.php', data),
  getToken: (tokenId) => apiGet(`/tokens/get.php?token_id=${tokenId}`),

  // ---- Queue ----
  queueStatus: (tokenId) => apiGet(`/queue/status.php?token_id=${tokenId}`),
  onMyWay: (tokenId) => apiPost('/queue/on-my-way.php', { token_id: tokenId }),
  checkIn: (tokenId) => apiPost('/queue/check-in.php', { token_id: tokenId }),
  markNoShow: (tokenId) => apiPost('/queue/no-show.php', { token_id: tokenId }),
  markLate: (tokenId) => apiPost('/queue/late-arrival.php', { token_id: tokenId }),
  requeue: (tokenId) => apiPost('/queue/requeue.php', { token_id: tokenId }),
  startConsultation: (tokenId) => apiPost('/queue/start-consultation.php', { token_id: tokenId }),
  saveConsultationNotes: (tokenId, notes) => apiPost('/queue/notes.php', { token_id: tokenId, notes }),
  completeConsultation: (tokenId, notes) => apiPost('/queue/complete.php', { token_id: tokenId, notes }),
  receptionView: (doctorId, date) => apiGet(`/queue/reception-view.php?doctor_id=${doctorId}&date=${date}`),

  // ---- Doctor ----
  doctorDashboard: () => apiGet('/doctors/dashboard.php'),
  doctorAppointments: () => apiGet('/doctors/appointments.php'),

  // ---- Notifications ----
  listNotifications: () => apiGet('/notifications/list.php'),
  markNotificationRead: (id) => apiPost('/notifications/mark-read.php', { notification_id: id }),

  // ---- Admin ----
  adminData: () => apiGet('/admin/data.php'),
  getQueueRules: () => apiGet('/admin/queue-rules.php'),
  setQueueRules: (data) => apiPost('/admin/queue-rules.php', data),

  // ---- Admin: Hospitals/Clinics + Doctors (Phase 3) ----
  adminListClinics: () => apiGet('/admin/clinics.php'),
  adminSaveClinic: (data) => apiPost('/admin/clinics.php', data),
  adminListDoctors: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.set(key, value);
      }
    });
    const qs = params.toString();
    return apiGet('/admin/doctors.php' + (qs ? `?${qs}` : ''));
  },
  adminSaveDoctor: (data) => apiPost('/admin/doctors.php', data),

  // ---- Admin: Departments (Phase 3.1) ----
  adminListDepartments: (clinicId) => apiGet('/admin/departments.php?clinic_id=' + encodeURIComponent(clinicId)),
  adminSaveDepartment: (data) => apiPost('/admin/departments.php', data),
};

// ---- window.QueueLess.ApiClient -----------------------------------------
// patient.js does `new window.QueueLess.ApiClient({ baseUrl, mockMode })`.
// Every method here just delegates to the corresponding `Api.*` function
// above, so there's one source of truth for endpoint paths -- this class
// is purely an instance-call convenience wrapper around it. `mockMode` is
// stored but not branched on: patient.js now always talks to the real
// backend/api endpoints (MOCK_MODE = false there), so there's no mock
// fallback path here to switch on.
window.QueueLess = window.QueueLess || {};

window.QueueLess.ApiClient = class ApiClient {
  constructor({ baseUrl = API_BASE, mockMode = false } = {}) {
    this.baseUrl = baseUrl;
    this.mockMode = mockMode;
  }

  // ---- Auth ----
  register(data) { return Api.register(data); }
  login(data) { return Api.login(data); }
  logout() { return Api.logout(); }
  me() { return Api.me(); }

  // ---- Clinics / Doctors ----
  listClinics() { return Api.listClinics(); }
  nearbyClinics(params) { return Api.nearbyClinics(params); }
  listDoctors(clinicId) { return Api.listDoctors(clinicId); }
  doctorSchedule(doctorId, date) { return Api.doctorSchedule(doctorId, date); }
  receptionSearchPatients(query, patientId) { return Api.receptionSearchPatients(query, patientId); }

  // ---- Appointments ----
  bookAppointment(data) { return Api.bookAppointment(data); }
  cancelAppointment(data) { return Api.cancelAppointment(data); }
  appointmentHistory() { return Api.appointmentHistory(); }

  // ---- Tokens ----
  createWalkin(data) { return Api.createWalkin(data); }
  getToken(tokenId) { return Api.getToken(tokenId); }

  // ---- Queue ----
  queueStatus(tokenId) { return Api.queueStatus(tokenId); }
  onMyWay(tokenId) { return Api.onMyWay(tokenId); }
  startConsultation(tokenId) { return Api.startConsultation(tokenId); }
  saveConsultationNotes(tokenId, notes) { return Api.saveConsultationNotes(tokenId, notes); }
  completeConsultation(tokenId, notes) { return Api.completeConsultation(tokenId, notes); }

  // ---- Doctor ----
  doctorDashboard() { return Api.doctorDashboard(); }
  doctorAppointments() { return Api.doctorAppointments(); }

  // ---- Notifications ----
  listNotifications() { return Api.listNotifications(); }
  markNotificationRead(id) { return Api.markNotificationRead(id); }

  // ---- Admin ----
  adminData() { return Api.adminData(); }
  getQueueRules() { return Api.getQueueRules(); }
  setQueueRules(data) { return Api.setQueueRules(data); }
  adminListClinics() { return Api.adminListClinics(); }
  adminSaveClinic(data) { return Api.adminSaveClinic(data); }
  adminListDoctors(filters) { return Api.adminListDoctors(filters); }
  adminSaveDoctor(data) { return Api.adminSaveDoctor(data); }
  adminListDepartments(clinicId) { return Api.adminListDepartments(clinicId); }
  adminSaveDepartment(data) { return Api.adminSaveDepartment(data); }
};