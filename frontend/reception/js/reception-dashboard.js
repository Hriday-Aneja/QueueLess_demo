/* ==========================================================
   QueueLess — Reception Dashboard JS

  Reads clinics, doctors and each doctor's queue from the PHP API.
   ========================================================== */

(function () {
  'use strict';

  const UI = ReceptionUI;
  const { escapeHtml, escapeAttr, todayIso, formatFriendlyDate, doctorLabel } = UI;

  const AUTO_REFRESH_MS = 20000;

  // Statuses that count as "waiting" for the queue, mirroring the
  // same grouping used by the admin dashboard so reception and
  // admin agree on what "waiting" means.
  const WAITING_STATUSES = UI.WAITING_STATUSES;
  const CONSULTING_STATUSES = ['consulting'];
  const DONE_STATUS = 'completed';
  const NO_SHOW_STATUS = 'no_show';

  let doctorsCache = [];       // doctor list for the selected clinic
  let latestByDoctor = {};     // doctor_id -> { doctor, queue: [...] }

  document.addEventListener('reception:ready', () => {
    initDashboard();
  });

  /* ==========================================================
     Dashboard
     ========================================================== */

  function initDashboard() {
    let refreshTimer = null;

    const loadingEl = document.getElementById('dashLoading');
    const contentEl = document.getElementById('dashContent');
    const errorEl = document.getElementById('dashError');
    const errorTextEl = document.getElementById('dashErrorText');
    const refreshBtn = document.getElementById('refreshBtn');
    const retryBtn = document.getElementById('retryBtn');
    const clinicSelect = document.getElementById('clinicSelect');
    const dashDate = document.getElementById('dashDate');

    dashDate.textContent = formatFriendlyDate(todayIso());

    refreshBtn.addEventListener('click', () => load({ silent: false }));
    retryBtn.addEventListener('click', () => load({ silent: false }));
    clinicSelect.addEventListener('change', () => load({ silent: false }));

    setupModal();

    bootstrapClinics();

    async function bootstrapClinics() {
      const result = await Api.listClinics();
      if (!result.success) { showError(result.message || 'Could not load clinics.'); return; }
      const clinics = result.data.clinics || [];
      if (clinics.length === 0) {
        showError('No clinics are configured yet.');
        return;
      }

      clinicSelect.innerHTML = clinics
        .map((c) => `<option value="${c.clinic_id}">${escapeHtml(c.clinic_name)}</option>`)
        .join('');

      const remembered = sessionStorage.getItem('queueless_reception_clinic');
      clinicSelect.value = clinics.some((clinic) => String(clinic.clinic_id) === remembered) ? remembered : String(clinics[0].clinic_id);
      load({ silent: false });

      refreshTimer = setInterval(() => load({ silent: true }), AUTO_REFRESH_MS);
      window.addEventListener('beforeunload', () => clearInterval(refreshTimer));
    }

    async function load({ silent }) {
      if (!silent) {
        errorEl.hidden = true;
        contentEl.hidden = true;
        loadingEl.hidden = false;
      }

      const clinicId = clinicSelect.value;
      if (!clinicId) return;
      sessionStorage.setItem('queueless_reception_clinic', clinicId);

      try {
        const doctorResult = await Api.listDoctors(clinicId);
        if (!doctorResult.success) throw new Error(doctorResult.message || 'Could not load doctors.');
        doctorsCache = doctorResult.data.doctors || [];
        const today = todayIso();

        latestByDoctor = {};
        await Promise.all(doctorsCache.map(async (doc) => {
          const queueResult = await Api.receptionView(doc.doctor_id, today);
          if (!queueResult.success) throw new Error(queueResult.message || 'Could not load queue.');
          latestByDoctor[doc.doctor_id] = { doctor: doc, queue: (queueResult.data.queue || []).map((row) => Object.assign(row, { token_date: today, current_status: String(row.current_status || '').toLowerCase() })) };
        }));

        renderDashboard(Object.values(latestByDoctor));
      } catch (err) {
        console.error('Dashboard load error:', err);
        showError('Could not load queue data.');
        return;
      }

      loadingEl.hidden = true;
      errorEl.hidden = true;
      contentEl.hidden = false;

      document.getElementById('dashUpdated').textContent =
        'Updated ' + new Date().toLocaleTimeString();
    }

    function showError(message) {
      loadingEl.hidden = true;
      contentEl.hidden = true;
      errorTextEl.textContent = message;
      errorEl.hidden = false;
    }
  }

  /* ---- Aggregation + rendering --------------------------------- */

  function renderDashboard(doctorEntries) {
    const allTokens = doctorEntries.flatMap((e) =>
      e.queue.map((t) => ({ ...t, _doctor: e.doctor }))
    );

    renderKpis(doctorEntries, allTokens);
    renderDepartments(doctorEntries);
    renderDoctors(doctorEntries);
  }

  function renderKpis(doctorEntries, allTokens) {
    const totalToday = allTokens.length;
    const waiting = allTokens.filter((t) => WAITING_STATUSES.includes(t.current_status)).length;
    const consulting = allTokens.filter((t) => CONSULTING_STATUSES.includes(t.current_status)).length;
    const completed = allTokens.filter((t) => t.current_status === DONE_STATUS).length;
    const noShow = allTokens.filter((t) => t.current_status === NO_SHOW_STATUS).length;
    const activeDoctors = doctorEntries.filter((e) => e.queue.length > 0).length;

    const cards = [
      { label: "Today's Appointments", value: totalToday, sub: `${doctorEntries.length} doctor(s) in clinic` },
      { label: 'Waiting', value: waiting, cls: 'accent-waiting', sub: 'Across all doctors' },
      { label: 'Currently Consulting', value: consulting, cls: 'accent-consult', sub: 'In progress now' },
      { label: 'Completed Today', value: completed, cls: 'accent-done', sub: 'Consultations finished' },
      { label: 'No-shows Today', value: noShow, cls: 'accent-alert', sub: 'Missed their turn' },
      { label: 'Active Doctors', value: activeDoctors, sub: `of ${doctorEntries.length} in clinic` },
    ];

    document.getElementById('kpiGrid').innerHTML = cards
      .map(
        (c) => `
        <div class="kpi-card">
          <p class="kpi-label">${escapeHtml(c.label)}</p>
          <p class="kpi-value${c.cls ? ' ' + c.cls : ''}">${c.value}</p>
          <p class="kpi-sub">${escapeHtml(c.sub)}</p>
        </div>`
      )
      .join('');
  }

  function renderDepartments(doctorEntries) {
    const byDept = {};
    doctorEntries.forEach((e) => {
      const key = e.doctor.department_name || 'Unassigned';
      if (!byDept[key]) {
        byDept[key] = { total: 0, waiting: 0, consulting: 0, doctors: new Set() };
      }
      byDept[key].doctors.add(doctorLabel(e.doctor));
      e.queue.forEach((t) => {
        byDept[key].total++;
        if (WAITING_STATUSES.includes(t.current_status)) byDept[key].waiting++;
        if (CONSULTING_STATUSES.includes(t.current_status)) byDept[key].consulting++;
      });
    });

    const deptNames = Object.keys(byDept).sort();
    document.getElementById('deptCount').textContent = deptNames.length
      ? `${deptNames.length} department(s)`
      : '';
    document.getElementById('deptEmpty').hidden = deptNames.length > 0;

    document.getElementById('deptGrid').innerHTML = deptNames
      .map((name) => {
        const d = byDept[name];
        return `
        <div class="dept-card">
          <p class="dept-card-name">${escapeHtml(name)}</p>
          <div class="dept-card-stats">
            <div class="dept-stat">
              <span class="dept-stat-value">${d.total}</span>
              <span class="dept-stat-label">Total</span>
            </div>
            <div class="dept-stat">
              <span class="dept-stat-value">${d.waiting}</span>
              <span class="dept-stat-label">Waiting</span>
            </div>
            <div class="dept-stat">
              <span class="dept-stat-value">${d.consulting}</span>
              <span class="dept-stat-label">Consulting</span>
            </div>
          </div>
          <p class="dept-card-doctors">${d.doctors.size} doctor(s): ${escapeHtml(
          Array.from(d.doctors).join(', ')
        )}</p>
        </div>`;
      })
      .join('');
  }

  function renderDoctors(doctorEntries) {
    document.getElementById('doctorCount').textContent = doctorEntries.length
      ? `${doctorEntries.length} doctor(s)`
      : '';
    document.getElementById('doctorEmpty').hidden = doctorEntries.length > 0;

    document.getElementById('doctorGrid').innerHTML = doctorEntries
      .map((e) => {
        const current = e.queue.find((t) => t.current_status === 'consulting');
        const next = UI.findNextUp(e.queue);
        const waitingCount = e.queue.filter((t) => WAITING_STATUSES.includes(t.current_status)).length;

        return `
        <div class="doctor-card" data-doctor-id="${e.doctor.doctor_id}">
          <div class="doctor-card-head">
            <div>
              <p class="doctor-card-name">${escapeHtml(doctorLabel(e.doctor))}</p>
              <p class="doctor-card-dept">${escapeHtml(e.doctor.department_name || '')}</p>
            </div>
          </div>
          <div class="doctor-card-tokens">
            <div class="token-pill current">
              <span class="token-pill-label">Current</span>
              <span class="token-pill-value${current ? '' : ' none'}">${
          current ? '#' + current.token_number : '—'
        }</span>
            </div>
            <div class="token-pill next">
              <span class="token-pill-label">Next</span>
              <span class="token-pill-value${next ? '' : ' none'}">${
          next ? '#' + next.token_number : '—'
        }</span>
            </div>
          </div>
          <div class="doctor-card-foot">
            <span class="doctor-card-waiting">${waitingCount} waiting</span>
            <span class="doctor-card-view">View queue →</span>
          </div>
        </div>`;
      })
      .join('');

    document.querySelectorAll('.doctor-card').forEach((card) => {
      card.addEventListener('click', () => {
        const doctorId = card.getAttribute('data-doctor-id');
        openDoctorModal(doctorId);
      });
    });
  }

  /* ---- Doctor detail modal --------------------------------------- */

  function setupModal() {
    const overlay = document.getElementById('doctorModalOverlay');
    const closeBtn = document.getElementById('doctorModalClose');
    closeBtn.addEventListener('click', () => (overlay.hidden = true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.hidden = true;
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') overlay.hidden = true;
    });
  }

  function openDoctorModal(doctorId) {
    const entry = latestByDoctor[doctorId];
    if (!entry) return;

    document.getElementById('doctorModalTitle').textContent = doctorLabel(entry.doctor);
    const tbody = document.getElementById('doctorModalTableBody');
    const emptyEl = document.getElementById('doctorModalEmpty');

    const rows = [...entry.queue].sort((a, b) => {
      const posA = a.queue_position === null ? Infinity : a.queue_position;
      const posB = b.queue_position === null ? Infinity : b.queue_position;
      return posA - posB || a.token_number - b.token_number;
    });

    emptyEl.hidden = rows.length > 0;

    tbody.innerHTML = rows
      .map(
        (t) => `
        <tr>
          <td>#${t.token_number}</td>
          <td>${escapeHtml(t.patient_name || '—')}</td>
          <td>${escapeHtml(t.token_type || '—')}</td>
          <td>${priorityBadge(t.priority)}</td>
          <td>${statusBadge(t.current_status)}</td>
          <td>${t.queue_position !== null && t.queue_position !== undefined ? t.queue_position : '—'}</td>
          <td>${t.estimated_wait_minutes !== null && t.estimated_wait_minutes !== undefined ? t.estimated_wait_minutes + ' min' : '—'}</td>
        </tr>`
      )
      .join('');

    document.getElementById('doctorModalOverlay').hidden = false;
  }

  /* ---- Small helpers --------------------------------------------- */

  function statusBadge(status) {
    const label = (status || 'unknown').replace(/_/g, ' ');
    return `<span class="badge badge-${escapeAttr(status || 'unknown')}">${escapeHtml(label)}</span>`;
  }

  function priorityBadge(priority) {
    const p = priority || 'normal';
    return `<span class="badge badge-priority-${escapeAttr(p)}">${escapeHtml(p)}</span>`;
  }
})();