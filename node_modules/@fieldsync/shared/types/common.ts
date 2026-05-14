/**
 * Cross-cutting primitives for FieldSync domain rows (Supabase / Postgres).
 */

/** Primary keys vary by environment (UUID strings vs legacy numeric ids). */
export type EntityId = string | number;

/** ISO-8601 timestamps as returned by Postgres `TIMESTAMPTZ` / JS `toISOString()`. */
export type IsoTimestamp = string;

/** Calendar date string (`YYYY-MM-DD`) used by backend schedule routes and some queries. */
export type IsoDateOnly = string;
