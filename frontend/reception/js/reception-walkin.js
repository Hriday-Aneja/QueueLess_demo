/* ==========================================================
   QueueLess — Reception: Walk-In Flow

   Everything comes from the PHP API:
     Api.listClinics()             -> clinic picker
     Api.listDoctors(clinicId)     -> department and doctor pickers
     Api.receptionView(...)        -> live queue preview
     Api.receptionSearchPatients() -> existing-patient search
     Api.createWalkin(payload)     -> token number, position, ETA

   The token number, queue position, patients-ahead and ETA shown on
   the ticket are exactly what the mock data layer returns; nothing is
   computed here. The mock supports patient_id, so choosing an
   existing patient attaches the token to their record (no duplicate
   patient is created and no confirmation is needed).
   ========================================================== */

(function () {
  'use strict';

  const UI = ReceptionUI;
  const { escapeHtml, escapeAttr, todayIso, formatFriendlyDate, doctorLabel } = UI;

  const MIN_QUERY_LENGTH = 2;
  const PREVIEW_REFRESH_MS = 20000;
  const PHONE_PATTERN = /^[0-9+\-\s()]{6,20}$/;

  // Display-only grouping for the "Waiting" figure in the preview,
  // matching the dashboard and admin data.php.
  const WAITING_STATUSES = UI.WAITING_STATUSES;

  const state = {
    patientMode: 'new',       // 'new' | 'existing'
    selectedPatient: null,
    patients: [],
    doctors: [],
    previewTimer: null,
  };

  let els = {};

  document.addEventListener('reception:ready', () => {
    initPage();
  });

  /* ==========================================================
     Page setup
     ========================================================== */

  function initPage() {
    const ids = [
      'pageDate', 'pageError', 'pageErrorText', 'pageErrorClose', 'walkinForm', 'patientMode',
      'existingBlock', 'newBlock', 'selectedPatient', 'selectedName',
      'selectedMeta', 'clearPatient', 'patientSearchBlock', 'patientSearchInput', 'patientSearchBtn',
      'patientResults', 'patientNoResults',
      'patientName', 'patientPhone', 'clinicSelect', 'departmentSelect', 'doctorSelect',
      'prioritySelect', 'submitBtn', 'resetBtn', 'previewEmpty', 'previewBody', 'previewDoctor',
      'previewCurrent', 'previewNext', 'previewWaiting', 'ticketPanel', 'ticketStatus',
      'ticketNumber', 'ticketEta', 'ticketDetail', 'ticketWarning', 'newWalkinBtn',
    ];
    ids.forEach((id) => (els[id] = document.getElementById(id)));

    els.pageDate.textContent = formatFriendlyDate(todayIso());
    els.pageErrorClose.addEventListener('click', () => (els.pageError.hidden = true));

    els.patientMode.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-mode]');
      if (btn) setPatientMode(btn.dataset.mode);
    });

    els.patientSearchBtn.addEventListener('click', searchExistingPatient);
    els.patientSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchExistingPatient();
      }
    });
    els.patientResults.addEventListener('click', (e) => {
      const card = e.target.closest('[data-patient-index]');
      if (card) choosePatient(state.patients[Number(card.dataset.patientIndex)]);
    });
    els.clearPatient.addEventListener('click', clearPatient);

    els.clinicSelect.addEventListener('change', () => loadDoctors(els.clinicSelect.value));
    els.departmentSelect.addEventListener('change', onDepartmentChange);
    els.doctorSelect.addEventListener('change', onDoctorChange);

    els.walkinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitWalkin();
    });
    els.walkinForm.addEventListener('input', (e) => clearFieldError(e.target.closest('.form-field')));
    els.resetBtn.addEventListener('click', resetForm);
    els.newWalkinBtn.addEventListener('click', startAnother);

    state.previewTimer = setInterval(() => {
      if (!document.hidden && els.doctorSelect.value) loadPreview();
    }, PREVIEW_REFRESH_MS);
    window.addEventListener('beforeunload', () => clearInterval(state.previewTimer));

    bootstrapClinics();
  }

  async function bootstrapClinics() {
    const result = await Api.listClinics();
    if (!result.success) { showError(result.message || 'Could not load clinics.'); return; }
    const clinics = result.data.clinics || [];
    if (clinics.length === 0) {
      showError('No clinics are configured yet.');
      return;
    }
    els.clinicSelect.innerHTML = clinics
      .map((c) => `<option value="${Number(c.clinic_id)}">${escapeHtml(c.clinic_name)}</option>`)
      .join('');
    const remembered = sessionStorage.getItem('queueless_reception_clinic');
    els.clinicSelect.value = clinics.some((clinic) => String(clinic.clinic_id) === remembered) ? remembered : String(clinics[0].clinic_id);
    loadDoctors(els.clinicSelect.value);
  }

  /* ==========================================================
     Department / doctor selection
     ========================================================== */

  async function loadDoctors(clinicId) {
    els.departmentSelect.disabled = true;
    els.doctorSelect.disabled = true;
    els.departmentSelect.innerHTML = '<option value="">Loading…</option>';
    els.doctorSelect.innerHTML = '<option value="">Select doctor…</option>';
    updateSubmitState();
    clearPreview();

    const result = await Api.listDoctors(clinicId);
    if (!result.success) { showError(result.message || 'Could not load doctors.'); return; }
    state.doctors = result.data.doctors || [];
    const departments = [...new Map(state.doctors.map((doctor) => [doctor.department_id, { department_id: doctor.department_id, department_name: doctor.department_name }])).values()];

    els.departmentSelect.innerHTML =
      '<option value="">Select department…</option>' +
      departments
        .map((dep) => `<option value="${escapeHtml(dep.department_id)}">${escapeHtml(dep.department_name)}</option>`)
        .join('');
    els.departmentSelect.disabled = departments.length === 0;

    if (departments.length === 0) {
      showError('No active doctors are set up for this clinic.');
    } else if (departments.length === 1) {
      els.departmentSelect.value = String(departments[0].department_id);
      onDepartmentChange();
    }
  }

  function onDepartmentChange() {
    const deptId = els.departmentSelect.value;
    const doctors = state.doctors.filter((d) => String(d.department_id) === deptId);

    els.doctorSelect.innerHTML =
      '<option value="">Select doctor…</option>' +
      doctors
        .map((d) => `<option value="${Number(d.doctor_id)}">${escapeHtml(doctorLabel(d))}</option>`)
        .join('');
    els.doctorSelect.disabled = doctors.length === 0;

    clearPreview();
    updateSubmitState();

    if (doctors.length === 1) {
      els.doctorSelect.value = String(doctors[0].doctor_id);
      onDoctorChange();
    }
  }

  function onDoctorChange() {
    clearFieldError(document.getElementById('fieldDoctor'));
    updateSubmitState();
    if (els.doctorSelect.value) {
      loadPreview();
    } else {
      clearPreview();
    }
  }

  function selectedDoctor() {
    const id = els.doctorSelect.value;
    return state.doctors.find((d) => String(d.doctor_id) === id) || null;
  }

  function updateSubmitState() {
    els.submitBtn.disabled = !els.doctorSelect.value;
  }

  /* ---- Live queue preview (mock queue) ------------------------------- */

  async function loadPreview() {
    const doctor = selectedDoctor();
    if (!doctor) return;

    const result = await Api.receptionView(doctor.doctor_id, todayIso());
    if (!result.success) { showError(result.message || 'Could not load the queue preview.'); return; }
    const queue = (result.data.queue || []).map((row) => Object.assign(row, { current_status: String(row.current_status || '').toLowerCase() }));
    const current = queue.find((t) => t.current_status === 'consulting');
    const next = UI.findNextUp(queue);
    const waiting = queue.filter((t) => WAITING_STATUSES.includes(t.current_status)).length;

    els.previewDoctor.textContent = `${doctorLabel(doctor)} · ${doctor.department_name}`;
    setPill(els.previewCurrent, current ? '#' + current.token_number : null);
    setPill(els.previewNext, next ? '#' + next.token_number : null);
    els.previewWaiting.textContent = waiting;
    els.previewEmpty.hidden = true;
    els.previewBody.hidden = false;
  }

  function setPill(el, text) {
    el.textContent = text || '—';
    el.classList.toggle('none', !text);
  }

  function clearPreview() {
    els.previewBody.hidden = true;
    els.previewEmpty.hidden = false;
    els.previewEmpty.textContent = 'Select a doctor to see their current queue.';
  }

  /* ==========================================================
     Patient: new vs existing
     ========================================================== */

  function setPatientMode(mode) {
    state.patientMode = mode;
    els.patientMode.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    els.existingBlock.hidden = mode !== 'existing';
    els.newBlock.hidden = mode !== 'new';
    if (mode === 'existing') els.patientSearchInput.focus();
    else els.patientName.focus();
  }

  async function searchExistingPatient() {
    const q = els.patientSearchInput.value.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      showError(`Please enter at least ${MIN_QUERY_LENGTH} characters to search.`);
      return;
    }
    els.pageError.hidden = true;

    const result = await Api.receptionSearchPatients(q);
    if (!result.success) { showError(result.message || 'Could not search patients.'); return; }
    state.patients = result.data.patients || [];
    els.patientNoResults.hidden = state.patients.length > 0;
    els.patientResults.innerHTML = state.patients
      .map(
        (p, i) => `
        <button type="button" class="patient-result" data-patient-index="${i}">
          <span>
            <p class="patient-result-name">${escapeHtml(p.full_name || 'Unnamed patient')}</p>
            <p class="patient-result-meta">${escapeHtml(p.phone || 'No phone on file')}</p>
          </span>
          <span class="patient-code">${escapeHtml(p.patient_code || '—')}</span>
        </button>`
      )
      .join('');
  }

  function choosePatient(patient) {
    if (!patient) return;
    state.selectedPatient = patient;

    els.selectedName.textContent = patient.full_name || 'Unnamed patient';
    els.selectedMeta.textContent =
      [patient.patient_code, patient.phone].filter(Boolean).join(' · ') || 'No details on file';
    els.selectedPatient.hidden = false;
    els.patientSearchBlock.hidden = true;
  }

  function clearPatient() {
    state.selectedPatient = null;
    els.selectedPatient.hidden = true;
    els.patientSearchBlock.hidden = false;
    els.patientSearchInput.focus();
  }

  /* ==========================================================
     Submit
     ========================================================== */

  async function submitWalkin() {
    els.pageError.hidden = true;
    clearAllFieldErrors();

    const existing = state.patientMode === 'existing';
    const doctor = selectedDoctor();
    const errors = {};

    let name = '';
    let phone = '';

    if (existing) {
      if (!state.selectedPatient) {
        showError('Search for and select an existing patient, or switch to “New patient”.');
        return;
      }
      name = state.selectedPatient.full_name || '';
    } else {
      name = els.patientName.value.trim();
      phone = els.patientPhone.value.trim();
      if (!name) errors.patient_name = 'Patient name is required.';
      else if (name.length > 120) errors.patient_name = 'Name must be 120 characters or fewer.';
      if (phone && !PHONE_PATTERN.test(phone)) errors.patient_phone = 'Enter a valid phone number.';
    }

    if (!els.departmentSelect.value) errors.department = 'Select a department.';
    if (!doctor) errors.doctor_id = 'Select a doctor.';

    if (Object.keys(errors).length) {
      showFieldErrors(errors);
      return;
    }

    const payload = {
      doctor_id: Number(doctor.doctor_id),
      patient_name: name,
      priority: els.prioritySelect.value,
    };
    if (phone) payload.patient_phone = phone;
    if (existing) payload.patient_id = Number(state.selectedPatient.patient_id);

    const res = await Api.createWalkin(payload);

    if (!res.success) {
      if (res.errors && typeof res.errors === 'object') showFieldErrors(res.errors);
      showError(res.message || 'Something went wrong.');
      return;
    }

    renderTicket(res.data, doctor, name);
    UI.toast(`Token #${res.data.token_number} issued for ${name}.`, 'success');
    loadPreview();
  }

  /* ---- Ticket ---------------------------------------------------------- */

  function renderTicket(data, doctor, name) {
    const eta = data.estimated_wait_minutes;
    const ahead = data.patients_ahead;

    els.ticketNumber.textContent = '#' + data.token_number;
    els.ticketStatus.textContent = String(data.status || 'waiting').replace(/_/g, ' ');
    els.ticketStatus.className = 'badge badge-' + escapeAttr(data.status || 'waiting');

    if (eta == null) {
      els.ticketEta.textContent = '—';
    } else if (eta === 0) {
      els.ticketEta.textContent = 'No wait';
    } else {
      const at = new Date(Date.now() + eta * 60000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      els.ticketEta.textContent = `~${eta} min (≈ ${at})`;
    }

    const rows = [
      ['Patient', name],
      ['Doctor', doctorLabel(doctor)],
      ['Department', doctor.department_name],
      ['Priority', els.prioritySelect.value],
      ['Queue position', data.queue_position != null ? data.queue_position : '—'],
      ['Patients ahead', ahead != null ? ahead : '—'],
    ];
    if (data.avg_consultation_minutes != null) {
      rows.push(['Avg. consultation', data.avg_consultation_minutes + ' min each']);
    }

    els.ticketDetail.innerHTML = rows
      .map(([k, v]) => `<li><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></li>`)
      .join('');

    // Existing patients are linked to their own record, so there is never
    // an "unlinked walk-in" warning to show.
    els.ticketWarning.hidden = true;

    els.ticketPanel.hidden = false;
    els.ticketPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function startAnother() {
    // Keep clinic / department / doctor for quick back-to-back registration.
    els.ticketPanel.hidden = true;
    clearPatient();
    state.patients = [];
    els.patientResults.innerHTML = '';
    els.patientSearchInput.value = '';
    els.patientName.value = '';
    els.patientPhone.value = '';
    els.prioritySelect.value = 'normal';
    clearAllFieldErrors();
    setPatientMode('new');
  }

  function resetForm() {
    startAnother();
    els.departmentSelect.value = '';
    onDepartmentChange();
  }

  /* ==========================================================
     Field errors / feedback
     ========================================================== */

  function showFieldErrors(errors) {
    Object.entries(errors).forEach(([field, message]) => {
      const target = els.walkinForm.querySelector(`[data-error-for="${field}"]`);
      if (!target) return;
      target.textContent = message;
      target.closest('.form-field').classList.add('invalid');
    });
    const first = els.walkinForm.querySelector('.form-field.invalid input, .form-field.invalid select');
    if (first) first.focus();
  }

  function clearFieldError(fieldEl) {
    if (!fieldEl) return;
    fieldEl.classList.remove('invalid');
    const err = fieldEl.querySelector('.field-error');
    if (err) err.textContent = '';
  }

  function clearAllFieldErrors() {
    els.walkinForm.querySelectorAll('.form-field').forEach(clearFieldError);
  }

  function showError(message) {
    els.pageErrorText.textContent = message;
    els.pageError.hidden = false;
  }

  function normalizePhone(p) {
    return String(p || '').replace(/[^0-9]/g, '');
  }
})();
