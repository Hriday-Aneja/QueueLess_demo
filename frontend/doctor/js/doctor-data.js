(function (global) {
    'use strict';

    var SESSION_KEY = 'queueless_doctor_session';

    var DoctorSession = {
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
            } catch (e) { /* me.php remains the source of truth. */ }
        },

        clear: function () {
            try {
                localStorage.removeItem(SESSION_KEY);
            } catch (e) { /* no-op */ }
        }
    };

    global.DoctorSession = DoctorSession;
})(window);