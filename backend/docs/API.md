# QueueLess API Reference

All endpoints are under `/backend/api/`. Every response is JSON in one of two shapes:

**Success**
```json
{ "success": true, "data": { ... } }
```

**Error**
```json
{ "success": false, "message": "Something went wrong.", "errors": { "field": "..." } }
```
`errors` only appears on validation failures (HTTP 422).

Sessions are used for auth (cookie-based), so `fetch()` calls must include `credentials: 'include'`.

---

## Auth

### POST /api/auth/register
Request:
```json
{ "role": "patient", "name": "Jane Doe", "email": "jane@example.com", "phone": "9999999999", "password": "secret123" }
```
Response `data`: `{ "user_id": 12, "role": "patient" }`

### POST /api/auth/login
Request:
```json
{ "email": "jane@example.com", "password": "secret123" }
```
Response `data`: `{ "user_id": 12, "role": "patient", "name": "Jane Doe" }`
For a doctor account, `data` also includes `"doctor_id"`. For a patient account, it also includes `"patient_id"`.

### POST /api/auth/logout
No body. Response `data`: `{}`

### GET /api/auth/me
No body. Returns the currently logged-in user, or 401 if not logged in.
Response `data`: `{ "user_id": 12, "role": "patient", "name": "Jane Doe" }`

---

## Clinics & Doctors

### GET /api/clinics/list
Response `data`: `{ "clinics": [ { "id": 1, "name": "City Clinic", "address": "..." } ] }`

### GET /api/doctors/list?clinic_id=1
Response `data`: `{ "doctors": [ { "id": 5, "name": "Dr. Rao", "specialization": "General", "clinic_id": 1 } ] }`

### GET /api/doctors/schedules?doctor_id=5&date=2026-09-25
Response `data`: `{ "available": true, "slots": ["09:00", "09:15", "09:30"] }`

---

## Appointments

### POST /api/appointments/book
Request:
```json
{ "doctor_id": 5, "appointment_date": "2026-09-25", "slot_time": "09:00" }
```
Response `data`: `{ "appointment_id": 88, "token_number": 47, "status": "WAITING" }`

### POST /api/appointments/cancel
Request: `{ "appointment_id": 88 }`  *(or `{ "token_id": 120 }` for walk-ins with no appointment)*
Response `data`: `{ "status": "CANCELLED" }`

### GET /api/appointments/history
Response `data`: `{ "appointments": [ { "id": 88, "doctor_name": "Dr. Rao", "date": "2026-09-25", "status": "completed" } ] }`

---

## Tokens

### POST /api/tokens/walkin  *(reception only)*
Request:
```json
{ "doctor_id": 5, "patient_name": "John Smith", "patient_phone": "8888888888", "priority": "normal" }
```
Response `data`: `{ "token_id": 121, "token_number": 48, "status": "WAITING" }`

### GET /api/tokens/get?token_id=121
Response `data`: `{ "token_id": 121, "token_number": 48, "doctor_id": 5, "status": "WAITING" }`

---

## Queue

### GET /api/queue/status?token_id=121
The main polling endpoint for the patient screen.
Response `data`:
```json
{
  "my_token": 47,
  "current_token": 41,
  "status": "WAITING",
  "patients_ahead": 5,
  "estimated_wait_minutes": 25
}
```

### POST /api/queue/on-my-way
Request: `{ "token_id": 121 }`
Response `data`: `{ "status": "ARRIVING" }`

### POST /api/queue/check-in  *(reception only)*
Request: `{ "token_id": 121 }`
Response `data`: `{ "status": "CHECKED_IN" }`

### POST /api/queue/no-show  *(reception only, or auto via grace period sweep)*
Request: `{ "token_id": 121 }`
Response `data`: `{ "status": "NO_SHOW" }`

### POST /api/queue/late-arrival  *(reception only)*
Request: `{ "token_id": 121 }`
Response `data`: `{ "status": "LATE" }`

