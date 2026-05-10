import type { EntityId, IsoDateOnly, IsoTimestamp } from "./common";
import type { LocationRecord } from "./location";

/**
 * `schedules` table — planned assignments (what apps often call “shift” in copy/UI).
 *
 * Duplication today:
 * - Backend `routes/schedules.js` uses `date`, `start_time`, `end_time`, `user_id`, `company_id`
 *   (plus joined `name` from users on list endpoints).
 * - Frontend `scheduleAPI` filters/sorts primarily by `date` and treats rows as opaque payloads.
 * - Mobile `utils/schedule.js` queries by **local-day `start_time` window** instead of `date`,
 *   then nests `locations` + `tasks` — see {@link MobileScheduleDayBundle}.
 *
 * Note: `start_time` / `end_time` may be timestamptz strings or time-only strings depending on migrations.
 */
export interface ScheduleRecord {
  id: EntityId;
  user_id: EntityId;
  company_id: EntityId | null;

  /** Used heavily by Express schedule APIs and web list ordering. */
  date?: IsoDateOnly | null;

  start_time?: IsoTimestamp | string | null;
  end_time?: IsoTimestamp | string | null;

  location_id?: EntityId | null;

  /** Seen in mobile UI (`clock-in`); confirm column exists in your Supabase schema when adopting. */
  job_name?: string | null;

  created_at?: IsoTimestamp | null;
}

/**
 * Shape produced by `Mobile/fieldsync-mobile/utils/schedule.ts#getTodayShift`:
 * spread schedule row + hydrated relations (`locations` key holds **one** {@link LocationRecord}).
 */
export interface MobileScheduleDayBundle extends ScheduleRecord {
  locations?: LocationRecord | null;
  tasks?: ScheduleAttachedTaskRef[];
}

/** Minimal task row attached to a scheduled day in mobile (full task model lives outside this bundle). */
export interface ScheduleAttachedTaskRef {
  id: EntityId;
  title?: string | null;
  shift_id?: EntityId | null;
  [key: string]: unknown;
}
