import { z } from "zod";

/**
 * POST `/api/shifts/clock-in` body (`routes/shifts.js`) — requires `location_id`, `latitude`, `longitude`.
 * Web/mobile Supabase clock-in sends an expanded payload (`shiftAPI.clockIn`); those extras are optional here.
 *
 * Backend does not coerce strings today; `z.coerce.number()` helps JSON clients that quote numbers.
 */
export const clockInRequestSchema = z
  .object({
    location_id: z.union([z.coerce.number(), z.string().min(1)]),

    latitude: z.coerce
      .number({ invalid_type_error: "latitude must be a number" })
      .finite()
      .gte(-90)
      .lte(90),

    longitude: z.coerce
      .number({ invalid_type_error: "longitude must be a number" })
      .finite()
      .gte(-180)
      .lte(180),

    /** Web-only hints stored by Supabase inserts — ignored by Express clock-in route today. */
    shift_type: z.string().optional(),
    verified: z.boolean().optional(),
  })
  .strict();

export type ClockInRequestInput = z.infer<typeof clockInRequestSchema>;

/**
 * POST `/api/shifts/clock-out` (`routes/shifts.js`) currently ignores `req.body`.
 * Web clients update `clock_out_lat` / `clock_out_lng` via Supabase directly — modeled here for a future unified API.
 */
export const clockOutRequestSchema = z
  .object({
    clock_out_lat: z.coerce.number().finite().gte(-90).lte(90).optional(),
    clock_out_lng: z.coerce.number().finite().gte(-180).lte(180).optional(),
  })
  .strict();

export type ClockOutRequestInput = z.infer<typeof clockOutRequestSchema>;
