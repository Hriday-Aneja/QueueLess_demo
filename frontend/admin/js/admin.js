/* ==========================================================
   QueueLess — Admin Panel JS
   Phase 1 scope: login, session guard, logout.
   Dashboard data / doctors / queue rules / analytics are
   wired up in later phases — do not add that logic here yet.
   ========================================================== */

(function () {
  'use strict';

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
})();
