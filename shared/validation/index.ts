/**
 * Shared Zod schemas for requests crossing web, mobile, and API layers.
 *
 * ## Validation snapshot (before adoption)
 *
 * | Area | Backend | Frontend | Mobile |
 * |------|---------|----------|--------|
 * | Clock-in | `routes/shifts.js` implicit (missing body guard → PG errors); expects numeric GPS + `location_id` | `shiftAPI.clockIn` spreads payload into Supabase without schema validation | Geofence checked locally; `startShift` inserts via Supabase without shared validation |
 * | Clock-out | `routes/shifts.js` `/clock-out` ignores body | Supabase `shiftAPI.clockOut` computes hours + optional GPS | Same pattern via storage helpers |
 * | Schedule create | `routes/schedules.js` manual `if (!user_id \|\| !date…)` | `scheduleAPI.create` passes arbitrary `payload` | N/A (mostly reads) |
 * | Leave / holiday | `routes/schedules.js` `/holiday-requests` checks `start_date` & `end_date` | `holidayAPI.create` inserts into `holidays` table | Dashboard reads `holiday_requests` in places — table naming differs per environment |
 * | Location create | `routes/locations.js` checks name + lat/lng non-null | `locationAPI.create` sends form payload | N/A |
 * | Employee profile | `routes/users.js` COALESCE patch list | `Profile.js` trims name/phone/job_title only | `session` reads `users` row |
 *
 * Structured validation (`express-validator`) appears only in legacy `routes/work.js`, not the main attendance routes.
 *
 * ---
 *
 * ## Adoption points (later)
 *
 * - **Backend**: Wrap `req.body` with `safeParse` inside `routes/shifts.js`, `routes/schedules.js`,
 *   `routes/locations.js`, `routes/users.js`; return `400` + Zod `flatten()` on failure.
 * - **Frontend**: Validate forms/modals (`HolidayRequests.js`, `Locations.js`, `Profile.js`, schedule modals)
 *   before calling `api.js` helpers; optionally share error messages with toast/UI.
 * - **Mobile**: Validate payloads before Supabase `.insert()` / `.update()` in `utils/shiftsStorage.js`,
 *   holiday flows, and any future REST client calls.
 */

export {
  clockInRequestSchema,
  clockOutRequestSchema,
  type ClockInRequestInput,
  type ClockOutRequestInput,
} from "./attendance";

export {
  scheduleCreationSchema,
  type ScheduleCreationInput,
} from "./schedule";

export {
  leaveRequestCreateSchema,
  leaveRequestStatusUpdateSchema,
  type LeaveRequestCreateInput,
  type LeaveRequestStatusUpdateInput,
} from "./leave";

export {
  locationCreationSchema,
  type LocationCreationInput,
} from "./location";

export {
  employeeProfileUpdateSchema,
  type EmployeeProfileUpdateInput,
} from "./employee";
