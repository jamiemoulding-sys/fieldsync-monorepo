# Direct Client Write Migration List

Backend authority target: client reads may remain temporarily, but writes should move behind authenticated, company-scoped API endpoints with server-side role checks.

## Mobile App

| Direct client write | Current file | Backend API endpoint |
| --- | --- | --- |
| `shift_route_logs.insert` tracking pings | `Mobile/fieldsync-mobile/utils/locationTracking.js` | `POST /api/tracking/pings` - migrated |
| `shifts.insert` clock-in | `Mobile/fieldsync-mobile/utils/shiftsStorage.js` | `POST /api/shifts/clock-in` |
| `shifts.update` clock-out | `Mobile/fieldsync-mobile/utils/shiftsStorage.js` | `POST /api/shifts/clock-out` |
| `shifts.select` active/history reads | `Mobile/fieldsync-mobile/utils/shifts.js`, `Mobile/fieldsync-mobile/utils/shiftsStorage.js` | `GET /api/shifts/history`, `GET /api/shifts/active` |

## Manager Dashboard Frontend

| Direct client write | Current file | Backend API endpoint |
| --- | --- | --- |
| `users.insert` invited/missing user bootstrap | `Frontend/fieldsync-frontend/src/services/api.js`, `Frontend/fieldsync-frontend/src/pages/AcceptInvite.jsx`, `Frontend/fieldsync-frontend/src/pages/Signup.js` | `POST /api/users` or `POST /api/invite/accept` |
| `tasks.insert/update/delete` | `Frontend/fieldsync-frontend/src/services/api.js` | `POST /api/tasks`, `PUT /api/tasks/:id`, `DELETE /api/tasks/:id` |
| `task_completions.insert` | `Frontend/fieldsync-frontend/src/services/api.js` | `POST /api/tasks/complete` |
| `holidays.insert/update/delete` | `Frontend/fieldsync-frontend/src/services/api.js` | `POST /api/schedules/holiday-requests`, `PUT /api/schedules/holiday-requests/:id`, `DELETE /api/schedules/holiday-requests/:id` |
| `schedules.insert/update/delete` | `Frontend/fieldsync-frontend/src/services/api.js` | `POST /api/schedules`, `POST /api/schedules/bulk`, `PUT /api/schedules/:id`, `DELETE /api/schedules/:id` |
| `shifts.insert/update` clock and payroll mutations | `Frontend/fieldsync-frontend/src/services/api.js` | `POST /api/shifts/clock-in`, `POST /api/shifts/clock-out`, future `PATCH /api/shifts/:id/admin-adjustment` |
| `shift_routes.insert` live route points | `Frontend/fieldsync-frontend/src/services/api.js` | Future `POST /api/tracking/route-points` or reuse `POST /api/tracking/pings` with manager-safe semantics |
| `notifications.insert/update/delete` | `Frontend/fieldsync-frontend/src/services/api.js` | Future `/api/notifications` CRUD |
| `announcements.insert/update/delete` | `Frontend/fieldsync-frontend/src/services/api.js` | `POST /api/announcements`, future `PUT /api/announcements/:id`, `DELETE /api/announcements/:id` |
| `locations.insert/update/delete` | `Frontend/fieldsync-frontend/src/services/api.js` | `POST /api/locations`, `PUT /api/locations/:id`, `DELETE /api/locations/:id` |
| `companies.update` billing plan/status | `Frontend/fieldsync-frontend/src/services/api.js`, `Frontend/fieldsync-frontend/src/pages/Profile.js` | `POST /api/billing/create-checkout-session`, `POST /api/billing/portal`, Stripe webhook authority, future `PUT /api/companies/me` |
| `users.update` profile/company profile edits | `Frontend/fieldsync-frontend/src/pages/Profile.js` | `PUT /api/auth/me`, future `PUT /api/companies/me` |

## Remaining Security Work

- Replace frontend Supabase write fallbacks in `shiftAPI.clockOut`, `startBreak`, `endBreak`, `updateLiveLocation`, manager shift adjustment, job check-in, and job leave flows.
- Move task, holiday, schedule, location, announcement, notification, billing, payroll, and profile writes fully behind backend APIs.
- Tighten Supabase grants/RLS so `anon` and `authenticated` cannot write protected business tables directly.
