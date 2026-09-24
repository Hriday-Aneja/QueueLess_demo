/* ==========================================================
   QueueLess — Reception: Live Queue

  Clinic -> department -> doctor pickers, the
   "Now Consulting / Up Next" hero and the full queue table all
  read from the PHP API.

   Row actions (check in / no-show / late / requeue / cancel) reuse
   ReceptionUI.handleRowAction, so they behave exactly like the
   Patients page. "Call Next" and "Complete Consultation" go through
  the existing start-consultation and complete endpoints.
   ========================================================== */

(function () {
  'use strict';

  const UI = ReceptionUI;
  const { escapeHtml, todayIso, formatFriendlyDate, doctorLabel, statusBadge, priorityBadge } = UI;

  const AUTO_REFRESH_MS = 20000;

  const state = {
    doctors: [],
    queue: [],
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
    const ids = [
      'pageDate', 'pageUpdated', 'refreshBtn', 'clinicSelect', 'departmentSelect', 'doctorSelect',
      'pageError', 'pageErrorText', 'pageErrorClose', 'noDoctorState', 'queueContent',
      'heroDoctorName', 'heroDoctorDept', 'heroCounts', 'heroCurrentValue', 'heroCurrentName',
      'heroNextValue', 'heroNextName', 'callNextBtn', 'completeBtn', 'queueCount', 'queueBody',
      'queueEmpty',
    ];
    ids.forEach((id) => (els[id] = document.getElementById(id)));

    els.pageDate.textContent = formatFriendlyDate(todayIso());
    els.pageErrorClose.addEventListener('click', () => (els.pageError.hidden = true));

    els.clinicSelect.addEventListener('change', () => loadDoctors(els.clinicSelect.value));
    els.departmentSelect.addEventListener('change', onDepartmentChange);
    els.doctorSelect.addEventListener('change', onDoctorChange);
    els.refreshBtn.addEventListener('click', () => loadQueue());

    els.callNextBtn.addEventListener('click', callNext);
    els.completeBtn.addEventListener('click', completeConsultation);

    els.queueBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn || btn.disabled) return;
      handleAction(btn.dataset.action, Number(btn.dataset.tokenId), btn);
    });

    state.refreshTimer = setInterval(() => {
      if (document.hidden || UI.isConfirmOpen() || !els.doctorSelect.value) return;
      loadQueue();
    }, AUTO_REFRESH_MS);
    window.addEventListener('beforeunload', () => clearInterval(state.refreshTimer));

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
    hideQueue();

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

    hideQueue();

    if (doctors.length === 1) {
      els.doctorSelect.value = String(doctors[0].doctor_id);
      onDoctorChange();
    }
  }

  function onDoctorChange() {
    if (els.doctorSelect.value) {
      loadQueue();
    } else {
      hideQueue();
    }
  }

  function selectedDoctor() {
    const id = els.doctorSelect.value;
    return state.doctors.find((d) => String(d.doctor_id) === id) || null;
  }

  function hideQueue() {
    els.queueContent.hidden = true;
    els.noDoctorState.hidden = false;
    els.refreshBtn.disabled = true;
  }

  /* ==========================================================
     Queue
     ========================================================== */

  async function loadQueue() {
    const doctor = selectedDoctor();
    if (!doctor) return;

    try {
      const result = await Api.receptionView(doctor.doctor_id, todayIso());
      if (!result.success) throw new Error(result.message || 'Could not load the queue.');
      state.queue = (result.data.queue || []).map((row) => Object.assign(row, { token_date: todayIso(), current_status: String(row.current_status || '').toLowerCase() }));
      renderQueue(doctor);
    } catch (err) {
      console.error('Queue load error:', err);
      showError('Could not load the queue.');
      return;
    }

    els.pageError.hidden = true;
    els.noDoctorState.hidden = true;
    els.queueContent.hidden = false;
    els.refreshBtn.disabled = false;
    els.pageUpdated.textContent = 'Updated ' + new Date().toLocaleTimeString();
  }

  function renderQueue(doctor) {
    const queue = state.queue;
    const current = queue.find((t) => t.current_status === 'consulting') || null;
    const next = UI.findNextUp(queue);
    const waiting = queue.filter((t) => UI.WAITING_STATUSES.includes(t.current_status)).length;
    const completed = queue.filter((t) => t.current_status === 'completed').length;

    // Hero
    els.heroDoctorName.textContent = doctorLabel(doctor);
    els.heroDoctorDept.textContent = doctor.department_name || '';
    els.heroCounts.textContent = `${waiting} waiting · ${completed} completed`;

    setPill(els.heroCurrentValue, els.heroCurrentName, current);
    setPill(els.heroNextValue, els.heroNextName, next);

    els.callNextBtn.disabled = !!current || !next;
    els.completeBtn.disabled = !current;

    // Table
    els.queueCount.textContent = queue.length ? `${queue.length} token${queue.length === 1 ? '' : 's'}` : '';
    els.queueEmpty.hidden = queue.length > 0;

    els.queueBody.innerHTML = queue
      .map((t) => {
        const live = UI.LIVE_STATUSES.includes(t.current_status);
        const row = rowFromToken(t);
        return `
        <tr>
          <td>#${escapeHtml(t.token_number)}</td>
          <td>${escapeHtml(t.patient_name || '—')}</td>
          <td>${escapeHtml(t.token_type || '—')}</td>
          <td>${priorityBadge(t.priority)}</td>
          <td>${statusBadge(t.current_status)}</td>
          <td>${live && t.queue_position != null ? escapeHtml(t.queue_position) : '—'}</td>
          <td>${live && t.estimated_wait_minutes != null ? escapeHtml(t.estimated_wait_minutes) + ' min' : '—'}</td>
          <td>${UI.actionButtonsHtml(row)}</td>
        </tr>`;
      })
      .join('');
  }

  function setPill(valueEl, nameEl, token) {
    valueEl.textContent = token ? '#' + token.token_number : '—';
    valueEl.classList.toggle('none', !token);
    nameEl.textContent = token ? token.patient_name || '' : '';
  }

  // Shape expected by ReceptionUI.actionsFor / handleRowAction.
  function rowFromToken(t) {
    return {
      tokenId: Number(t.token_id),
      tokenNumber: t.token_number,
      patientName: t.patient_name || '—',
      date: t.token_date,
      status: t.current_status,
    };
  }

  /* ==========================================================
     Actions
     ========================================================== */

  async function callNext() {
    const doctor = selectedDoctor();
    if (!doctor) return;

    const next = UI.findNextUp(state.queue);
    const res = next ? await Api.startConsultation(Number(next.token_id)) : { success: false, message: 'No patient is ready to call.' };
    if (res.success) {
      UI.toast(`Consultation started for token #${next.token_number}.`, 'success');
    } else {
      UI.toast(res.message || 'Could not call the next patient.', 'error');
    }
    loadQueue();
  }

  async function completeConsultation() {
    const doctor = selectedDoctor();
    if (!doctor) return;

    const current = state.queue.find((token) => String(token.current_status).toLowerCase() === 'consulting');
    const res = current ? await Api.completeConsultation(Number(current.token_id)) : { success: false, message: 'No consultation is in progress.' };
    if (res.success) {
      UI.toast(`Consultation completed for token #${res.data.completed_token}.`, 'success');
    } else {
      UI.toast(res.message || 'Could not complete the consultation.', 'error');
    }
    loadQueue();
  }

  function handleAction(action, tokenId, button) {
    const token = state.queue.find((t) => Number(t.token_id) === tokenId);
    if (!token) return;

    UI.handleRowAction(action, rowFromToken(token), () => loadQueue(), button);
  }

  /* ==========================================================
     Feedback helpers
     ========================================================== */

  function showError(message) {
    els.pageErrorText.textContent = message;
    els.pageError.hidden = false;
  }
})();
