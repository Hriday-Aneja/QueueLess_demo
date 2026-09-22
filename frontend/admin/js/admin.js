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

      // Dashboard-specific init, only on pages that have the dashboard markup.
      if (document.getElementById('kpiGrid')) {
        initDashboard();
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

  /* ---- Shared helpers ---- */

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function escapeAttr(str) {
    return String(str).replace(/[^a-zA-Z0-9_-]/g, '');
  }
})();
