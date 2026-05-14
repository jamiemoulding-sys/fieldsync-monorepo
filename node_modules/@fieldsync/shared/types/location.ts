import type { EntityId, IsoTimestamp } from "./common";

/**
 * `locations` table — work sites used for geofenced clock-in and mapping.
 *
 * Duplication today:
 * - Backend `routes/locations.js` reads/writes snake_case rows (`latitude`, `longitude`, `radius`).
 * - Frontend `locationAPI` + pages (`Locations.js`, `WorkSession.js`) use the same columns;
 *   UI sometimes aliases radius as `radius_meters`.
 * - Mobile `utils/schedule.js` loads a single row by `location_id`; `utils/geofence` / `locationwatcher`
 *   sometimes expect `lat`/`lng` on unrelated objects — keep this type aligned with DB columns only.
 */
export interface LocationRecord {
  id: EntityId;
  company_id: EntityId | null;

  name: string;
  address?: string | null;

  latitude: number | null;
  longitude: number | null;

  /** Geofence radius in meters (DB default often 100). */
  radius?: number | null;

  /** Present in some UI code paths as an alternate field name for radius. */
  radius_meters?: number | null;

  archived?: boolean | null;

  created_at?: IsoTimestamp | null;
}
