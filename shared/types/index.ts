/**
 * Shared FieldSync domain types (database/API shapes, snake_case).
 *
 * ## Duplication snapshot (before refactor)
 *
 * | Concern | Backend (`Backend/FieldSync-Backend`) | Frontend (`Frontend/fieldsync-frontend`) | Mobile (`Mobile/fieldsync-mobile`) |
 * |--------|----------------------------------------|------------------------------------------|-------------------------------------|
 * | **Attendance rows** | `routes/shifts.js` inserts/queries PG snake_case subset | `src/services/shiftAPI` + Supabase (`shifts`) with breaks, GPS, manager fields | `utils/shiftsStorage.js`, `utils/shifts.js` insert/select `shifts` |
 * | **Planned rows** | `routes/schedules.js` (`date`, `start_time`, `end_time`, …) | `scheduleAPI` in `src/services/api.js` | `utils/schedule.js` filters by `start_time` day window; bundles `locations` + `tasks` |
 * | **Sites** | `routes/locations.js` CRUD | `locationAPI` + `Locations.js`, `WorkSession.js` (`radius` vs `radius_meters`) | Joined from schedules in `getTodayShift`; watcher uses mixed lat/lng shapes |
 * | **Employees** | `routes/users.js` HR updates | `useAuth` merges auth + `users` row (+ camelCase helpers not modeled here) | `utils/session.js` selects `users` |
 *
 * Express handlers and Supabase clients ultimately mirror **Postgres** columns; `database/init.js` is **not**
 * authoritative for the live Supabase schema (IDs are often UUID strings).
 *
 * ---
 *
 * ## Where to consume later (no wiring yet)
 *
 * - **Backend**: After enabling TypeScript or using JSDoc typedef imports, map `pg` `rows[n]` to
 *   {@link ShiftRecord}, {@link ScheduleRecord}, {@link LocationRecord}, {@link EmployeeProfile}
 *   in route handlers under `routes/shifts.js`, `routes/schedules.js`, `routes/locations.js`, `routes/users.js`.
 *
 * - **Frontend**: Annotate Supabase responses in `src/services/api.js` (`shiftAPI`, `scheduleAPI`,
 *   `locationAPI`) and page-level state (`WorkSession.js`, `Locations.js`, schedule pages) with these types;
 *   prefer `ShiftWithEmployeePreview` where `.select(\`*, users(...)\`)` is used.
 *
 * - **Mobile**: Type return values of `utils/schedule.ts` as {@link MobileScheduleDayBundle}; session user as
 *   {@link EmployeeProfile}; shift rows from Supabase as {@link ShiftRecord}.
 */

export type { SharedPackageVersion } from "./package-meta";

export type {
  EntityId,
  IsoDateOnly,
  IsoTimestamp,
} from "./common";

export type {
  LocationRecord,
} from "./location";

export type {
  MobileScheduleDayBundle,
  ScheduleAttachedTaskRef,
  ScheduleRecord,
} from "./schedule";

export type {
  ShiftRecord,
  ShiftWithEmployeePreview,
} from "./shift";

export type {
  EmployeeProfile,
} from "./employee";
