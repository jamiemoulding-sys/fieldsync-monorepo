import type { EntityId, IsoDateOnly, IsoTimestamp } from "./common";

/**
 * `users` workforce profile row (extends auth identity in Supabase).
 *
 * Duplication today:
 * - Backend `routes/users.js` updates HR-style columns (`phone`, `job_title`, rates, etc.).
 * - Frontend `useAuth` merges **Auth user** + `users` row + optional `companies` row into a runtime object
 *   with mixed camelCase (`companyId`) and snake_case (`company_id`) — only the DB-shaped subset belongs here.
 * - Mobile `utils/session.ts#getCurrentUser` selects `*` from `users`.
 *
 * OAuth/subject id (`users.id`) typically mirrors `auth.users.id` (UUID string).
 */
export interface EmployeeProfile {
  id: EntityId;
  email?: string | null;
  company_id?: EntityId | null;

  name?: string | null;
  role?: string | null;

  phone?: string | null;
  job_title?: string | null;

  hourly_rate?: number | null;
  overtime_rate?: number | null;
  night_rate?: number | null;

  contracted_hours?: number | null;
  holiday_allowance?: number | null;

  department?: string | null;
  start_date?: IsoTimestamp | IsoDateOnly | null;

  /** Temporary elevation used by backend middleware — confirm column usage before relying on it client-side. */
  temp_role?: string | null;
  temp_role_expires?: IsoTimestamp | null;

  created_at?: IsoTimestamp | null;

  /** Allow forward-compatible columns without loosening the whole type to `unknown`. */
  [key: string]: unknown;
}
