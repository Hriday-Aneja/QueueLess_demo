/* ==========================================================================
   QueueLess — Doctor Module Shared UI Layer
   frontend/doctor/js/doctor.js

   Pure front-end. No fetch(), no backend/api calls, no queue engine logic.
   Provides:
     - DoctorUI   : small formatting/render helpers shared across pages
     - App shell  : header + side nav, rendered into #appShellHeader /
                    #appShellNav on every protected page
    - Login      : index.html form handling through the shared API client
    - Guard      : validates the server session before rendering protected pages

    Depends on doctor-data.js (DoctorSession) — load that first.
   ========================================================================== */

(function (global) {
    'use strict';

    /* ------------------------------------------------------------------ *
     * 1. Nav config — one source of truth for the side nav + active state
     * ------------------------------------------------------------------ */

    var NAV_ITEMS = [
        { page: 'dashboard', href: 'dashboard.html', icon: '&#127968;', label: 'Dashboard' },
        { page: 'appointments', href: 'appointments.html', icon: '&#128197;', label: 'Appointments' },
        { page: 'profile', href: 'profile.html', icon: '&#128100;', label: 'Profile' }
    ];

    // Pages that require a mock session. consultation.html is reached from
    // the dashboard queue and isn't in the side nav, but is still protected.
    var PROTECTED_PAGES = ['dashboard', 'consultation', 'appointments', 'profile'];

    var api = new window.QueueLess.ApiClient();

    var STATUS_LABELS = {
        waiting: 'Waiting',
        next: 'Up Next',
        arriving: 'Arriving',
        checked_in: 'Checked In',
        consulting: 'In Consultation',
        completed: 'Completed',
        no_show: 'No Show',
        late: 'Late',
        requeue: 'Requeued',
        cancelled: 'Cancelled',
        scheduled: 'Scheduled'
    };

    var STATUS_BADGE_CLASS = {
        waiting: 'badge-waiting',
        next: 'badge-in-progress',
        arriving: 'badge-in-progress',
        checked_in: 'badge-in-progress',
        consulting: 'badge-completed',
        completed: 'badge-completed',
        no_show: 'badge-no-show',
        late: 'badge-urgent',
        requeue: 'badge-normal',
        cancelled: 'badge-cancelled',
        scheduled: 'badge-scheduled'
    };

    var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    /* ------------------------------------------------------------------ *
     * 2. DoctorUI — shared formatting / render helpers
     * ------------------------------------------------------------------ */

    var DoctorUI = {

        escapeHtml: function (value) {
            if (value === null || value === undefined) return '';
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        // '2026-09-22' -> 'Tue, 22 Sep 2026'
        formatDate: function (isoDate) {
            if (!isoDate) return '';
            var d = new Date(isoDate + 'T00:00:00');
            if (isNaN(d.getTime())) return isoDate;
            return WEEKDAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
        },

        // '09:00' -> '9:00 AM'
        formatTime: function (time24) {
            if (!time24) return '';
            var parts = time24.split(':');
            var h = parseInt(parts[0], 10);
            var m = parts[1] || '00';
            var suffix = h >= 12 ? 'PM' : 'AM';
            var h12 = h % 12;
            if (h12 === 0) h12 = 12;
            return h12 + ':' + m + ' ' + suffix;
        },

        statusLabel: function (status) {
            return STATUS_LABELS[status] || (status ? status.replace(/_/g, ' ') : 'Unknown');
        },

        statusBadgeHtml: function (status) {
            var cls = STATUS_BADGE_CLASS[status] || 'badge-normal';
            return '<span class="badge ' + cls + '"><span class="badge-dot"></span>' + DoctorUI.statusLabel(status) + '</span>';
        },

        priorityBadgeHtml: function (priority) {
            var cls = priority === 'urgent' ? 'badge-urgent' : 'badge-normal';
            var label = priority === 'urgent' ? 'Urgent' : 'Normal';
            return '<span class="badge ' + cls + '">' + label + '</span>';
        },

        initials: function (fullName) {
            if (!fullName) return '';
            var parts = String(fullName).trim().split(/\s+/);
            var first = parts[0] ? parts[0].charAt(0) : '';
            var last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
            return (first + last).toUpperCase();
        },

        // Reads ?token_id=123 (or any param) from the current URL.
        getQueryParam: function (name) {
            var params = new URLSearchParams(window.location.search);
            return params.get(name);
        },

        showAlert: function (elOrId, message, isSuccess) {
            var el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
            if (!el) return;
            el.textContent = message;
            el.hidden = false;
            el.classList.toggle('is-success', !!isSuccess);
        },

        hideAlert: function (elOrId) {
            var el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
            if (!el) return;
            el.hidden = true;
        }
    };

    /* ------------------------------------------------------------------ *
     * 3. App shell — header + side nav
     * ------------------------------------------------------------------ */

    function renderAppShell(activePage) {
        var headerEl = document.getElementById('appShellHeader');
        var navEl = document.getElementById('appShellNav');
        if (!headerEl && !navEl) return;

        var doctor = global.DoctorSession.get() || {};

        if (headerEl) {
            headerEl.innerHTML = headerHtml(doctor);
        }
        if (navEl) {
            navEl.innerHTML = navHtml(activePage, doctor);
        }

        wireShellEvents(navEl);
    }

    function headerHtml(doctor) {
        var name = doctor.full_name || doctor.name || 'Doctor';
        var specialization = doctor.specialization || 'Doctor';
        return ''
            + '<div class="app-header-left">'
            + '<button type="button" class="menu-toggle-btn" id="menuToggleBtn" aria-label="Toggle navigation">&#9776;</button>'
            + '<div class="app-logo">'
            + '<span class="app-logo-mark" aria-hidden="true">Q+</span>'
            + '<span class="app-logo-text">QueueLess</span>'
            + '</div>'
            + '</div>'
            + '<div class="app-header-right">'
            + '<div class="header-doctor-chip">'
            + '<span class="avatar-circle">' + DoctorUI.escapeHtml(doctor.avatar_initials || DoctorUI.initials(name)) + '</span>'
            + '<span class="doctor-name-wrap">'
            + '<span class="doctor-name">' + DoctorUI.escapeHtml(name) + '</span>'
            + '<span class="doctor-role">' + DoctorUI.escapeHtml(specialization) + '</span>'
            + '</span>'
            + '</div>'
            + '</div>';
    }

    function navHtml(activePage, doctor) {
        var links = NAV_ITEMS.map(function (item) {
            var activeClass = item.page === activePage ? ' is-active' : '';
            return ''
                + '<a class="nav-link' + activeClass + '" href="' + item.href + '">'
                + '<span class="nav-icon" aria-hidden="true">' + item.icon + '</span>'
                + '<span>' + item.label + '</span>'
                + '</a>';
        }).join('');

        return ''
            + links
            + '<div class="nav-divider"></div>'
            + '<button type="button" class="nav-logout-btn" id="navLogoutBtn">'
            + '<span class="nav-icon" aria-hidden="true">&#8630;</span>'
            + '<span>Log out</span>'
            + '</button>';
    }

    function wireShellEvents(navEl) {
        var menuToggleBtn = document.getElementById('menuToggleBtn');
        if (menuToggleBtn && navEl) {
            menuToggleBtn.addEventListener('click', function () {
                navEl.classList.toggle('is-open');
            });
        }

        var logoutBtn = document.getElementById('navLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                api.logout().finally(function () {
                    global.DoctorSession.clear();
                    window.location.href = 'index.html';
                });
            });
        }
    }

    /* ------------------------------------------------------------------ *
     * 4. Login form (index.html)
     * ------------------------------------------------------------------ */

    function wireLoginForm() {
        var form = document.getElementById('doctorLoginForm');
        if (!form) return;

        var emailInput = document.getElementById('doctorEmail');
        var passwordInput = document.getElementById('doctorPassword');
        var emailError = document.getElementById('emailError');
        var passwordError = document.getElementById('passwordError');
        var alertEl = document.getElementById('loginAlert');
        var submitBtn = document.getElementById('loginSubmitBtn');

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            DoctorUI.hideAlert(alertEl);
            emailError.textContent = '';
            passwordError.textContent = '';
            emailInput.parentElement.classList.remove('has-error');
            passwordInput.parentElement.classList.remove('has-error');

            var email = emailInput.value.trim();
            var password = passwordInput.value;
            var hasError = false;

            if (!email) {
                emailError.textContent = 'Email is required.';
                emailInput.parentElement.classList.add('has-error');
                hasError = true;
            }
            if (!password) {
                passwordError.textContent = 'Password is required.';
                passwordInput.parentElement.classList.add('has-error');
                hasError = true;
            }
            if (hasError) return;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in\u2026';

            api.login({ email: email, password: password }).then(function (result) {
                if (!result || !result.success) {
                    DoctorUI.showAlert(alertEl, result && result.message || 'Unable to sign in.', false);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Sign In';
                    return;
                }

                if (!result.data || result.data.role !== 'doctor') {
                    DoctorUI.showAlert(alertEl, 'This login is for doctors. Staff accounts use a different portal.', false);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Sign In';
                    return;
                }

                global.DoctorSession.set(result.data);
                DoctorUI.showAlert(alertEl, 'Signed in \u2014 redirecting\u2026', true);
                window.location.href = 'dashboard.html';
            });
        });
    }

    /* ------------------------------------------------------------------ *
     * 5. Bootstrap
     * ------------------------------------------------------------------ */

    document.addEventListener('DOMContentLoaded', function () {
        var page = document.body.getAttribute('data-page');

        if (PROTECTED_PAGES.indexOf(page) !== -1) {
            global.DoctorAuthReady = api.me().then(function (result) {
                if (!result || !result.success || !result.data || result.data.role !== 'doctor') {
                    global.DoctorSession.clear();
                    window.location.href = 'index.html';
                    return false;
                }

                global.DoctorSession.set(result.data);
                renderAppShell(page);
                document.dispatchEvent(new CustomEvent('doctor-auth-ready'));
                return true;
            }).catch(function () {
                global.DoctorSession.clear();
                window.location.href = 'index.html';
                return false;
            });
        }

        wireLoginForm();
    });

    global.DoctorUI = DoctorUI;
    global.DoctorApi = api;
    global.renderDoctorShell = renderAppShell;

})(window);