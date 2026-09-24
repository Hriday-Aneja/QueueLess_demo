/* ==========================================================
   QueueLess — Admin Panel JS
   Phase 1: login, session guard, logout.
   Phase 2: dashboard rendering (KPIs, charts, tables), wired
   from the same session guard once the admin is confirmed.
   ========================================================== */

(function () {
  'use strict';

  const AUTO_REFRESH_MS = 30000;

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('adminLoginForm');
    const guardedBody = document.querySelector('body[data-requires-auth="admin"]');

    if (loginForm) {
      initLoginPage(loginForm);
    }

    if (guardedBody) {
      initGuardedPage(guardedBody);
    }
  });

  /* ---- Login page ---------------------------------------- */

  function initLoginPage(form) {
    // If an admin session already exists, skip the login form.
    Api.me().then((res) => {
      if (res.success && res.data.role === 'admin') {
        window.location.replace('dashboard.html');
      }
    });

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const formAlert = document.getElementById('formAlert');
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      const clientErrors = validateClientSide(email, password);
      if (Object.keys(clientErrors).length > 0) {
        showFieldErrors(clientErrors);
        return;
      }

      setLoading(true);

      const res = await Api.login({ email, password });

      if (!res.success) {
        setLoading(false);
        if (res.errors) {
          showFieldErrors(res.errors);
        }
        showFormAlert(res.message || 'Login failed. Please try again.');
        return;
      }

      if (res.data.role !== 'admin') {
        // Valid credentials, but not an admin account — this panel
        // is admin-only, so end the session immediately rather than
        // leaving a non-admin session active on the admin panel.
        await Api.logout();
        setLoading(false);
        showFormAlert('This login is for administrator accounts only.');
        return;
      }

      window.location.href = 'dashboard.html';
    });

    function validateClientSide(email, password) {
      const errors = {};
      if (!email) {
        errors.email = 'Email is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = 'Enter a valid email address.';
      }
      if (!password) {
        errors.password = 'Password is required.';
      }
      return errors;
    }

    function showFieldErrors(errors) {
      if (errors.email) {
        emailError.textContent = errors.email;
        emailInput.classList.add('input-invalid');
      }
      if (errors.password) {
        passwordError.textContent = errors.password;
        passwordInput.classList.add('input-invalid');
      }
    }

    function showFormAlert(message) {
      formAlert.textContent = message;
      formAlert.hidden = false;
    }

    function clearErrors() {
      emailError.textContent = '';
      passwordError.textContent = '';
      emailInput.classList.remove('input-invalid');
      passwordInput.classList.remove('input-invalid');
      formAlert.hidden = true;
      formAlert.textContent = '';
    }

    function setLoading(isLoading) {
      loginBtn.disabled = isLoading;
      loginBtnText.textContent = isLoading ? 'Logging in…' : 'Log In';
    }
  }

  /* ---- Guarded pages (dashboard.html and future admin pages) --- */

  function initGuardedPage(body) {
    Api.me().then((res) => {
      if (!res.success) {
        window.location.replace('index.html');
        return;
      }

      if (res.data.role !== 'admin') {
        // Logged in, but as some other role — not allowed in this panel.
        Api.logout().finally(() => window.location.replace('index.html'));
        return;
      }

      const nameEl = document.getElementById('adminUserName');
      if (nameEl) {
        nameEl.textContent = res.data.name || res.data.email || 'Admin';
      }

      body.hidden = false;
      highlightActiveNav();

      // Page-specific init, based on which markup is actually present.
      if (document.getElementById('kpiGrid')) {
        initDashboard();
      }
      if (document.getElementById('clinicsTable')) {
        initHospitalsPage();
      }
      if (document.getElementById('doctorsTable')) {
        initDoctorsPage();
      }
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        await Api.logout();
        window.location.href = 'index.html';
      });
    }
  }

  function highlightActiveNav() {
    const page = window.location.pathname.split('/').pop().replace('.html', '') || 'dashboard';
    document.querySelectorAll('.admin-nav-link').forEach((link) => {
      link.classList.toggle('active', link.dataset.nav === page);
    });
  }

  /* ==========================================================
     Dashboard (Phase 2)
     ========================================================== */

  function initDashboard() {
    let refreshTimer = null;

    const loadingEl = document.getElementById('dashLoading');
    const contentEl = document.getElementById('dashContent');
    const errorEl = document.getElementById('dashError');
    const errorTextEl = document.getElementById('dashErrorText');
    const refreshBtn = document.getElementById('refreshBtn');
    const retryBtn = document.getElementById('retryBtn');

    refreshBtn.addEventListener('click', () => load({ silent: false }));
    retryBtn.addEventListener('click', () => load({ silent: false }));

    load({ silent: false });

    // Keep the numbers current without the user having to think about it.
    refreshTimer = setInterval(() => load({ silent: true }), AUTO_REFRESH_MS);
    window.addEventListener('beforeunload', () => clearInterval(refreshTimer));

    async function load({ silent }) {
      if (!silent) {
        errorEl.hidden = true;
        contentEl.hidden = true;
        loadingEl.hidden = false;
      }

      refreshBtn.disabled = true;

      const res = await Api.adminData();

      refreshBtn.disabled = false;

      if (!res.success) {
        loadingEl.hidden = true;
        contentEl.hidden = true;
        errorTextEl.textContent = res.message || 'Could not load dashboard data.';
        errorEl.hidden = false;
        return;
      }

      render(res.data);

      loadingEl.hidden = true;
      errorEl.hidden = true;
      contentEl.hidden = false;
    }

    function render(data) {
      document.getElementById('dashDate').textContent = 'Live snapshot for ' + data.date;
      document.getElementById('dashUpdated').textContent =
        'Updated ' + formatTime(data.generated_at);

      renderKpis(data.kpis);
      renderStatusChart(data.status_breakdown);
      renderHourlyChart(data.hourly_load);
      renderAppointments(data.appointments);
      renderQueue(data.queue);
    }

    function renderKpis(kpis) {
      const cards = [
        { label: 'Patients Today', value: kpis.patients_today },
        { label: 'Appointments Today', value: kpis.appointments_today },
        { label: 'Patients Served', value: kpis.patients_served, tone: 'good' },
        { label: 'Currently Waiting', value: kpis.currently_waiting },
        {
          label: 'Avg. Waiting Time',
          value: kpis.avg_waiting_minutes === null ? '—' : kpis.avg_waiting_minutes,
          unit: kpis.avg_waiting_minutes === null ? '' : 'min',
        },
        {
          label: 'No-shows',
          value: kpis.no_show_count,
          sub: kpis.no_show_rate + '% of today\u2019s tokens',
          tone: kpis.no_show_count > 0 ? 'danger' : undefined,
        },
        {
          label: 'Active Doctors',
          value: kpis.active_doctors,
          sub: 'of ' + kpis.total_doctors + ' total',
        },
      ];

      document.getElementById('kpiGrid').innerHTML = cards.map((c) => `
        <div class="kpi-card${c.tone ? ' kpi-' + c.tone : ''}">
          <p class="kpi-label">${escapeHtml(c.label)}</p>
          <div class="kpi-value">${escapeHtml(String(c.value))}${c.unit ? `<span class="kpi-unit">${escapeHtml(c.unit)}</span>` : ''}</div>
          ${c.sub ? `<p class="kpi-sub">${escapeHtml(c.sub)}</p>` : ''}
        </div>
      `).join('');
    }

    function renderStatusChart(breakdown) {
      const entries = Object.entries(breakdown);
      const max = Math.max(1, ...entries.map(([, n]) => n));
      const el = document.getElementById('statusChart');

      if (entries.every(([, n]) => n === 0)) {
        el.innerHTML = '<p class="chart-empty">No appointments today.</p>';
        return;
      }

      el.innerHTML = entries.map(([status, n]) => `
        <div class="bar-row">
          <span class="bar-row-label">${escapeHtml(status.replace('_', ' '))}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${(n / max) * 100}%"></span></span>
          <span class="bar-row-value">${n}</span>
        </div>
      `).join('');
    }

    function renderHourlyChart(hourly) {
      const el = document.getElementById('hourlyChart');

      if (!hourly.length) {
        el.innerHTML = '<p class="chart-empty">No appointments today.</p>';
        return;
      }

      const max = Math.max(1, ...hourly.map((h) => h.count));

      el.innerHTML = hourly.map((h) => `
        <div class="bar-col">
          <span class="bar-col-value">${h.count}</span>
          <span class="bar-col-fill" style="height:${Math.max(4, (h.count / max) * 100)}%"></span>
          <span class="bar-col-label">${escapeHtml(h.hour)}</span>
        </div>
      `).join('');
    }

    function renderAppointments(rows) {
      document.getElementById('apptCount').textContent = rows.length + ' today';
      document.getElementById('apptEmpty').hidden = rows.length > 0;

      document.getElementById('apptTableBody').innerHTML = rows.map((r) => `
        <tr>
          <td>${escapeHtml(r.time)}</td>
          <td>${escapeHtml(r.patient_name)}</td>
          <td>${escapeHtml(r.doctor_name)}</td>
          <td>${escapeHtml(r.department_name)}</td>
          <td>${escapeHtml(r.type)}</td>
          <td>${priorityBadge(r.priority)}</td>
          <td>${statusBadge(r.status)}</td>
        </tr>
      `).join('');
    }

    function renderQueue(rows) {
      document.getElementById('queueCount').textContent = rows.length + ' active';
      document.getElementById('queueEmpty').hidden = rows.length > 0;

      document.getElementById('queueTableBody').innerHTML = rows.map((r) => `
        <tr>
          <td>#${r.token_number}</td>
          <td>${escapeHtml(r.patient_name)}</td>
          <td>${escapeHtml(r.doctor_name)}</td>
          <td>${escapeHtml(r.department_name)}</td>
          <td>${escapeHtml(r.type)}</td>
          <td>${priorityBadge(r.priority)}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${r.queue_position === null ? '—' : r.queue_position}</td>
          <td>${r.eta_minutes === null ? '—' : r.eta_minutes + ' min'}</td>
        </tr>
      `).join('');
    }

    function statusBadge(status) {
      return `<span class="badge badge-${escapeAttr(status)}">${escapeHtml(status.replace('_', ' '))}</span>`;
    }

    function priorityBadge(priority) {
      return `<span class="badge badge-priority-${escapeAttr(priority)}">${escapeHtml(priority)}</span>`;
    }

    function formatTime(datetimeStr) {
      // datetimeStr is 'YYYY-MM-DD HH:MM:SS' from the server.
      const d = new Date(datetimeStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return datetimeStr;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  /* ==========================================================
     Hospitals / Clinics management (Phase 3)
     ========================================================== */

  function initHospitalsPage() {
    let clinics = [];
    const expandedIds = new Set();
    const deptCache = {}; // clinic_id -> departments array (undefined = not loaded yet)
    const deptErrors = {}; // clinic_id -> safe error message from the last failed load

    const errorEl = document.getElementById('clinicsError');
    const errorTextEl = document.getElementById('clinicsErrorText');
    const retryBtn = document.getElementById('clinicsRetryBtn');
    const loadingEl = document.getElementById('clinicsLoading');
    const emptyEl = document.getElementById('clinicsEmpty');
    const tbody = document.getElementById('clinicsTableBody');
    const toastEl = document.getElementById('clinicsToast');

    const backdrop = document.getElementById('clinicModalBackdrop');
    const form = document.getElementById('clinicForm');
    const modalTitle = document.getElementById('clinicModalTitle');
    const formAlert = document.getElementById('clinicFormAlert');
    const saveBtn = document.getElementById('clinicSaveBtn');

    const deptBackdrop = document.getElementById('departmentModalBackdrop');
    const deptForm = document.getElementById('departmentForm');
    const deptModalTitle = document.getElementById('departmentModalTitle');
    const deptModalClinicName = document.getElementById('departmentModalClinicName');
    const deptFormAlert = document.getElementById('departmentFormAlert');
    const deptSaveBtn = document.getElementById('departmentSaveBtn');

    document.getElementById('addClinicBtn').addEventListener('click', () => openModal(null));
    document.getElementById('clinicCancelBtn').addEventListener('click', closeModal);
    retryBtn.addEventListener('click', load);
    form.addEventListener('submit', onSubmit);

    document.getElementById('departmentCancelBtn').addEventListener('click', closeDeptModal);
    deptForm.addEventListener('submit', onDeptSubmit);

    load();

    async function load() {
      errorEl.hidden = true;
      emptyEl.hidden = true;
      loadingEl.hidden = false;

      const res = await Api.adminListClinics();

      loadingEl.hidden = true;

      if (!res.success) {
        errorTextEl.textContent = res.message || 'Could not load hospitals.';
        errorEl.hidden = false;
        return;
      }

      clinics = res.data.clinics;
      renderTable();
    }

    function renderTable() {
      if (clinics.length === 0) {
        emptyEl.hidden = false;
        tbody.innerHTML = '';
        return;
      }
      emptyEl.hidden = true;

      tbody.innerHTML = clinics.map((c) => {
        const isExpanded = expandedIds.has(c.clinic_id);
        const row = `
        <tr>
          <td>${escapeHtml(c.clinic_name)}</td>
          <td>${escapeHtml(c.address || '—')}</td>
          <td>${escapeHtml(c.phone || '—')}</td>
          <td><button type="button" class="dept-toggle-btn" data-dept-toggle="${c.clinic_id}">${c.departments.length} department${c.departments.length === 1 ? '' : 's'} ${isExpanded ? '▾' : '▸'}</button></td>
          <td>${simpleBadge(c.is_active ? 'completed' : 'cancelled', c.is_active ? 'Active' : 'Inactive')}</td>
          <td>
            <div class="row-actions">
              <button type="button" class="btn-link" data-edit="${c.clinic_id}">Edit</button>
              <button type="button" class="btn-link ${c.is_active ? 'danger' : 'good'}" data-toggle="${c.clinic_id}">
                ${c.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </td>
        </tr>`;

        const subrow = isExpanded ? `
        <tr class="dept-subrow">
          <td colspan="6">${renderDeptPanel(c)}</td>
        </tr>` : '';

        return row + subrow;
      }).join('');

      tbody.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const clinic = clinics.find((c) => c.clinic_id === Number(btn.dataset.edit));
          if (clinic) openModal(clinic);
        });
      });
      tbody.querySelectorAll('[data-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const clinic = clinics.find((c) => c.clinic_id === Number(btn.dataset.toggle));
          if (clinic) toggleActive(clinic);
        });
      });
      tbody.querySelectorAll('[data-dept-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => onDeptToggleExpand(Number(btn.dataset.deptToggle)));
      });
      tbody.querySelectorAll('[data-add-dept]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const clinic = clinics.find((c) => c.clinic_id === Number(btn.dataset.addDept));
          if (clinic) openDeptModal(clinic, null);
        });
      });
      tbody.querySelectorAll('[data-dept-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const clinic = clinics.find((c) => c.clinic_id === Number(btn.dataset.clinicId));
          const dept = (deptCache[btn.dataset.clinicId] || []).find((d) => d.department_id === Number(btn.dataset.deptEdit));
          if (clinic && dept) openDeptModal(clinic, dept);
        });
      });
      tbody.querySelectorAll('[data-dept-toggle-active]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const dept = (deptCache[btn.dataset.clinicId] || []).find((d) => d.department_id === Number(btn.dataset.deptToggleActive));
          if (dept) toggleDeptActive(dept);
        });
      });
      tbody.querySelectorAll('[data-dept-retry]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const clinicId = Number(btn.dataset.deptRetry);
          delete deptErrors[clinicId];
          renderTable();
          refreshDepartments(clinicId).then(renderTable);
        });
      });
    }

    /* ---- Hospital modal ---- */

    function openModal(clinic) {
      form.reset();
      clearFormErrors(form, formAlert);
      document.getElementById('clinicId').value = clinic ? clinic.clinic_id : '';
      document.getElementById('clinicName').value = clinic ? clinic.clinic_name : '';
      document.getElementById('clinicAddress').value = clinic ? (clinic.address || '') : '';
      document.getElementById('clinicPhone').value = clinic ? (clinic.phone || '') : '';
      document.getElementById('clinicActive').checked = clinic ? clinic.is_active : true;
      modalTitle.textContent = clinic ? 'Edit Hospital' : 'Add Hospital';
      backdrop.hidden = false;
    }

    function closeModal() {
      backdrop.hidden = true;
    }

    async function onSubmit(e) {
      e.preventDefault();
      clearFormErrors(form, formAlert);

      const name = document.getElementById('clinicName').value.trim();
      if (!name) {
        showFieldError('clinicName', 'Hospital name is required.');
        return;
      }

      const payload = {
        clinic_name: name,
        address: document.getElementById('clinicAddress').value.trim(),
        phone: document.getElementById('clinicPhone').value.trim(),
        is_active: document.getElementById('clinicActive').checked,
      };
      const clinicId = document.getElementById('clinicId').value;
      if (clinicId) payload.clinic_id = Number(clinicId);

      saveBtn.disabled = true;
      const res = await Api.adminSaveClinic(payload);
      saveBtn.disabled = false;

      if (!res.success) {
        if (res.errors) {
          Object.entries(res.errors).forEach(([field, msg]) => {
            const id = 'clinic' + field.charAt(0).toUpperCase() + field.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            showFieldError(id, msg);
          });
        }
        formAlert.textContent = res.message || 'Could not save hospital.';
        formAlert.hidden = false;
        return;
      }

      closeModal();
      showToast(toastEl, clinicId ? 'Hospital updated.' : 'Hospital added.');
      load();
    }

    async function toggleActive(clinic) {
      const action = clinic.is_active ? 'deactivate' : 'activate';
      if (!confirm(`Are you sure you want to ${action} "${clinic.clinic_name}"?`)) return;

      const res = await Api.adminSaveClinic({
        clinic_id: clinic.clinic_id,
        clinic_name: clinic.clinic_name,
        address: clinic.address,
        phone: clinic.phone,
        is_active: !clinic.is_active,
      });

      if (!res.success) {
        alert(res.message || 'Could not update hospital status.');
        return;
      }

      showToast(toastEl, `Hospital ${action}d.`);
      load();
    }

    /* ---- Departments (nested under a hospital row) ---- */

    function renderDeptPanel(clinic) {
      const depts = deptCache[clinic.clinic_id];
      const error = deptErrors[clinic.clinic_id];

      let body;
      if (error) {
        body = `
          <div class="dept-error" role="alert">
            <span>${escapeHtml(error)}</span>
            <button type="button" class="btn-secondary" data-dept-retry="${clinic.clinic_id}">Retry</button>
          </div>`;
      } else if (depts === undefined) {
        body = '<p class="dept-loading">Loading departments…</p>';
      } else if (depts.length === 0) {
        body = '<p class="dept-empty">No departments yet for this hospital.</p>';
      } else {
        body = `
          <table class="dept-table">
            <thead>
              <tr><th>Name</th><th>Description</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              ${depts.map((d) => `
                <tr>
                  <td>${escapeHtml(d.department_name)}</td>
                  <td>${escapeHtml(d.description || '—')}</td>
                  <td>${simpleBadge(d.is_active ? 'completed' : 'cancelled', d.is_active ? 'Active' : 'Inactive')}</td>
                  <td>
                    <div class="row-actions">
                      <button type="button" class="btn-link" data-dept-edit="${d.department_id}" data-clinic-id="${clinic.clinic_id}">Edit</button>
                      <button type="button" class="btn-link ${d.is_active ? 'danger' : 'good'}" data-dept-toggle-active="${d.department_id}" data-clinic-id="${clinic.clinic_id}">
                        ${d.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>`;
      }

      return `
        <div class="dept-panel-header">
          <span class="dept-panel-title">Departments — ${escapeHtml(clinic.clinic_name)}</span>
          <button type="button" class="btn-link" data-add-dept="${clinic.clinic_id}">+ Add Department</button>
        </div>
        ${body}`;
    }

    function onDeptToggleExpand(clinicId) {
      if (expandedIds.has(clinicId)) {
        expandedIds.delete(clinicId);
        renderTable();
        return;
      }
      expandedIds.add(clinicId);
      renderTable();
      if (deptCache[clinicId] === undefined) {
        refreshDepartments(clinicId).then(renderTable);
      }
    }

    async function refreshDepartments(clinicId) {
      const res = await Api.adminListDepartments(clinicId);

      if (!res.success) {
        // Never silently turn a failed load into an empty department list —
        // that looks identical to "this hospital genuinely has none" and
        // hides real API/DB problems from the admin. Show the safe message
        // the backend gave us, and log the full response for debugging.
        console.error('Failed to load departments for clinic', clinicId, res);
        deptErrors[clinicId] = res.message || 'Could not load departments. Please try again.';
        delete deptCache[clinicId];
        return;
      }

      delete deptErrors[clinicId];
      deptCache[clinicId] = res.data.departments;
    }

    function openDeptModal(clinic, dept) {
      deptForm.reset();
      clearFormErrors(deptForm, deptFormAlert);
      document.getElementById('departmentId').value = dept ? dept.department_id : '';
      document.getElementById('departmentClinicId').value = clinic.clinic_id;
      document.getElementById('departmentName').value = dept ? dept.department_name : '';
      document.getElementById('departmentDescription').value = dept ? (dept.description || '') : '';
      document.getElementById('departmentActive').checked = dept ? dept.is_active : true;
      deptModalTitle.textContent = dept ? 'Edit Department' : 'Add Department';
      deptModalClinicName.textContent = clinic.clinic_name;
      deptBackdrop.hidden = false;
    }

    function closeDeptModal() {
      deptBackdrop.hidden = true;
    }

    async function onDeptSubmit(e) {
      e.preventDefault();
      clearFormErrors(deptForm, deptFormAlert);

      const name = document.getElementById('departmentName').value.trim();
      if (!name) {
        showFieldError('departmentName', 'Department name is required.');
        return;
      }

      const clinicId = Number(document.getElementById('departmentClinicId').value);
      const payload = {
        clinic_id: clinicId,
        department_name: name,
        description: document.getElementById('departmentDescription').value.trim(),
        is_active: document.getElementById('departmentActive').checked,
      };
      const departmentId = document.getElementById('departmentId').value;
      if (departmentId) payload.department_id = Number(departmentId);

      deptSaveBtn.disabled = true;
      const res = await Api.adminSaveDepartment(payload);
      deptSaveBtn.disabled = false;

      if (!res.success) {
        if (res.errors) {
          Object.entries(res.errors).forEach(([field, msg]) => {
            const id = 'department' + field.charAt(0).toUpperCase() + field.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            showFieldError(id, msg);
          });
        }
        deptFormAlert.textContent = res.message || 'Could not save department.';
        deptFormAlert.hidden = false;
        return;
      }

      closeDeptModal();
      showToast(toastEl, departmentId ? 'Department updated.' : 'Department added.');
      expandedIds.add(clinicId);
      await refreshDepartments(clinicId);
      load();
    }

    async function toggleDeptActive(dept) {
      const action = dept.is_active ? 'deactivate' : 'activate';
      if (!confirm(`Are you sure you want to ${action} the "${dept.department_name}" department?`)) return;

      const res = await Api.adminSaveDepartment({
        department_id: dept.department_id,
        clinic_id: dept.clinic_id,
        department_name: dept.department_name,
        description: dept.description,
        is_active: !dept.is_active,
      });

      if (!res.success) {
        alert(res.message || 'Could not update department status.');
        return;
      }

      showToast(toastEl, `Department ${action}d.`);
      await refreshDepartments(dept.clinic_id);
      load();
    }
  }

  /* ==========================================================
     Doctors management (Phase 3)
     ========================================================== */

  function initDoctorsPage() {
    let clinics = [];   // full clinic+department tree, for dropdowns
    let doctors = [];   // last loaded doctor rows
    let searchDebounce = null;

    const errorEl = document.getElementById('doctorsError');
    const errorTextEl = document.getElementById('doctorsErrorText');
    const retryBtn = document.getElementById('doctorsRetryBtn');
    const loadingEl = document.getElementById('doctorsLoading');
    const emptyEl = document.getElementById('doctorsEmpty');
    const tbody = document.getElementById('doctorsTableBody');
    const countEl = document.getElementById('doctorsCount');
    const toastEl = document.getElementById('doctorsToast');

    const searchInput = document.getElementById('doctorSearch');
    const filterClinic = document.getElementById('filterClinic');
    const filterDepartment = document.getElementById('filterDepartment');
    const filterStatus = document.getElementById('filterStatus');

    const backdrop = document.getElementById('doctorModalBackdrop');
    const form = document.getElementById('doctorForm');
    const modalTitle = document.getElementById('doctorModalTitle');
    const formAlert = document.getElementById('doctorFormAlert');
    const saveBtn = document.getElementById('doctorSaveBtn');
    const modalClinicSelect = document.getElementById('doctorClinic');
    const modalDepartmentSelect = document.getElementById('doctorDepartment');

    const tempPwBackdrop = document.getElementById('tempPasswordBackdrop');
    const tempPwText = document.getElementById('tempPasswordText');
    document.getElementById('tempPasswordCloseBtn').addEventListener('click', () => {
      tempPwBackdrop.hidden = true;
    });

    document.getElementById('addDoctorBtn').addEventListener('click', () => openModal(null));
    document.getElementById('doctorCancelBtn').addEventListener('click', closeModal);
    retryBtn.addEventListener('click', loadDoctors);

    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(loadDoctors, 350);
    });
    filterClinic.addEventListener('change', () => {
      populateDepartmentFilterOptions(filterClinic.value, filterDepartment, true);
      loadDoctors();
    });
    filterDepartment.addEventListener('change', loadDoctors);
    filterStatus.addEventListener('change', loadDoctors);

    modalClinicSelect.addEventListener('change', () => {
      populateDepartmentOptions(modalClinicSelect.value, modalDepartmentSelect);
    });

    form.addEventListener('submit', onSubmit);

    init();

    async function init() {
      const res = await Api.adminListClinics();
      if (res.success) {
        clinics = res.data.clinics;
        populateClinicOptions(filterClinic, true);
        populateClinicOptions(modalClinicSelect, false);
      }
      loadDoctors();
    }

    function populateClinicOptions(select, includeAllOption) {
      const keep = select.value;
      select.innerHTML = (includeAllOption ? '<option value="">All hospitals</option>' : '<option value="">Select a hospital…</option>')
        + clinics.map((c) => `<option value="${c.clinic_id}">${escapeHtml(c.clinic_name)}</option>`).join('');
      select.value = keep;
    }

    function populateDepartmentFilterOptions(clinicId, select) {
      const clinic = clinics.find((c) => String(c.clinic_id) === String(clinicId));
      const depts = clinic ? clinic.departments : [];
      select.innerHTML = '<option value="">All departments</option>'
        + depts.map((d) => `<option value="${d.department_id}">${escapeHtml(d.department_name)}</option>`).join('');
    }

    function populateDepartmentOptions(clinicId, select) {
      const clinic = clinics.find((c) => String(c.clinic_id) === String(clinicId));
      const depts = clinic ? clinic.departments : [];
      select.innerHTML = '<option value="">Select a department…</option>'
        + depts.map((d) => `<option value="${d.department_id}">${escapeHtml(d.department_name)}</option>`).join('');
    }

    async function loadDoctors() {
      errorEl.hidden = true;
      loadingEl.hidden = false;
      emptyEl.hidden = true;
      tbody.innerHTML = '';

      const res = await Api.adminListDoctors({
        search: searchInput.value.trim(),
        clinic_id: filterClinic.value,
        department_id: filterDepartment.value,
        status: filterStatus.value,
      });

      loadingEl.hidden = true;

      if (!res.success) {
        errorTextEl.textContent = res.message || 'Could not load doctors.';
        errorEl.hidden = false;
        return;
      }

      doctors = res.data.doctors;
      countEl.textContent = doctors.length + (doctors.length === 1 ? ' doctor' : ' doctors');
      renderTable();
    }

    function renderTable() {
      if (doctors.length === 0) {
        emptyEl.hidden = false;
        return;
      }
      emptyEl.hidden = true;

      tbody.innerHTML = doctors.map((d) => `
        <tr>
          <td>${escapeHtml(d.full_name || '—')}</td>
          <td>${escapeHtml(d.doctor_code)}</td>
          <td>${escapeHtml(d.clinic_name)}</td>
          <td>${escapeHtml(d.department_name)}</td>
          <td>${escapeHtml(d.specialization || '—')}</td>
          <td>₹${d.consultation_fee.toFixed(0)}</td>
          <td>${simpleBadge(d.is_active ? 'completed' : 'cancelled', d.is_active ? 'Active' : 'Inactive')}</td>
          <td>
            <div class="row-actions">
              <button type="button" class="btn-link" data-edit="${d.doctor_id}">Edit</button>
              <button type="button" class="btn-link ${d.is_active ? 'danger' : 'good'}" data-toggle="${d.doctor_id}">
                ${d.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const doctor = doctors.find((d) => d.doctor_id === Number(btn.dataset.edit));
          if (doctor) openModal(doctor);
        });
      });
      tbody.querySelectorAll('[data-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const doctor = doctors.find((d) => d.doctor_id === Number(btn.dataset.toggle));
          if (doctor) toggleActive(doctor);
        });
      });
    }

    function openModal(doctor) {
      form.reset();
      clearFormErrors(form, formAlert);

      document.getElementById('doctorId').value = doctor ? doctor.doctor_id : '';
      document.getElementById('doctorFullName').value = doctor ? (doctor.full_name || '') : '';
      document.getElementById('doctorEmail').value = doctor ? (doctor.email || '') : '';
      document.getElementById('doctorPhone').value = doctor ? (doctor.phone || '') : '';
      document.getElementById('doctorCode').value = doctor ? doctor.doctor_code : '';
      document.getElementById('doctorSpecialization').value = doctor ? (doctor.specialization || '') : '';
      document.getElementById('doctorFee').value = doctor ? doctor.consultation_fee : '';
      document.getElementById('doctorActive').checked = doctor ? doctor.is_active : true;

      populateClinicOptions(modalClinicSelect, false);
      modalClinicSelect.value = doctor ? doctor.clinic_id : '';
      populateDepartmentOptions(doctor ? doctor.clinic_id : '', modalDepartmentSelect);
      modalDepartmentSelect.value = doctor ? doctor.department_id : '';

      modalTitle.textContent = doctor ? 'Edit Doctor' : 'Add Doctor';
      backdrop.hidden = false;
    }

    function closeModal() {
      backdrop.hidden = true;
    }

    async function onSubmit(e) {
      e.preventDefault();
      clearFormErrors(form, formAlert);

      const fullName = document.getElementById('doctorFullName').value.trim();
      const email = document.getElementById('doctorEmail').value.trim();
      const doctorCode = document.getElementById('doctorCode').value.trim();
      const clinicId = modalClinicSelect.value;
      const departmentId = modalDepartmentSelect.value;
      const fee = document.getElementById('doctorFee').value;

      let hasError = false;
      if (!fullName) { showFieldError('doctorFullName', 'Full name is required.'); hasError = true; }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFieldError('doctorEmail', 'A valid email is required.'); hasError = true; }
      if (!doctorCode) { showFieldError('doctorCode', 'Doctor code is required.'); hasError = true; }
      if (!clinicId) { showFieldError('doctorClinic', 'Select a hospital.'); hasError = true; }
      if (!departmentId) { showFieldError('doctorDepartment', 'Select a department.'); hasError = true; }
      if (fee === '' || isNaN(fee) || Number(fee) < 0) { showFieldError('doctorFee', 'Enter a valid fee.'); hasError = true; }
      if (hasError) return;

      const payload = {
        full_name: fullName,
        email,
        phone: document.getElementById('doctorPhone').value.trim(),
        doctor_code: doctorCode,
        clinic_id: Number(clinicId),
        department_id: Number(departmentId),
        specialization: document.getElementById('doctorSpecialization').value.trim(),
        consultation_fee: Number(fee),
        is_active: document.getElementById('doctorActive').checked,
      };
      const doctorId = document.getElementById('doctorId').value;
      if (doctorId) payload.doctor_id = Number(doctorId);

      saveBtn.disabled = true;
      const res = await Api.adminSaveDoctor(payload);
      saveBtn.disabled = false;

      if (!res.success) {
        if (res.errors) {
          Object.entries(res.errors).forEach(([field, msg]) => {
            const map = {
              full_name: 'doctorFullName', email: 'doctorEmail', phone: 'doctorPhone',
              doctor_code: 'doctorCode', clinic_id: 'doctorClinic', department_id: 'doctorDepartment',
              specialization: 'doctorSpecialization', consultation_fee: 'doctorFee',
            };
            showFieldError(map[field] || field, msg);
          });
        }
        formAlert.textContent = res.message || 'Could not save doctor.';
        formAlert.hidden = false;
        return;
      }

      closeModal();

      if (!doctorId && res.data.temp_password) {
        tempPwText.textContent = res.data.temp_password;
        tempPwBackdrop.hidden = false;
      } else {
        showToast(toastEl, 'Doctor updated.');
      }

      loadDoctors();
    }

    async function toggleActive(doctor) {
      const action = doctor.is_active ? 'deactivate' : 'activate';
      if (!confirm(`Are you sure you want to ${action} Dr. ${doctor.full_name}?`)) return;

      const res = await Api.adminSaveDoctor({
        doctor_id: doctor.doctor_id,
        full_name: doctor.full_name,
        email: doctor.email,
        phone: doctor.phone,
        doctor_code: doctor.doctor_code,
        clinic_id: doctor.clinic_id,
        department_id: doctor.department_id,
        specialization: doctor.specialization,
        consultation_fee: doctor.consultation_fee,
        is_active: !doctor.is_active,
      });

      if (!res.success) {
        alert(res.message || 'Could not update doctor status.');
        return;
      }

      showToast(toastEl, `Doctor ${action}d.`);
      loadDoctors();
    }
  }

  /* ---- Shared helpers ---- */

  function showFieldError(inputId, message) {
    const errorEl = document.getElementById(inputId + 'Error');
    const inputEl = document.getElementById(inputId);
    if (errorEl) errorEl.textContent = message;
    if (inputEl) inputEl.classList.add('input-invalid');
  }

  function clearFormErrors(form, formAlert) {
    form.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
    form.querySelectorAll('.input-invalid').forEach((el) => el.classList.remove('input-invalid'));
    formAlert.hidden = true;
    formAlert.textContent = '';
  }

  function showToast(toastEl, message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastEl._hideTimer);
    toastEl._hideTimer = setTimeout(() => { toastEl.hidden = true; }, 4000);
  }

  function simpleBadge(statusClass, label) {
    return `<span class="badge badge-${statusClass}">${escapeHtml(label)}</span>`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function escapeAttr(str) {
    return String(str).replace(/[^a-zA-Z0-9_-]/g, '');
  }
})();
