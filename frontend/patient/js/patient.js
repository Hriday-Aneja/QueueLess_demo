/* ==========================================================================
   QueueLess — frontend/patient/js/patient.js
   Patient module application logic: auth, hash-based SPA router, and
   per-view rendering.

   Auth (login/register/session guard/logout) is wired to the real
   backend/api endpoints — see initAuthPage() and initDashboardPage().
   Every other view (clinics, doctors, booking, live queue, appointments,
   history, notifications) still renders from MockDB below; those are the
   next integration phase and are NOT yet connected to the real backend.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Config
     ------------------------------------------------------------------ */

  var API_BASE = "../../backend/api"; // informational only — Api.* in api-client.js owns the real base URL
  var MOCK_MODE = false; // Auth is real now. Booking/queue/appointments views below still read MockDB.
  var SESSION_KEY = "ql_patient_session";

  var api = new window.QueueLess.ApiClient({ baseUrl: API_BASE, mockMode: MOCK_MODE });

  /* ------------------------------------------------------------------
     Small DOM helpers
     ------------------------------------------------------------------ */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c) node.appendChild(c);
    });
    return node;
  }
  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function initials(name) {
    if (!name) return "??";
    var parts = String(name).trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }

  /* ------------------------------------------------------------------
     Session
     ------------------------------------------------------------------ */

  var Session = {
    get: function () {
      try {
        var raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    set: function (session) {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch (e) {
        /* storage unavailable (private browsing, quota) — session stays in-memory only */
      }
    },
    clear: function () {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch (e) {}
    },
  };

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */

  function toast(message, type) {
    var region = $("#toast-region");
    if (!region) return;
    var node = el("div", { class: "toast" + (type ? " toast-" + type : ""), role: "status" }, []);
    node.textContent = message;
    region.appendChild(node);
    setTimeout(function () {
      node.style.opacity = "0";
      node.style.transition = "opacity .2s ease";
      setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 220);
    }, 3200);
  }

  /* ------------------------------------------------------------------
     Mock data
     ------------------------------------------------------------------ */

  var MockDB = (function () {
    var clinics = [
      { id: "cl-1", name: "Sunrise Family Clinic", area: "Sector 14, Gurugram", departments: ["General Medicine", "Pediatrics"] },
      { id: "cl-2", name: "Cedar Health Centre", area: "MG Road, Gurugram", departments: ["Cardiology", "General Medicine", "Dermatology"] },
      { id: "cl-3", name: "Riverside Multispeciality", area: "Sohna Road, Gurugram", departments: ["Orthopedics", "ENT", "General Medicine"] },
      { id: "cl-4", name: "Northgate Diagnostics", area: "DLF Phase 2, Gurugram", departments: ["Pathology", "Radiology"] },
    ];

    var doctors = [
      { id: "dr-1", clinicId: "cl-1", name: "Dr. Anita Sharma", specialty: "General Physician", department: "General Medicine", experience: "12 yrs", fee: 500 },
      { id: "dr-2", clinicId: "cl-1", name: "Dr. Rohit Verma", specialty: "Pediatrician", department: "Pediatrics", experience: "8 yrs", fee: 600 },
      { id: "dr-3", clinicId: "cl-2", name: "Dr. Meera Nair", specialty: "Cardiologist", department: "Cardiology", experience: "15 yrs", fee: 900 },
      { id: "dr-4", clinicId: "cl-2", name: "Dr. Karan Malhotra", specialty: "Dermatologist", department: "Dermatology", experience: "6 yrs", fee: 700 },
      { id: "dr-5", clinicId: "cl-3", name: "Dr. Sana Iqbal", specialty: "Orthopedic Surgeon", department: "Orthopedics", experience: "10 yrs", fee: 800 },
      { id: "dr-6", clinicId: "cl-3", name: "Dr. Vivek Rao", specialty: "ENT Specialist", department: "ENT", experience: "9 yrs", fee: 650 },
    ];

    var appointments = [
      {
        id: "ap-1001",
        doctorId: "dr-1",
        clinicId: "cl-1",
        date: addDays(1),
        time: "10:30 AM",
        status: "upcoming",
        reason: "Routine checkup",
      },
      {
        id: "ap-1000",
        doctorId: "dr-3",
        clinicId: "cl-2",
        date: subDays(6),
        time: "4:00 PM",
        status: "completed",
        reason: "Chest pain follow-up",
      },
      {
        id: "ap-0998",
        doctorId: "dr-4",
        clinicId: "cl-2",
        date: subDays(20),
        time: "11:15 AM",
        status: "cancelled",
        reason: "Skin rash",
      },
    ];

    var notifications = [
      { id: "nt-1", title: "Appointment reminder", body: "Your visit with Dr. Anita Sharma is tomorrow at 10:30 AM.", time: "2 hours ago", read: false },
      { id: "nt-2", title: "Queue update", body: "You're now 3rd in line at Sunrise Family Clinic.", time: "5 hours ago", read: false },
      { id: "nt-3", title: "Appointment completed", body: "Your visit with Dr. Meera Nair has been marked complete.", time: "6 days ago", read: true },
      { id: "nt-4", title: "Appointment cancelled", body: "Your appointment with Dr. Karan Malhotra was cancelled.", time: "20 days ago", read: true },
    ];

    var currentToken = {
      tokenNo: "A-014",
      clinicId: "cl-1",
      department: "General Medicine",
      position: 3,
      totalAhead: 3,
      totalInQueue: 9,
      estWaitMins: 18,
      status: "waiting", // waiting | on-my-way | called | in-consultation
      calledIn: false,
    };

    function addDays(n) {
      var d = new Date();
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    }
    function subDays(n) {
      var d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    }

    function clinicById(id) {
      return clinics.filter(function (c) { return c.id === id; })[0] || null;
    }
    function doctorById(id) {
      return doctors.filter(function (d) { return d.id === id; })[0] || null;
    }
    function doctorsByClinic(clinicId) {
      return doctors.filter(function (d) { return d.clinicId === clinicId; });
    }

    function nextDates(count) {
      var out = [];
      for (var i = 0; i < count; i++) {
        var d = new Date();
        d.setDate(d.getDate() + i);
        out.push({
          iso: d.toISOString().slice(0, 10),
          dow: d.toLocaleDateString(undefined, { weekday: "short" }),
          dom: d.getDate(),
        });
      }
      return out;
    }

    function slotsFor(doctorId, dateIso) {
      // Deterministic mock slots with a few pre-booked (disabled) to exercise that state.
      var base = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM"];
      var seed = (doctorId + dateIso).split("").reduce(function (a, c) { return a + c.charCodeAt(0); }, 0);
      return base.map(function (t, i) {
        return { time: t, available: (seed + i) % 5 !== 0 };
      });
    }

    return {
      clinics: clinics,
      doctors: doctors,
      appointments: appointments,
      notifications: notifications,
      currentToken: currentToken,
      clinicById: clinicById,
      doctorById: doctorById,
      doctorsByClinic: doctorsByClinic,
      nextDates: nextDates,
      slotsFor: slotsFor,
    };
  })();

  /* ------------------------------------------------------------------
     App state
     ------------------------------------------------------------------ */

  var State = {
    booking: { clinicId: null, clinicName: null, doctorId: null, doctorName: null, doctorSpecialization: null, dateIso: null, time: null },
    lastBooking: null, // set after a real POST /appointments/book.php succeeds; read by renderConfirmation
    cancelTargetId: null,
    queuePollTimer: null,
  };

  function formatTime12(hhmm) {
    var parts = String(hhmm).split(":");
    var h = parseInt(parts[0], 10);
    var m = parts[1];
    var ampm = h >= 12 ? "PM" : "AM";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + m + " " + ampm;
  }

  /* ==================================================================
     PAGE: AUTH (index.html)
     ================================================================== */

  function initAuthPage() {
    var session = Session.get();
    if (session) {
      window.location.href = "dashboard.html";
      return;
    }

    var tabLogin = $("#tab-login");
    var tabRegister = $("#tab-register");
    var panelLogin = $("#panel-login");
    var panelRegister = $("#panel-register");
    var alertBox = $("#auth-alert");

    function showPanel(which) {
      var isLogin = which === "login";
      panelLogin.hidden = !isLogin;
      panelRegister.hidden = isLogin;
      tabLogin.setAttribute("aria-selected", String(isLogin));
      tabRegister.setAttribute("aria-selected", String(!isLogin));
      alertBox.style.display = "none";
      alertBox.textContent = "";
    }

    tabLogin.addEventListener("click", function () { showPanel("login"); });
    tabRegister.addEventListener("click", function () { showPanel("register"); });
    $("#goto-register").addEventListener("click", function () { showPanel("register"); });
    $("#goto-login").addEventListener("click", function () { showPanel("login"); });

    function setFieldError(fieldId, hasError) {
      var field = document.getElementById(fieldId);
      if (field) field.classList.toggle("has-error", Boolean(hasError));
    }

    function showAlert(message) {
      alertBox.textContent = message;
      alertBox.style.display = "block";
    }

    function setSubmitting(btn, submitting, label) {
      btn.disabled = submitting;
      btn.querySelector(".btn-label") && (btn.querySelector(".btn-label").textContent = submitting ? "Please wait…" : label);
    }

    $("#login-form").addEventListener("submit", function (evt) {
      evt.preventDefault();
      var email = $("#login-email").value.trim();
      var password = $("#login-password").value;
      var emailOk = email.length > 2;
      var passOk = password.length >= 6;
      setFieldError("login-email-field", !emailOk);
      setFieldError("login-password-field", !passOk);
      alertBox.style.display = "none";
      if (!emailOk || !passOk) return;

      var btn = $("#login-submit");
      setSubmitting(btn, true, "Sign In");

      api.login({ email: email, password: password }).then(function (res) {
        setSubmitting(btn, false, "Sign In");

        if (!res || !res.success) {
          showAlert((res && res.message) || "Something went wrong. Please try again.");
          return;
        }

        if (res.data.role !== "patient") {
          showAlert("This login is for patients. Staff accounts use a different portal.");
          return;
        }

        Session.set({
          user_id: res.data.user_id,
          patient_id: res.data.patient_id,
          name: res.data.name,
          email: email,
        });
        window.location.href = "dashboard.html";
      });
    });

    $("#register-form").addEventListener("submit", function (evt) {
      evt.preventDefault();
      var name = $("#reg-name").value.trim();
      var email = $("#reg-email").value.trim();
      var phone = $("#reg-phone").value.trim();
      var password = $("#reg-password").value;

      var nameOk = name.length > 1;
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      var phoneOk = phone.replace(/\D/g, "").length >= 7;
      var passOk = password.length >= 6;

      setFieldError("reg-name-field", !nameOk);
      setFieldError("reg-email-field", !emailOk);
      setFieldError("reg-phone-field", !phoneOk);
      setFieldError("reg-password-field", !passOk);
      alertBox.style.display = "none";
      if (!nameOk || !emailOk || !phoneOk || !passOk) return;

      var btn = $("#register-submit");
      setSubmitting(btn, true, "Create Account");

      api.register({ full_name: name, email: email, phone: phone, password: password }).then(function (res) {
        setSubmitting(btn, false, "Create Account");

        if (!res || !res.success) {
          // errors is a { field: message } map on 422; message covers 409 duplicate email etc.
          var msg = (res && res.message) || "Something went wrong. Please try again.";
          if (res && res.errors) {
            var firstField = Object.keys(res.errors)[0];
            if (firstField) msg = res.errors[firstField];
          }
          showAlert(msg);
          return;
        }

        Session.set({
          user_id: res.data.user_id,
          patient_id: res.data.patient_id,
          name: name,
          email: email,
        });
        window.location.href = "dashboard.html";
      });
    });
  }

  /* ==================================================================
     PAGE: DASHBOARD (dashboard.html) — SPA shell
     ================================================================== */

  function initDashboardPage() {
    var cached = Session.get();
    if (!cached) {
      window.location.href = "index.html";
      return;
    }

    api.me().then(function (res) {
      if (!res || !res.success || res.data.role !== "patient") {
        Session.clear();
        window.location.href = "index.html";
        return;
      }

      var session = {
        user_id: res.data.user_id,
        patient_id: res.data.patient_id,
        name: res.data.name,
        email: res.data.email,
        phone: cached.phone,
      };
      Session.set(session);

      setupUserChrome(session);
      setupNav();
      setupDrawer();
      setupModal();
      setupProfileForm(session);
      setupWalkinFlow();
      setupCancelFlow();
      setupNotifActions();

      window.addEventListener("hashchange", route);
      route();
    });
  }

  function currentViewFromHash() {
    var hash = (window.location.hash || "#dashboard").replace("#", "");
    var known = [
      "dashboard", "clinics", "doctors", "booking", "confirmation",
      "walkin", "token", "livequeue", "appointments", "history",
      "notifications", "profile",
    ];
    return known.indexOf(hash) > -1 ? hash : "dashboard";
  }

  function navigateTo(view) {
    window.location.hash = "#" + view;
  }

  function route() {
    var view = currentViewFromHash();
    $all(".view").forEach(function (section) {
      section.classList.toggle("is-active", section.id === "view-" + view);
    });

    $all("[data-view]").forEach(function (link) {
      if (link.getAttribute("data-view") === view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    var titles = {
      dashboard: "Dashboard", clinics: "Clinics", doctors: "Doctors",
      booking: "Book Appointment", confirmation: "Confirmed",
      walkin: "Walk-in Check-In", token: "My Token", livequeue: "Live Queue",
      appointments: "Appointments", history: "History",
      notifications: "Notifications", profile: "Profile",
    };
    $("#topbar-title").textContent = titles[view] || "QueueLess";
    $("#desktop-title").textContent = titles[view] || "QueueLess";
    document.title = "QueueLess — " + (titles[view] || "Dashboard");

    closeDrawer();
    stopQueuePolling();

    var main = $("#main-content");
    if (main) main.scrollTop = 0;
    window.scrollTo(0, 0);

    // Per-view data loads.
    if (view === "dashboard") renderDashboardHome();
    if (view === "clinics") renderClinics();
    if (view === "doctors") renderDoctors();
    if (view === "booking") renderBooking();
    if (view === "confirmation") renderConfirmation();
    if (view === "walkin") renderWalkinForm();
    if (view === "token") renderToken();
    if (view === "livequeue") { renderLiveQueue(); startQueuePolling(); }
    if (view === "appointments") renderAppointments();
    if (view === "history") renderHistory();
    if (view === "notifications") renderNotifications();

    updateNavBadges();
  }

  function setupNav() {
    document.body.addEventListener("click", function (evt) {
      var navBtn = evt.target.closest("[data-nav]");
      if (navBtn) {
        evt.preventDefault();
        navigateTo(navBtn.getAttribute("data-nav"));
      }
    });
  }

  function setupUserChrome(session) {
    $("#sidebar-username").textContent = session.name || "Patient";
    $("#sidebar-avatar").textContent = initials(session.name);
    $("#profile-avatar").textContent = initials(session.name);

    function doLogout() {
      api.logout().then(function () {
        Session.clear();
        window.location.href = "index.html";
      });
    }
    $("#sidebar-logout").addEventListener("click", doLogout);
    $("#drawer-logout").addEventListener("click", doLogout);
    $("#profile-logout-btn").addEventListener("click", doLogout);
  }

  function setupDrawer() {
    var backdrop = $("#drawer-backdrop");
    var drawer = $("#mobile-drawer");
    var openBtn = $("#drawer-open-btn");
    var closeBtn = $("#drawer-close-btn");

    function open() {
      backdrop.classList.add("is-open");
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
      openBtn.setAttribute("aria-expanded", "true");
    }
    openBtn.addEventListener("click", open);
    closeBtn.addEventListener("click", closeDrawer);
    backdrop.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", function (evt) {
      if (evt.key === "Escape") closeDrawer();
    });
  }

  function closeDrawer() {
    var backdrop = $("#drawer-backdrop");
    var drawer = $("#mobile-drawer");
    var openBtn = $("#drawer-open-btn");
    if (!backdrop || !drawer) return;
    backdrop.classList.remove("is-open");
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    if (openBtn) openBtn.setAttribute("aria-expanded", "false");
  }

  function updateNavBadges() {
    var upcomingCount = MockDB.appointments.filter(function (a) { return a.status === "upcoming"; }).length;
    var unreadCount = MockDB.notifications.filter(function (n) { return !n.read; }).length;

    var apBadge = $("#nav-badge-appointments");
    if (apBadge) {
      apBadge.hidden = upcomingCount === 0;
      apBadge.textContent = String(upcomingCount);
    }
    var ntBadge = $("#nav-badge-notifications");
    if (ntBadge) {
      ntBadge.hidden = unreadCount === 0;
      ntBadge.textContent = String(unreadCount);
    }
    ["#topbar-notif-dot", "#desktop-notif-dot"].forEach(function (sel) {
      var dot = $(sel);
      if (dot) dot.hidden = unreadCount === 0;
    });
    $("#topbar-notif-btn") && $("#topbar-notif-btn").addEventListener("click", function () { navigateTo("notifications"); }, { once: true });
    $("#desktop-notif-btn") && $("#desktop-notif-btn").addEventListener("click", function () { navigateTo("notifications"); }, { once: true });
  }

  /* ---------------- Dashboard home ---------------- */

  function renderDashboardHome() {
    var slot = $("#dashboard-status-slot");
    slot.innerHTML = "";
    if (MockDB.currentToken) {
      var t = MockDB.currentToken;
      var clinic = MockDB.clinicById(t.clinicId);
      var card = el("div", { class: "status-card" }, [
        el("div", {}, [
          el("div", { class: "status-label", text: "Active token · " + (clinic ? clinic.name : "") }),
          el("div", { class: "status-token", text: t.tokenNo }),
          el("div", { class: "status-meta", text: t.position + " ahead of you · ~" + t.estWaitMins + " min wait" }),
        ]),
        el("button", { class: "btn btn-accent btn-sm", type: "button", "data-nav": "livequeue", text: "Track" }),
      ]);
      slot.appendChild(card);
    }

    var upcoming = MockDB.appointments.filter(function (a) { return a.status === "upcoming"; });
    renderList($("#dashboard-upcoming-list"), upcoming, {
      empty: { icon: iconCalendar(), title: "No upcoming appointments", body: "Book a visit to see it here.", actionLabel: "Book Appointment", actionNav: "clinics" },
      render: function (a) { return appointmentRow(a, { clickable: true }); },
    });

    var recentNotifs = MockDB.notifications.slice(0, 3);
    renderList($("#dashboard-notif-list"), recentNotifs, {
      empty: { icon: iconBell(), title: "No notifications yet", body: "We'll let you know when something changes." },
      render: function (n) { return notificationRow(n); },
    });
  }

  /* ---------------- Clinics ---------------- */

  function renderClinics() {
    var container = $("#clinics-list");
    var chipsWrap = $("#clinic-filter-chips");
    var searchInput = $("#clinic-search");

    if (chipsWrap) chipsWrap.innerHTML = ""; // no per-clinic department data from /clinics/list.php to build chips from

    var allClinics = [];

    function paintList() {
      var q = searchInput.value.trim().toLowerCase();
      var filtered = allClinics.filter(function (c) {
        return !q || c.clinic_name.toLowerCase().indexOf(q) > -1 || (c.address || "").toLowerCase().indexOf(q) > -1;
      });
      container.setAttribute("aria-busy", "false");
      renderList(container, filtered, {
        empty: { icon: iconSearch(), title: "No clinics found", body: "Try a different search." },
        render: function (c) { return clinicRow(c); },
      });
    }

    searchInput.oninput = paintList;
    container.setAttribute("aria-busy", "true");
    renderSkeleton(container, 4);

    api.listClinics().then(function (res) {
      if (!res || !res.success) {
        container.setAttribute("aria-busy", "false");
        renderList(container, [], { empty: { icon: iconSearch(), title: "Couldn't load clinics", body: (res && res.message) || "Please try again." } });
        return;
      }
      allClinics = res.data.clinics || [];
      paintList();
    });
  }

  function clinicRow(clinic) {
    var btn = el("button", { class: "row-card", type: "button" }, [
      el("span", { class: "row-media", text: initials(clinic.clinic_name) }),
      el("span", { class: "row-body" }, [
        el("span", { class: "row-title", text: clinic.clinic_name }),
        el("span", { class: "row-sub", text: clinic.address || "" }),
      ]),
      chevronIcon(),
    ]);
    btn.addEventListener("click", function () {
      State.booking.clinicId = clinic.clinic_id;
      State.booking.clinicName = clinic.clinic_name;
      navigateTo("doctors");
    });
    return btn;
  }

  /* ---------------- Doctors ---------------- */

  function renderDoctors() {
    if (!State.booking.clinicId) {
      navigateTo("clinics");
      return;
    }
    $("#doctors-clinic-name").textContent = State.booking.clinicName || "";

    var container = $("#doctors-list");
    container.setAttribute("aria-busy", "true");
    renderSkeleton(container, 3);

    api.listDoctors(State.booking.clinicId).then(function (res) {
      container.setAttribute("aria-busy", "false");
      if (!res || !res.success) {
        renderList(container, [], { empty: { icon: iconUser(), title: "Couldn't load doctors", body: (res && res.message) || "Please try again." } });
        return;
      }
      renderList(container, res.data.doctors || [], {
        empty: { icon: iconUser(), title: "No doctors listed", body: "This clinic has no doctors available right now." },
        render: function (d) { return doctorRow(d); },
      });
    });
  }

  function doctorRow(doctor) {
    var displayName = doctor.doctor_name || doctor.doctor_code;
    var btn = el("button", { class: "row-card", type: "button" }, [
      el("span", { class: "row-media", text: initials(displayName) }),
      el("span", { class: "row-body" }, [
        el("span", { class: "row-title", text: displayName }),
        el("span", { class: "row-sub", text: (doctor.specialization || doctor.department_name || "") + " · " + doctor.department_name }),
      ]),
      el("span", { class: "row-trailing" }, [
        el("span", { class: "badge badge-neutral", text: "₹" + doctor.consultation_fee }),
      ]),
    ]);
    btn.addEventListener("click", function () {
      State.booking.doctorId = doctor.doctor_id;
      State.booking.doctorName = displayName;
      State.booking.doctorSpecialization = doctor.specialization || doctor.department_name;
      State.booking.dateIso = null;
      State.booking.time = null;
      navigateTo("booking");
    });
    return btn;
  }

  /* ---------------- Booking ---------------- */

  function renderBooking() {
    if (!State.booking.doctorId) {
      navigateTo("clinics");
      return;
    }

    $("#booking-doctor-name").textContent = State.booking.doctorName || "";
    $("#booking-doctor-meta").textContent = (State.booking.doctorSpecialization || "") + " · " + (State.booking.clinicName || "");

    var dateScroll = $("#booking-date-scroll");
    dateScroll.innerHTML = "";
    var dates = MockDB.nextDates(10); // pure date math, not mock business data — kept as-is
    if (!State.booking.dateIso) State.booking.dateIso = dates[0].iso;

    dates.forEach(function (d) {
      var pressed = d.iso === State.booking.dateIso;
      var pill = el("button", {
        class: "date-pill", type: "button", "aria-pressed": String(pressed),
      }, [
        el("span", { class: "dow", text: d.dow }),
        el("span", { class: "dom", text: String(d.dom) }),
      ]);
      pill.addEventListener("click", function () {
        State.booking.dateIso = d.iso;
        State.booking.time = null;
        renderBooking();
      });
      dateScroll.appendChild(pill);
    });

    var timeGrid = $("#booking-time-grid");
    timeGrid.setAttribute("aria-busy", "true");
    timeGrid.innerHTML = "";
    for (var i = 0; i < 8; i++) timeGrid.appendChild(el("div", { class: "skeleton skeleton-line" }));
    $("#booking-confirm-btn").disabled = true;

    api.doctorSchedule(State.booking.doctorId, State.booking.dateIso).then(function (res) {
      timeGrid.setAttribute("aria-busy", "false");
      timeGrid.innerHTML = "";

      if (!res || !res.success || !res.data.slots || res.data.slots.length === 0) {
        timeGrid.appendChild(el("p", { class: "text-muted", text: "No slots available for this date." }));
        return;
      }

      res.data.slots.forEach(function (rawTime) {
        var label = formatTime12(rawTime);
        var pressed = rawTime === State.booking.time;
        var btn = el("button", {
          class: "time-slot", type: "button", "aria-pressed": String(pressed), text: label,
        });
        btn.addEventListener("click", function () {
          State.booking.time = rawTime;
          $all(".time-slot", timeGrid).forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
          $("#booking-confirm-btn").disabled = false;
        });
        timeGrid.appendChild(btn);
      });
    });

    var confirmBtn = $("#booking-confirm-btn");
    confirmBtn.onclick = function () {
      if (!State.booking.time) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Booking…";
      var reason = $("#booking-reason").value.trim();

      api.bookAppointment({
        doctor_id: State.booking.doctorId,
        appointment_date: State.booking.dateIso,
        slot_time: State.booking.time,
        reason: reason || undefined,
      }).then(function (res) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm Booking";

        if (!res || !res.success) {
          toast((res && res.message) || "Couldn't book that slot. Please try another.", "danger");
          return;
        }

        State.lastBooking = {
          appointment_id: res.data.appointment_id,
          token_id: res.data.token_id,
          token_number: res.data.token_number,
          doctorName: State.booking.doctorName,
          clinicName: State.booking.clinicName,
          dateIso: State.booking.dateIso,
          time: State.booking.time,
          reason: reason || "General consultation",
        };
        try { localStorage.setItem("ql_patient_active_token_id", String(res.data.token_id)); } catch (e) {}

        $("#booking-reason").value = "";
        toast("Appointment booked", "success");
        navigateTo("confirmation");
      });
    };
  }

  /* ---------------- Confirmation ---------------- */

  function renderConfirmation() {
    var b = State.lastBooking;
    var box = $("#confirmation-summary");
    var refEl = $("#confirmation-ref");

    if (!b) {
      refEl.textContent = "—";
      box.innerHTML = "";
      box.appendChild(el("p", { class: "text-muted text-center", text: "No recent booking to show. Book an appointment to see its confirmation here." }));
      return;
    }

    refEl.textContent = "Token #" + b.token_number;

    box.innerHTML = "";
    [
      ["Doctor", b.doctorName || "—"],
      ["Clinic", b.clinicName || "—"],
      ["Date", formatDate(b.dateIso)],
      ["Time", formatTime12(b.time)],
      ["Reason", b.reason],
    ].forEach(function (pair) {
      box.appendChild(el("div", { class: "summary-row" }, [
        el("span", { class: "s-label", text: pair[0] }),
        el("span", { class: "s-value", text: pair[1] }),
      ]));
    });
  }

  /* ---------------- Walk-in ---------------- */

  function renderWalkinForm() {
    var clinicSelect = $("#walkin-clinic");
    var deptSelect = $("#walkin-department");

    clinicSelect.innerHTML = "";
    clinicSelect.appendChild(el("option", { value: "", text: "Select a clinic" }));
    MockDB.clinics.forEach(function (c) {
      clinicSelect.appendChild(el("option", { value: c.id, text: c.name }));
    });

    function paintDepartments() {
      var clinic = MockDB.clinicById(clinicSelect.value);
      deptSelect.innerHTML = "";
      deptSelect.appendChild(el("option", { value: "", text: clinic ? "Select a department" : "Choose a clinic first" }));
      (clinic ? clinic.departments : []).forEach(function (d) {
        deptSelect.appendChild(el("option", { value: d, text: d }));
      });
      deptSelect.disabled = !clinic;
    }
    clinicSelect.onchange = function () {
      $("#walkin-clinic-field") && $("#walkin-clinic-field").classList.remove("has-error");
      paintDepartments();
    };
    paintDepartments();
  }

  function setupWalkinFlow() {
    $("#walkin-submit-btn").addEventListener("click", function () {
      var clinicField = $("#walkin-clinic").closest(".field") || $("#walkin-clinic").parentElement;
      var deptField = $("#walkin-department").closest(".field") || $("#walkin-department").parentElement;
      var clinicVal = $("#walkin-clinic").value;
      var deptVal = $("#walkin-department").value;

      clinicField.classList.toggle("has-error", !clinicVal);
      deptField.classList.toggle("has-error", !deptVal);
      if (!clinicVal || !deptVal) return;

      var btn = $("#walkin-submit-btn");
      btn.disabled = true;
      btn.textContent = "Generating token…";
      setTimeout(function () {
        var clinic = MockDB.clinicById(clinicVal);
        var newTokenNo = "W-" + String(10 + Math.floor(Math.random() * 89));
        MockDB.currentToken = {
          tokenNo: newTokenNo,
          clinicId: clinic.id,
          department: deptVal,
          position: 4,
          totalAhead: 4,
          totalInQueue: 11,
          estWaitMins: 26,
          status: "waiting",
          calledIn: false,
        };
        btn.disabled = false;
        btn.textContent = "Get My Token";
        toast("Token " + newTokenNo + " generated", "success");
        navigateTo("token");
      }, 500);
    });
  }

  /* ---------------- Token ---------------- */

  function renderToken() {
    var container = $("#token-content");
    container.setAttribute("aria-busy", "true");
    container.innerHTML = "";
    container.appendChild(el("div", { class: "skeleton skeleton-card" }));

    setTimeout(function () {
      container.setAttribute("aria-busy", "false");
      container.innerHTML = "";
      var t = MockDB.currentToken;
      if (!t) {
        container.appendChild(emptyState({
          icon: iconTicket(), title: "No active token",
          body: "Check in for a walk-in or book an appointment to get a token.",
          actionLabel: "Walk-in Check-In", actionNav: "walkin",
        }));
        return;
      }
      var clinic = MockDB.clinicById(t.clinicId);
      var card = el("div", { class: "card card-raised text-center" }, [
        el("div", { class: "text-muted", text: clinic ? clinic.name + " · " + t.department : t.department }),
        el("div", { class: "token-hero-circle" }, [
          el("span", { class: "th-label", text: "Your token" }),
          el("span", { class: "th-value", text: t.tokenNo }),
        ]),
        el("span", { class: "badge " + statusBadgeClass(t.status), text: statusLabel(t.status) }),
        el("div", { class: "queue-stats" }, [
          statBlock(String(t.totalAhead), "Ahead of you"),
          statBlock(String(t.totalInQueue), "In queue"),
          statBlock("~" + t.estWaitMins + " min", "Est. wait"),
        ]),
        el("button", { class: "btn btn-primary btn-block", type: "button", style: "margin-top:18px;", text: "View Live Queue", "data-nav": "livequeue" }),
      ]);
      container.appendChild(card);
    }, 300);
  }

  function statBlock(value, label) {
    return el("div", { class: "queue-stat" }, [
      el("div", { class: "qs-value", text: value }),
      el("div", { class: "qs-label", text: label }),
    ]);
  }

  function statusBadgeClass(status) {
    return { waiting: "badge-neutral", "on-my-way": "badge-accent", called: "badge-warning", "in-consultation": "badge-success" }[status] || "badge-neutral";
  }
  function statusLabel(status) {
    return { waiting: "Waiting", "on-my-way": "On my way", called: "You're called", "in-consultation": "In consultation" }[status] || "Waiting";
  }

  /* ---------------- Live queue ---------------- */

  function renderLiveQueue() {
    var container = $("#livequeue-content");
    container.setAttribute("aria-busy", "true");
    container.innerHTML = "";
    container.appendChild(el("div", { class: "skeleton skeleton-card" }));

    setTimeout(function () {
      container.setAttribute("aria-busy", "false");
      paintLiveQueue();
    }, 300);
  }

  function paintLiveQueue() {
    var container = $("#livequeue-content");
    var t = MockDB.currentToken;
    container.innerHTML = "";

    if (!t) {
      container.appendChild(emptyState({
        icon: iconClock(), title: "You're not in a queue right now",
        body: "Check in for a walk-in or arrive for a booked appointment to join the live queue.",
        actionLabel: "Walk-in Check-In", actionNav: "walkin",
      }));
      return;
    }

    var pct = Math.max(6, 100 - (t.position / Math.max(t.totalInQueue, 1)) * 100);

    var hero = el("div", { class: "queue-hero" }, [
      el("div", { class: "qh-position", text: "#" + t.position }),
      el("div", { class: "qh-position-label", text: "your position in line" }),
      el("div", { class: "queue-progress" }, [
        el("div", { class: "queue-progress-fill", style: "width:" + pct + "%;" }),
      ]),
      el("div", { class: "queue-stats" }, [
        statBlock(t.tokenNo, "Your token"),
        statBlock("~" + t.estWaitMins + " min", "Est. wait"),
        statBlock(statusLabel(t.status), "Status"),
      ]),
    ]);
    container.appendChild(hero);

    var onMyWayBtn = el("button", {
      class: "btn btn-accent btn-block", type: "button", style: "margin-top:16px;",
      text: t.status === "on-my-way" ? "We've notified the clinic ✓" : "I'm On My Way",
    });
    if (t.status === "on-my-way" || t.status === "called" || t.status === "in-consultation") {
      onMyWayBtn.disabled = true;
    } else {
      onMyWayBtn.addEventListener("click", function () {
        onMyWayBtn.disabled = true;
        onMyWayBtn.textContent = "Notifying clinic…";
        setTimeout(function () {
          t.status = "on-my-way";
          toast("Clinic notified that you're on your way", "success");
          paintLiveQueue();
        }, 450);
      });
    }
    container.appendChild(onMyWayBtn);

    var list = el("div", { class: "queue-list" });
    var start = Math.max(1, t.position - 2);
    for (var pos = start; pos <= Math.min(t.totalInQueue, start + 5); pos++) {
      var isYou = pos === t.position;
      list.appendChild(el("div", { class: "queue-list-item" + (isYou ? " is-you" : "") }, [
        el("span", { class: "qli-pos", text: String(pos) }),
        el("span", { text: isYou ? "You (" + t.tokenNo + ")" : "Patient " + pos }),
      ]));
    }
    container.appendChild(list);
  }

  function startQueuePolling() {
    stopQueuePolling();
    // Mock a slowly-moving queue so the "live" behaviour is visible without a backend.
    State.queuePollTimer = setInterval(function () {
      var t = MockDB.currentToken;
      if (!t || currentViewFromHash() !== "livequeue") return;
      if (t.position > 1 && Math.random() < 0.35) {
        t.position -= 1;
        t.totalAhead = Math.max(0, t.position - 1);
        t.estWaitMins = Math.max(1, t.estWaitMins - 4);
        paintLiveQueue();
        updateNavBadges();
      }
    }, 6000);
  }
  function stopQueuePolling() {
    if (State.queuePollTimer) {
      clearInterval(State.queuePollTimer);
      State.queuePollTimer = null;
    }
  }

  /* ---------------- Appointments ---------------- */

  function renderAppointments() {
    var container = $("#appointments-list");
    container.setAttribute("aria-busy", "true");
    renderSkeleton(container, 3);
    setTimeout(function () {
      container.setAttribute("aria-busy", "false");
      var upcoming = MockDB.appointments.filter(function (a) { return a.status === "upcoming"; });
      renderList(container, upcoming, {
        empty: { icon: iconCalendar(), title: "No upcoming appointments", body: "Book an appointment with a clinic near you.", actionLabel: "Book Appointment", actionNav: "clinics" },
        render: function (a) { return appointmentRow(a, { cancellable: true }); },
      });
    }, 280);
  }

  function appointmentRow(appt, opts) {
    opts = opts || {};
    var doctor = MockDB.doctorById(appt.doctorId);
    var clinic = MockDB.clinicById(appt.clinicId);
    var row = el("div", { class: "row-card", style: "cursor:default;" }, [
      el("span", { class: "row-media", text: initials(doctor ? doctor.name : "?") }),
      el("span", { class: "row-body" }, [
        el("span", { class: "row-title", text: doctor ? doctor.name : "Doctor" }),
        el("span", { class: "row-sub", text: (clinic ? clinic.name + " · " : "") + formatDate(appt.date) + " · " + appt.time }),
      ]),
    ]);
    var trailing = el("span", { class: "row-trailing" });
    trailing.appendChild(statusBadgeForAppt(appt.status));
    if (opts.cancellable && appt.status === "upcoming") {
      trailing.appendChild(el("button", {
        class: "btn btn-sm btn-danger-outline", type: "button", text: "Cancel",
        onClick: function (evt) {
          evt.stopPropagation();
          openCancelModal(appt.id);
        },
      }));
    }
    row.appendChild(trailing);
    return row;
  }

  function statusBadgeForAppt(status) {
    var map = { upcoming: ["badge-accent", "Upcoming"], completed: ["badge-success", "Completed"], cancelled: ["badge-danger", "Cancelled"] };
    var pair = map[status] || ["badge-neutral", status];
    return el("span", { class: "badge " + pair[0], text: pair[1] });
  }

  /* ---------------- Cancellation ---------------- */

  function setupCancelFlow() {
    $("#cancel-modal-dismiss").addEventListener("click", closeCancelModal);
    $("#cancel-modal-backdrop").addEventListener("click", function (evt) {
      if (evt.target === $("#cancel-modal-backdrop")) closeCancelModal();
    });
    document.addEventListener("keydown", function (evt) {
      if (evt.key === "Escape" && $("#cancel-modal-backdrop").classList.contains("is-open")) closeCancelModal();
    });
    $("#cancel-modal-confirm").addEventListener("click", function () {
      var btn = $("#cancel-modal-confirm");
      btn.disabled = true;
      btn.textContent = "Cancelling…";
      setTimeout(function () {
        var appt = MockDB.appointments.filter(function (a) { return a.id === State.cancelTargetId; })[0];
        if (appt) appt.status = "cancelled";
        btn.disabled = false;
        btn.textContent = "Cancel Appointment";
        closeCancelModal();
        toast("Appointment cancelled", "success");
        renderAppointments();
        updateNavBadges();
      }, 450);
    });
  }

  function openCancelModal(apptId) {
    State.cancelTargetId = apptId;
    $("#cancel-modal-backdrop").classList.add("is-open");
    $("#cancel-modal-confirm").focus();
  }
  function closeCancelModal() {
    $("#cancel-modal-backdrop").classList.remove("is-open");
    State.cancelTargetId = null;
  }
  function setupModal() {
    // Reserved for additional modal wiring; cancel modal handled in setupCancelFlow.
  }

  /* ---------------- History ---------------- */

  function renderHistory() {
    var container = $("#history-list");
    container.setAttribute("aria-busy", "true");
    renderSkeleton(container, 3);
    setTimeout(function () {
      container.setAttribute("aria-busy", "false");
      var past = MockDB.appointments.filter(function (a) { return a.status === "completed" || a.status === "cancelled"; });
      renderList(container, past, {
        empty: { icon: iconHistory(), title: "No visit history yet", body: "Completed and cancelled visits will appear here." },
        render: function (a) { return appointmentRow(a); },
      });
    }, 280);
  }

  /* ---------------- Notifications ---------------- */

  function renderNotifications() {
    var container = $("#notifications-list");
    container.setAttribute("aria-busy", "true");
    renderSkeleton(container, 4);
    setTimeout(function () {
      container.setAttribute("aria-busy", "false");
      renderList(container, MockDB.notifications, {
        empty: { icon: iconBell(), title: "No notifications", body: "You're all caught up." },
        render: function (n) { return notificationRow(n, { detailed: true }); },
      });
    }, 260);
  }

  function notificationRow(n, opts) {
    opts = opts || {};
    var row = el("div", { class: "notif-row" + (!n.read ? " is-unread" : "") }, [
      el("span", { class: "notif-icon" }, [
        bellIcon(),
      ]),
      el("span", { class: "notif-body" }, [
        el("p", { text: n.title, style: "font-weight:700;" }),
        opts.detailed ? el("p", { text: n.body }) : null,
        el("span", { class: "notif-time", text: n.time }),
      ]),
    ]);
    if (!n.read) {
      row.style.cursor = "pointer";
      row.addEventListener("click", function () {
        n.read = true;
        renderNotifications();
        updateNavBadges();
      });
    }
    return row;
  }

  function setupNotifActions() {
    $("#notif-mark-all-btn").addEventListener("click", function () {
      MockDB.notifications.forEach(function (n) { n.read = true; });
      renderNotifications();
      updateNavBadges();
      toast("All notifications marked as read");
    });
  }

  /* ---------------- Profile ---------------- */

  function setupProfileForm(session) {
    function paint() {
      var s = Session.get() || session;
      $("#profile-name").textContent = s.name || "Patient";
      $("#profile-email").textContent = s.email || "";
      $("#profile-field-name").value = s.name || "";
      $("#profile-field-email").value = s.email || "";
      $("#profile-field-phone").value = s.phone || "";
    }
    paint();

    $("#profile-form").addEventListener("submit", function (evt) {
      evt.preventDefault();
      var s = Session.get() || session;
      s.name = $("#profile-field-name").value.trim() || s.name;
      s.phone = $("#profile-field-phone").value.trim() || s.phone;
      Session.set(s);
      $("#sidebar-username").textContent = s.name;
      $("#sidebar-avatar").textContent = initials(s.name);
      $("#profile-avatar").textContent = initials(s.name);
      paint();
      toast("Profile updated", "success");
    });
  }

  /* ------------------------------------------------------------------
     Shared render helpers
     ------------------------------------------------------------------ */

  function renderList(container, items, opts) {
    container.innerHTML = "";
    if (!items || items.length === 0) {
      container.appendChild(emptyState(opts.empty));
      return;
    }
    items.forEach(function (item) {
      container.appendChild(opts.render(item));
    });
  }

  function renderSkeleton(container, count) {
    container.innerHTML = "";
    for (var i = 0; i < count; i++) {
      container.appendChild(el("div", { class: "skeleton skeleton-card", style: "margin-bottom:10px;" }));
    }
  }

  function emptyState(cfg) {
    var block = el("div", { class: "state-block" }, [
      el("span", { class: "state-icon" }),
      el("h3", { text: cfg.title }),
      el("p", { text: cfg.body }),
    ]);
    block.querySelector(".state-icon").appendChild(cfg.icon);
    if (cfg.actionLabel) {
      block.appendChild(el("button", { class: "btn btn-primary btn-sm", type: "button", text: cfg.actionLabel, "data-nav": cfg.actionNav }));
    }
    return block;
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    } catch (e) {
      return iso;
    }
  }

  /* Minimal inline icon set (kept local so this file has no extra asset deps) */
  function svgIcon(pathHtml) {
    var wrap = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    wrap.setAttribute("viewBox", "0 0 24 24");
    wrap.setAttribute("class", "icon");
    wrap.innerHTML = pathHtml;
    return wrap;
  }
  function iconCalendar() { return svgIcon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'); }
  function iconBell() { return svgIcon('<path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>'); }
  function iconSearch() { return svgIcon('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'); }
  function iconUser() { return svgIcon('<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>'); }
  function iconTicket() { return svgIcon('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 10h8M8 14h5"/>'); }
  function iconClock() { return svgIcon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'); }
  function iconHistory() { return svgIcon('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l4 2"/>'); }
  function chevronIcon() {
    var s = svgIcon('<path d="M9 6l6 6-6 6"/>');
    s.classList.add("row-chevron");
    return s;
  }
  function bellIcon() {
    var s = svgIcon('<path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>');
    s.classList.add("icon-sm");
    return s;
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */

  document.addEventListener("DOMContentLoaded", function () {
    var page = document.currentScript ? document.currentScript.getAttribute("data-page") : null;
    if (!page) {
      var scriptTag = document.querySelector('script[src*="patient.js"]');
      page = scriptTag ? scriptTag.getAttribute("data-page") : null;
    }
    try {
      if (page === "auth") initAuthPage();
      else if (page === "dashboard") initDashboardPage();
    } catch (err) {
      // Surface a visible failure instead of a silent blank page / console-only error.
      console.error("QueueLess patient module failed to initialize:", err);
      var region = document.getElementById("toast-region");
      if (region) {
        var node = document.createElement("div");
        node.className = "toast toast-danger";
        node.setAttribute("role", "alert");
        node.textContent = "Something went wrong loading this page. Please refresh.";
        region.appendChild(node);
      }
    }
  });
})();