### POST /api/queue/requeue  *(reception only)*
Request: `{ "token_id": 121 }`
Response `data`: `{ "status": "WAITING", "queue_position": 6 }`

### POST /api/queue/start-consultation  *(reception/admin, or the doctor themself)*
Moves a token from NEXT/ARRIVING/CHECKED_IN to CONSULTING. Needed for the first patient of the day, since `complete.php` only works on an already-CONSULTING token. A doctor can only start consultations for their own tokens.
Request: `{ "token_id": 118 }`
Response `data`: `{ "status": "consulting" }`

### POST /api/queue/notes  *(doctor only)*
Saves consultation notes while the token is still CONSULTING (before completing). A doctor can only add notes to their own tokens.
Request: `{ "token_id": 118, "notes": "Prescribed rest, follow-up in a week." }`
Response `data`: `{ "saved": true }`

### POST /api/queue/complete  *(reception/admin, or the doctor themself)*
Marks the current consultation done and promotes the next patients. A doctor can only complete their own tokens. `notes` is optional and overwrites any notes saved via `/api/queue/notes` beforehand.
Request: `{ "token_id": 118, "notes": "Optional final notes" }`
Response `data`: `{ "completed_token": 41, "now_consulting": 42, "now_next": 43 }`

### GET /api/queue/reception-view?doctor_id=5&date=2026-09-25  *(reception/admin only)*
Response `data`:
```json
{
  "queue": [
    { "token_id": 118, "token_number": 41, "status": "CONSULTING", "patient_name": "..." },
    { "token_id": 119, "token_number": 42, "status": "NEXT", "patient_name": "..." }
  ]
}
```

---

## Doctor  *(doctor only)*

### GET /api/doctors/dashboard
Always returns the logged-in doctor's own queue for today — there is no doctor_id or date input; it's taken from the session.
Response `data`:
```json
{
  "doctor": { "doctor_id": 5, "doctor_code": "DOC-005", "specialization": "General", "department_name": "General Medicine", "clinic_id": 1 },
  "date": "2026-09-25",
  "today_appointments": 12,
  "current_patient": { "token_id": 118, "token_number": 41, "current_status": "consulting", "token_type": "appointment", "patient_name": "..." },
  "next_patient": { "token_id": 119, "token_number": 42, "current_status": "next", "token_type": "walkin", "patient_name": "..." },
  "waiting_count": 6,
  "queue": [ /* same shape as reception-view's queue array */ ]
}
```
`current_patient` and `next_patient` are `null` when nobody is in that state.

---

## Notifications

### GET /api/notifications/list
Response `data`: `{ "notifications": [ { "id": 1, "title": "You're next", "message": "...", "is_read": false } ] }`

### POST /api/notifications/mark-read
Request: `{ "notification_id": 1 }`
Response `data`: `{}`

---

## Admin  *(admin only)*

### GET /api/admin/data
Response `data`: `{ "total_patients_today": 40, "total_doctors": 5, "avg_wait_minutes": 18 }`

### GET / POST /api/admin/queue-rules
GET returns current rules; POST updates them.
Request (POST):
```json
{ "clinic_id": 1, "doctor_id": 5, "grace_period_minutes": 10, "avg_consultation_minutes": 5, "priority_order": "emergency,appointment,walkin" }
```
Response `data`: same shape, echoed back.

---

## Status codes used throughout
- `200` success
- `401` not logged in
- `403` logged in but wrong role
- `404` resource not found (e.g. invalid token_id)
- `409` invalid state transition (e.g. completing an already-completed token)
- `422` validation error (see `errors` field)
- `500` server error (message is generic; real cause is in backend/logs/app.log)

## Queue statuses
`waiting` → `next` → `arriving`/`checked_in` → `consulting` → `completed`
Side paths: `no_show` → `late` → `requeue` → back into `waiting`/`next`. `cancelled` is terminal from most states.