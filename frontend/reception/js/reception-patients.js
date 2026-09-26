/* ==========================================================
   QueueLess — Reception: Patient Search & Appointment Management

  Patient lookup and appointment actions use the PHP API. The action
  buttons, confirm dialogs and toasts are shared with the Queue page.
   ========================================================== */

(function () {
  'use strict';

  const UI = ReceptionUI;
  const { escapeHtml, todayIso, formatFriendlyDate, formatShortDate, statusBadge, priorityBadge } = UI;

  const MIN_QUERY_LENGTH = 2;
  const AUTO_REFRESH_MS = 20000;

  const HINTS = {
    all: 'Enter at least 2 characters — name, phone number or patient code.',
    name: 'Enter at least 2 letters of the patient’s name.',
    phone: 'Enter part of the patient’s phone number.',
    code: 'Enter a patient code such as PT-0004.',
  };

  const state = {
    searchBy: 'all',
    query: '',
    patients: [],
    selectedPatient: null,
    rows: [],              // normalized appointment/token rows currently displayed
    refreshTimer: null,
  };

  let els = {};

  document.addEventListener('reception:ready', () => {
    initPage();
  });

  /* ==========================================================
     Page setup
     ========================================================== */

  function initPage() {
    els = {
      pageDate: byId('pageDate'),
      pageUpdated: byId('pageUpdated'),
      refreshBtn: byId('refreshBtn'),
      searchForm: byId('searchForm'),
      searchInput: byId('searchInput'),
      searchBy: byId('searchBy'),
      searchHint: byId('searchHint'),
      pageError: byId('pageError'),
      pageErrorText: byId('pageErrorText'),
      pageErrorClose: byId('pageErrorClose'),
      patientsPanel: byId('patientsPanel'),
      patientsCount: byId('patientsCount'),
      patientList: byId('patientList'),
      appointmentsPanel: byId('appointmentsPanel'),
      appointmentsTitle: byId('appointmentsTitle'),
      appointmentsCount: byId('appointmentsCount'),
      appointmentsBody: byId('appointmentsBody'),
      appointmentsEmpty: byId('appointmentsEmpty'),
      noResults: byId('noResults'),
    };

    els.pageDate.textContent = formatFriendlyDate(todayIso());

    els.searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      runSearch();
    });

    els.searchBy.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-by]');
      if (!btn) return;
      state.searchBy = btn.dataset.by;
      els.searchBy.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      els.searchHint.textContent = HINTS[state.searchBy];
      els.searchInput.focus();
    });

    els.refreshBtn.addEventListener('click', () => refreshCurrent());
    els.pageErrorClose.addEventListener('click', () => (els.pageError.hidden = true));

    els.patientList.addEventListener('click', (e) => {
      const card = e.target.closest('[data-patient-index]');
      if (!card) return;
      selectPatient(state.patients[Number(card.dataset.patientIndex)]);
    });

    els.appointmentsBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn || btn.disabled) return;
      handleAction(btn.dataset.action, Number(btn.dataset.tokenId), btn);
    });

    state.refreshTimer = setInterval(() => {
      if (document.hidden || UI.isConfirmOpen()) return;
      refreshCurrent();
    }, AUTO_REFRESH_MS);
    window.addEventListener('beforeunload', () => clearInterval(state.refreshTimer));

    // Support deep links such as patients.html?q=PT-0004
    const preset = new URLSearchParams(window.location.search).get('q');
    if (preset) {
      els.searchInput.value = preset;
      runSearch();
    }
  }

  /* ==========================================================
     Search: patient list -> appointments
     ========================================================== */

  async function runSearch() {
    const q = els.searchInput.value.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      showError(`Please enter at least ${MIN_QUERY_LENGTH} characters to search.`);
      return;
    }

    els.pageError.hidden = true;
    state.query = q;
    state.selectedPatient = null;
    state.rows = [];
    resetResults();

    const result = await Api.receptionSearchPatients(q);
    if (!result.success) { showError(result.message || 'Could not search patients.'); return; }
    state.patients = result.data.patients || [];
    renderPatients();
    if (state.patients.length === 1) selectPatient(state.patients[0]);
  }

  function resetResults() {
    els.patientsPanel.hidden = true;
    els.appointmentsPanel.hidden = true;
    els.noResults.hidden = true;
    els.refreshBtn.disabled = true;
  }

  function renderPatients() {
    els.noResults.textContent = 'No patients matched your search.';
    els.noResults.hidden = state.patients.length > 0;
    els.patientsPanel.hidden = state.patients.length === 0;
    els.patientsCount.textContent = state.patients.length
      ? `${state.patients.length} match${state.patients.length === 1 ? '' : 'es'}`
      : '';

    els.patientList.innerHTML = state.patients
      .map((p, i) => {
        const selected = state.selectedPatient && state.selectedPatient.patient_id === p.patient_id;
        return `
        <button type="button" class="patient-result${selected ? ' selected' : ''}" data-patient-index="${i}">
          <span>
            <p class="patient-result-name">${escapeHtml(p.full_name || 'Unnamed patient')}</p>
            <p class="patient-result-meta">${escapeHtml(p.phone || 'No phone on file')}</p>
          </span>
          <span class="patient-code">${escapeHtml(p.patient_code || '—')}</span>
        </button>`;
      })
      .join('');
  }

  function selectPatient(patient) {
    if (!patient) return;
    state.selectedPatient = patient;
    renderPatients();
    els.appointmentsTitle.textContent =
      `Appointments — ${patient.full_name || 'Patient'}${patient.patient_code ? ' (' + patient.patient_code + ')' : ''}`;
    els.appointmentsPanel.hidden = false;
    loadPatientAppointments();
  }

  async function loadPatientAppointments() {
    const patient = state.selectedPatient;
    if (!patient) return;

    const result = await Api.receptionSearchPatients(patient.patient_code || patient.full_name, patient.patient_id);
    if (!result.success) { showError(result.message || 'Could not load appointments.'); return; }
    const fresh = (result.data.patients || [])[0] || patient;
    state.selectedPatient = fresh;
    state.rows = (fresh.appointments || []).map((a) => normalizeRow(a, fresh));
    renderAppointments();
    stamp();
  }

  function refreshCurrent() {
    if (state.selectedPatient) loadPatientAppointments();
  }

  /* ==========================================================
     Appointments table
     ========================================================== */

  // Maps a getPatientAppointments() item to one row shape.
  function normalizeRow(item, patient) {
    const name = item.doctor_name;
    const code = item.doctor_code;
    const spec = item.specialization;
    return {
      tokenId: item.token_id != null ? Number(item.token_id) : null,
      tokenNumber: item.token_number != null ? item.token_number : null,
      patientName: item.patient_name || (patient && patient.full_name) || '—',
      date: item.appointment_date || item.token_date || null,
      time: item.appointment_time || null,
      doctor: name || code ? `${name || code}${spec ? ` · ${spec}` : ''}` : '—',
        doctor: name || code ? `${name || code}${spec ? ` · ${spec}` : ''}` : '—',
      department: item.department_name || '',
      type: item.token_type || item.appointment_type || '—',
      priority: item.priority || 'normal',
      status: String(item.current_status || item.appointment_status || 'unknown').toLowerCase(),
      position: item.queue_position != null ? item.queue_position : null,
      eta: item.estimated_wait_minutes != null ? item.estimated_wait_minutes : null,
    };
  }

  function renderAppointments() {
    const rows = state.rows;
    els.appointmentsCount.textContent = rows.length ? `${rows.length} record${rows.length === 1 ? '' : 's'}` : '';
    els.appointmentsEmpty.hidden = rows.length > 0;

    els.appointmentsPanel.hidden = false;
    els.refreshBtn.disabled = false;

    const today = todayIso();

    els.appointmentsBody.innerHTML = rows
      .map((r) => {
        const isToday = r.date === today;
        const live = isToday && UI.LIVE_STATUSES.includes(r.status);
        return `
        <tr>
          <td>${r.tokenNumber != null ? '#' + escapeHtml(r.tokenNumber) : '—'}</td>
          <td>${escapeHtml(r.patientName)}</td>
          <td>${r.date ? escapeHtml(formatShortDate(r.date)) : '—'}${isToday ? '<span class="tag-today">Today</span>' : ''}
            ${r.time ? `<span class="cell-sub">${escapeHtml(r.time.slice(0, 5))}</span>` : ''}</td>
          <td>${escapeHtml(r.doctor)}${r.department ? `<span class="cell-sub">${escapeHtml(r.department)}</span>` : ''}</td>
          <td>${escapeHtml(r.type)}${r.priority !== 'normal' ? ' ' + priorityBadge(r.priority) : ''}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${live && r.position != null ? escapeHtml(r.position) : '—'}</td>
          <td>${live && r.eta != null ? escapeHtml(r.eta) + ' min' : '—'}</td>
          <td>${UI.actionButtonsHtml(r)}</td>
        </tr>`;
      })
      .join('');
  }

  /* ==========================================================
     Actions (confirm dialogs, toasts and the mock-data calls
     live in ReceptionUI.handleRowAction, shared with Queue)
     ========================================================== */

  function handleAction(action, tokenId, button) {
    const row = state.rows.find((r) => r.tokenId === tokenId);
    if (!row) return;

    UI.handleRowAction(action, row, () => {
      // Always re-read so the table reflects reshuffled positions/ETAs.
      refreshCurrent();
    }, button);
  }

  /* ==========================================================
     Feedback helpers
     ========================================================== */

  function showError(message) {
    els.pageErrorText.textContent = message;
    els.pageError.hidden = false;
  }

  function stamp() {
    els.pageUpdated.textContent = 'Updated ' + new Date().toLocaleTimeString();
  }

  function byId(id) {
    return document.getElementById(id);
  }
})();
