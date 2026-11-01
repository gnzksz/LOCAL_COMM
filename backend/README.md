# BACKEND

REST API + real-time (Socket.IO) server for LOCAL_COMM. It is shared by the resident mobile app, the admin web dashboard and the staff web app.

**Stack:** Node.js 22.13+ · Express 5 · SQLite (built-in `node:sqlite`, no DB server needed) · JWT auth · Multer (photo uploads) · Socket.IO

## Setup

```bash
cd backend
npm install
cp .env.example .env      # then change JWT_SECRET
npm run seed              # creates departments + admin account (admin@localcomm.test / admin123)
npm run dev               # http://localhost:4000 (auto-restarts on changes)
```

To check the whole flow end-to-end, start the server, then in another terminal run `npm run smoke`.

## Request status flow

```
Pending ──(admin: invalid)──> Rejected                                  [End]
Pending ──(admin: assign)──> Assigned ──(staff)──> In Progress ──(staff)──> Resolved ──(admin)──> Archived
                                                                     └─ resident rates / gives feedback
```

Every status change is saved in `request_history` (used as a timeline in the apps).

## API

All endpoints except register/login need the header `Authorization: Bearer <token>`.

### Auth (all roles)
| Method | Path | Body |
|---|---|---|
| POST | `/api/auth/register` | `{ name, email?, phone?, password }`, used by residents only |
| POST | `/api/auth/login` | `{ identifier, password }` (identifier = email or phone) |
| GET | `/api/auth/me` | |

### Resident (mobile app)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/requests` | `multipart/form-data`: `photo`, `issue_type`, `description`, `latitude`, `longitude`, `address?`. Returns **422** with `details.missing` if the photo or location is missing |
| GET | `/api/requests?status=` | My requests |
| GET | `/api/requests/:id` | Request + status history |
| POST | `/api/requests/:id/feedback` | `{ rating: 1-5, feedback? }`, only when Resolved |

### Admin (web dashboard)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/requests` | Filters: `status, issue_type, category, department_id, staff_id, from, to, q`; `sort=newest\|oldest\|updated\|status\|issue_type`; `limit, offset` |
| GET | `/api/admin/requests/:id` | Details + history |
| PATCH | `/api/admin/requests/:id` | `{ category }` |
| POST | `/api/admin/requests/:id/reject` | `{ reason }`, notifies the resident |
| POST | `/api/admin/requests/:id/assign` | `{ staff_id, category?, note? }`, department comes from the staff account |
| POST | `/api/admin/requests/:id/archive` | Only when Resolved |
| GET | `/api/admin/reports/summary?from=&to=` | Totals, by status / issue type / department, avg rating, avg resolution hours |
| GET/POST | `/api/admin/departments` | |
| GET/POST | `/api/admin/staff` | Create: `{ name, email?, phone?, password, department_id }` |

### Staff / field personnel (web)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/staff/requests?status=` | Requests assigned to me |
| GET | `/api/staff/requests/:id` | Details + history |
| POST | `/api/staff/requests/:id/start` | Assigned → In Progress, `{ note? }`, notifies the resident |
| POST | `/api/staff/requests/:id/resolve` | In Progress → Resolved, `{ note? }`, notifies the resident |

### Notifications (all roles)
`GET /api/notifications?unread=true` · `POST /api/notifications/:id/read` · `POST /api/notifications/read-all`

### Other
`GET /api/meta` (issue types and statuses for dropdowns) · `GET /api/health` · photos are served from `/uploads/<file>`

## Real-time events (Socket.IO)

Connect with `io(API_URL, { auth: { token } })`.

| Event | Who receives it | When |
|---|---|---|
| `notification` | the user | rejected, assigned (staff), In Progress, Resolved |
| `request:new` | admins | a resident submits a report |
| `request:updated` | admins / assigned staff | any status change |
| `request:feedback` | admins | the resident rates a resolved request |
| `request:unassigned` | previous staff | the request was reassigned |
