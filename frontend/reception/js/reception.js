/* ==========================================================================
   QueueLess — Reception Module Shared UI Layer
   frontend/reception/js/reception.js

  Shared reception UI and API-backed session/action handling.
   Provides:
     - ReceptionUI : formatting / render helpers + the confirm dialog and
                     row-action handling shared by the Patients and Queue pages
     - App shell   : session guard, user name, active nav, logout
    - Login       : index.html form handling

   Page scripts (reception-dashboard.js etc.) load after this file.
   ========================================================================== */

(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. Shared constants
   * ------------------------------------------------------------------ */

  // Statuses that count as "waiting" (same grouping as the admin dashboard).
  var WAITING_STATUSES = ['waiting', 'next', 'arriving', 'checked_in'];

  var STATUS_LABELS = {
    waiting: 'waiting', next: 'next', arriving: 'on the way', checked_in: 'checked in',
    consulting: 'consulting', completed: 'completed', cancelled: 'cancelled',
    no_show: 'no-show', late: 'late', requeue: 'requeued'
  };

  // Presentation-only: statuses for which position / ETA are meaningful.
  var LIVE_STATUSES = ['waiting', 'next', 'arriving', 'checked_in', 'requeue', 'consulting'];

  var ACTION_UI = {
    checkin: { label: 'Check in', cls: 'btn-primary btn-sm' },
    noshow: { label: 'No-show', cls: 'btn-secondary btn-sm' },
    late: { label: 'Late arrival', cls: 'btn-secondary btn-sm' },
    requeue: { label: 'Requeue', cls: 'btn-secondary btn-sm' },
    cancel: { label: 'Cancel', cls: 'btn-danger btn-sm' }
  };

  function normalizeStatus(status) {
    return String(status || 'unknown').toLowerCase();
  }

  /* ------------------------------------------------------------------ *
   * 2. ReceptionUI — shared helpers
   * ------------------------------------------------------------------ */

  var ReceptionUI = {
    WAITING_STATUSES: WAITING_STATUSES,
    LIVE_STATUSES: LIVE_STATUSES,
    STATUS_LABELS: STATUS_LABELS,

    escapeHtml: function (value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    // For use inside class names: keeps letters, digits, _ and -.
    escapeAttr: function (value) {
      return String(value === null || value === undefined ? '' : value).replace(/[^a-zA-Z0-9_-]/g, '');
    },

    todayIso: function () {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    formatFriendlyDate: function (iso) {
      return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    },

    formatShortDate: function (iso) {
      return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
        day: 'numeric', month: 'short', year: 'numeric'
      });
    },

    doctorLabel: function (doc) {
      var code = doc.doctor_code || 'Doctor #' + doc.doctor_id;
      var name = doc.doctor_name || doc.full_name;
      var label = name || code;
      return doc.specialization ? label + ' \u00b7 ' + doc.specialization : label;
    },

    statusBadge: function (status) {
      status = normalizeStatus(status);
      var label = (STATUS_LABELS[status] || status || 'unknown').replace(/_/g, ' ');
      return '<span class="badge badge-' + ReceptionUI.escapeAttr(status) + '">' + ReceptionUI.escapeHtml(label) + '</span>';
    },

    priorityBadge: function (priority) {
      var p = priority || 'normal';
      return '<span class="badge badge-priority-' + ReceptionUI.escapeAttr(p) + '">' + ReceptionUI.escapeHtml(p) + '</span>';
    },

    /**
     * The token that is next in line for a doctor's queue: the one marked
     * "next", or — when the head of the line has already checked in / is on
     * the way — whoever holds queue position 1.
     */
    findNextUp: function (queue) {
      var explicit = queue.filter(function (t) { return t.current_status === 'next'; })[0];
      if (explicit) return explicit;
      var candidates = queue
        .filter(function (t) {
          return WAITING_STATUSES.indexOf(t.current_status) !== -1 && t.queue_position !== null && t.queue_position !== undefined;
        })
        .sort(function (a, b) { return a.queue_position - b.queue_position; });
      return candidates[0] || null;
    },

    toast: function (message, kind) {
      var stack = document.getElementById('toastStack');
      if (!stack) return;
      var el = document.createElement('div');
      el.className = 'toast' + (kind ? ' ' + kind : '');
      el.textContent = message;
      stack.appendChild(el);
      setTimeout(function () { el.remove(); }, 4500);
    },

    /* ---- Row actions (Patients + Queue pages) ------------------------- */

    /**
     * Which buttons to OFFER for a row. Presentation choice only — the mock
     * data layer still rejects illegal transitions and the message is shown.
     * row: { tokenId, status, date }
     */
    actionsFor: function (row) {
      row.status = normalizeStatus(row.status);
      if (row.tokenId === null || row.tokenId === undefined) return [];
      var isToday = row.date === ReceptionUI.todayIso();
      var out = [];
      switch (row.status) {
        case 'waiting':
          if (isToday) out.push('checkin');
          out.push('cancel');
          break;
        case 'next':
        case 'arriving':
          if (isToday) out.push('checkin', 'noshow');
          out.push('cancel');
          break;
        case 'checked_in':
          out.push('cancel');
          break;
        case 'no_show':
          if (isToday) out.push('late');
          break;
        case 'late':
          if (isToday) out.push('requeue');
          out.push('cancel');
          break;
        default:
          break; // consulting, completed, cancelled, requeue: nothing to offer
      }
      return out;
    },

    actionButtonsHtml: function (row) {
      var actions = ReceptionUI.actionsFor(row);
      if (actions.length === 0) return '<span class="cell-sub">\u2014</span>';
      return '<div class="row-actions">' + actions.map(function (a) {
        return '<button type="button" class="' + ACTION_UI[a].cls + '" data-action="' + a + '" data-token-id="' + row.tokenId + '">' + ACTION_UI[a].label + '</button>';
      }).join('') + '</div>';
    },

    /**
     * Runs one row action against the mock data layer, with the same
     * confirmations and messages as before. row: { tokenId, tokenNumber,
     * patientName, status, date }. onDone(result) fires after the toast so
     * the page can re-read the queue.
     */
    handleRowAction: async function (action, row, onDone, button) {
      var who = row.patientName + (row.tokenNumber !== null && row.tokenNumber !== undefined ? ' (token #' + row.tokenNumber + ')' : '');

      if (button) button.disabled = true;

      async function finish(res, successMessage) {
        if (res.success) {
          if (successMessage) {
            ReceptionUI.toast(successMessage, 'success');
          } else if (res.data && res.data.queue_position !== null && res.data.queue_position !== undefined) {
            ReceptionUI.toast(row.patientName + ' re-queued at position ' + res.data.queue_position + '.', 'success');
          } else {
            ReceptionUI.toast('Done.', 'success');
          }
        } else {
          ReceptionUI.toast(friendlyFailure(res, row), 'error');
        }
        if (res && res.status === 401) window.location.href = 'index.html';
        if (onDone) await onDone(res);
      }
      try {
        switch (action) {
          case 'checkin':
            await finish(await Api.checkIn(row.tokenId), row.patientName + ' checked in.');
            return;

          case 'noshow':
            var noShowChoice = await askConfirm({
            title: 'Mark as no-show?',
            message: who + ' will be removed from the active queue. If they turn up later you can handle it as a late arrival.',
            actions: [{ label: 'Mark no-show', value: 'yes', cls: 'btn-danger' }]
            });
            if (noShowChoice === 'yes') await finish(await Api.markNoShow(row.tokenId), row.patientName + ' marked as no-show.');
            return;

          case 'cancel':
            var cancelChoice = await askConfirm({
            title: 'Cancel this appointment?',
            message: who + ' will be cancelled and everyone behind them moves up. This can\u2019t be undone.',
            actions: [{ label: 'Cancel appointment', value: 'yes', cls: 'btn-danger' }],
            dismissLabel: 'Keep appointment'
            });
            if (cancelChoice === 'yes') await finish(await Api.cancelAppointment({ token_id: row.tokenId }), 'Appointment cancelled.');
            return;

          case 'late':
            var lateChoice = await askConfirm({
            title: 'Handle late arrival',
            message: who + ' has arrived after their turn was given up. Requeuing places them at the back of the queue; it never interrupts the consultation in progress.',
            actions: [
              { label: 'Mark late only', value: 'late', cls: 'btn-secondary' },
              { label: 'Mark late & requeue', value: 'requeue', cls: 'btn-primary' }
            ]
            });
            if (!lateChoice) return;
            var late = await Api.markLate(row.tokenId);
            if (!late.success || lateChoice === 'late') {
              await finish(late, lateChoice === 'late' ? row.patientName + ' marked as late.' : null);
              return;
            }
            var rq = await Api.requeue(row.tokenId);
            if (!rq.success) rq.message = 'Marked late, but requeue failed: ' + rq.message;
            await finish(rq, null);
            return;

          case 'requeue':
            await finish(await Api.requeue(row.tokenId), null);
            return;

          default:
            return;
        }
      } catch (error) {
        console.error('Reception action error:', error);
        ReceptionUI.toast('Could not complete that action.', 'error');
      } finally {
        if (button) button.disabled = false;
      }
    },

    isConfirmOpen: function () {
      var overlay = document.getElementById('confirmOverlay');
      return !!overlay && !overlay.hidden;
    }
  };

  function friendlyFailure(res, row) {
    var msg = res.message || 'Something went wrong.';
    if (/invalid queue status transition/i.test(msg)) {
      var label = STATUS_LABELS[row.status] || row.status;
      return 'That action isn\u2019t allowed while the token is \u201c' + label + '\u201d.';
    }
    return msg;
  }

  /* ------------------------------------------------------------------ *
   * 3. Confirm dialog (#confirmOverlay on the Patients + Queue pages)
   * ------------------------------------------------------------------ */

  var confirmResolve = null;

  function askConfirm(opts) {
    return new Promise(function (resolve) {
      var overlay = document.getElementById('confirmOverlay');
      var titleEl = document.getElementById('confirmTitle');
      var textEl = document.getElementById('confirmText');
      var actionsEl = document.getElementById('confirmActions');
      if (!overlay || !titleEl || !textEl || !actionsEl) {
        resolve(null);
        return;
      }

      confirmResolve = resolve;
      titleEl.textContent = opts.title;
      textEl.textContent = opts.message;
      actionsEl.innerHTML = '';

      var dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'btn-secondary';
      dismiss.textContent = opts.dismissLabel || 'Not now';
      dismiss.addEventListener('click', function () { closeConfirm(null); });
      actionsEl.appendChild(dismiss);

      opts.actions.forEach(function (a) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = a.cls;
        btn.textContent = a.label;
        btn.addEventListener('click', function () { closeConfirm(a.value); });
        actionsEl.appendChild(btn);
      });

      overlay.hidden = false;
      actionsEl.lastElementChild.focus();
    });
  }

  function closeConfirm(value) {
    var overlay = document.getElementById('confirmOverlay');
    if (overlay) overlay.hidden = true;
    if (confirmResolve) {
      var resolve = confirmResolve;
      confirmResolve = null;
      resolve(value);
    }
  }

  function wireConfirmDialog() {
    var overlay = document.getElementById('confirmOverlay');
    if (!overlay) return;
    var closeBtn = document.getElementById('confirmClose');
    if (closeBtn) closeBtn.addEventListener('click', function () { closeConfirm(null); });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeConfirm(null);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden) closeConfirm(null);
    });
  }

  /* ------------------------------------------------------------------ *
   * 4. App shell — user name, active nav, logout
   * ------------------------------------------------------------------ */

  function renderShell(session) {
    var user = session || {};

    var userNameEl = document.getElementById('receptionUserName');
    if (userNameEl) {
      userNameEl.textContent = user.name || 'Reception User';
    }

    var page = window.location.pathname.split('/').pop().replace('.html', '') || 'dashboard';
    document.querySelectorAll('.reception-nav-link').forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('data-nav') === page);
    });

    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        logoutBtn.disabled = true;
        Api.logout().then(function () { window.location.href = 'index.html'; });
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * 5. Login form (index.html)
   * ------------------------------------------------------------------ */

  function wireLoginForm() {
    var form = document.getElementById('loginForm');
    if (!form) return;

    var emailInput = document.getElementById('email');
    var passwordInput = document.getElementById('password');
    var errorEl = document.getElementById('loginError');
    var submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (errorEl) errorEl.style.display = 'none';

      var email = emailInput.value.trim();
      var password = passwordInput.value;

      if (submitBtn) submitBtn.disabled = true;

      Api.login({ email: email, password: password }).then(function (result) {
        if (!result.success) {
          if (errorEl) {
            var fieldErrors = result.errors ? ' ' + Object.values(result.errors).join(' ') : '';
            errorEl.textContent = (result.message || 'Invalid credentials') + fieldErrors;
            errorEl.style.display = 'block';
          }
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
        if (!result.data || result.data.role !== 'reception') {
          Api.logout();
          if (errorEl) {
            errorEl.textContent = 'This portal is for reception accounts only.';
            errorEl.style.display = 'block';
          }
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
        window.location.href = 'dashboard.html';
      }).catch(function (error) {
        console.error('Reception login error:', error);
        if (errorEl) {
          errorEl.textContent = 'Could not sign in. Please try again.';
          errorEl.style.display = 'block';
        }
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 6. Bootstrap
   * ------------------------------------------------------------------ */

  document.addEventListener('DOMContentLoaded', function () {
    window.addEventListener('queueless:unauthorized', function () {
      if (document.body.getAttribute('data-requires-auth')) window.location.href = 'index.html';
    });
      try {
      var protectedPage = document.body.getAttribute('data-requires-auth');

      if (protectedPage) {
        Api.me().then(function (result) {
          if (!result.success || !result.data || result.data.role !== 'reception') {
            window.location.href = 'index.html';
            return;
          }
          renderShell(result.data);
          wireConfirmDialog();
          document.body.hidden = false;
          document.dispatchEvent(new Event('reception:ready'));
        }).catch(function () { window.location.href = 'index.html'; });
        return;
      }

      wireLoginForm();
    } catch (error) {
      console.error('Reception Init Error:', error);
      // Even if something fails, don't leave the page hidden.
      document.body.hidden = false;
    }
  });

  global.ReceptionUI = ReceptionUI;

})(window);
