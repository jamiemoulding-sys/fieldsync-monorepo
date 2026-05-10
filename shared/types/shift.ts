import type { EntityId, IsoTimestamp } from "./common";

/**
 * `shifts` table — attendance / clock-in sessions (live or historical).
 *
 * Duplication today:
 * - Backend `routes/shifts.js` inserts a subset (`user_id`, `location_id`, `latitude`, `longitude`,
 *   `clock_in_time`, `is_late`, `company_id`) via Postgres.
 * - Frontend `shiftAPI` reads/writes many more columns via Supabase (`clock_*_lat/lng`, breaks,
 *   `total_hours`, manager-only fields like `active_job_id`).
 * - Mobile `utils/shiftsStorage.js` inserts mobile-specific flags (`device_type`, `is_open_shift`).
 *
 * Some fields exist only on Supabase or only on offline stubs (`id` prefixed with `offline_`).
 */
export interface ShiftRecord {
  id: EntityId;

  user_id: EntityId;
  company_id: EntityId | null;

  location_id?: EntityId | null;

  clock_in_time?: IsoTimestamp | null;
  clock_out_time?: IsoTimestamp | null;

  /** Latest device coordinates while on shift (also updated by live tracking). */
  latitude?: number | null;
  longitude?: number | null;

  clock_in_lat?: number | null;
  clock_in_lng?: number | null;
  clock_out_lat?: number | null;
  clock_out_lng?: number | null;

  break_started_at?: IsoTimestamp | null;
  total_break_seconds?: number | null;

  /** Computed duration field updated on clock-out in web client. */
  total_hours?: number | null;

  is_late?: boolean | null;

  is_open_shift?: boolean | null;
  device_type?: string | null;

  /** Manager flows (`checkIntoJob` in web `api.js`). */
  active_job_id?: EntityId | null;
  arrived_at?: IsoTimestamp | null;

  /** Clock-in payload extensions from web UI. */
  shift_type?: string | null;
  verified?: boolean | null;

  created_at?: IsoTimestamp | null;
}

/**
 * Supabase select with embedded employee preview (`shiftAPI.getAll`, `getActiveAll`).
 */
export interface ShiftWithEmployeePreview extends ShiftRecord {
  users?:
    | {
        name?: string | null;
        email?: string | null;
        hourly_rate?: number | null;
      }
    | null;
}
