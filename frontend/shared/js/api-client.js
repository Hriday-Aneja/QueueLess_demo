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
    return { success: false, message: 'Unexpected server response.' };
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
  listDoctors: (clinicId) => apiGet(`/doctors/list.php?clinic_id=${clinicId}`),
  doctorSchedule: (doctorId, date) => apiGet(`/doctors/schedules.php?doctor_id=${doctorId}&date=${date}`),

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
  completeConsultation: (tokenId) => apiPost('/queue/complete.php', { token_id: tokenId }),
  receptionView: (doctorId, date) => apiGet(`/queue/reception-view.php?doctor_id=${doctorId}&date=${date}`),

  // ---- Notifications ----
  listNotifications: () => apiGet('/notifications/list.php'),
  markNotificationRead: (id) => apiPost('/notifications/mark-read.php', { notification_id: id }),

  // ---- Admin ----
  adminData: () => apiGet('/admin/data.php'),
  getQueueRules: () => apiGet('/admin/queue-rules.php'),
  setQueueRules: (data) => apiPost('/admin/queue-rules.php', data),
};