import { z } from "zod";

/**
 * POST `/api/shifts/break/start` — requires active `shift_id`.
 * Updates `break_started_at` and optional GPS coordinates in shifts table.
 */
export const breakStartRequestSchema = z
  .object({
    shift_id: z.union([z.coerce.number(), z.string().min(1)]),
    reason: z.string().trim().max(200).optional(),
    location: z
      .object({
        latitude: z.coerce.number().finite().gte(-90).lte(90),
        longitude: z.coerce.number().finite().gte(-180).lte(180),
      })
      .optional(),
  })
  .strict();

export type BreakStartRequestInput = z.infer<typeof breakStartRequestSchema>;

/**
 * POST `/api/shifts/break/end` — requires active `shift_id`.
 * Calculates break duration and updates `total_break_seconds`.
 */
export const breakEndRequestSchema = z
  .object({
    shift_id: z.union([z.coerce.number(), z.string().min(1)]),
    location: z
      .object({
        latitude: z.coerce.number().finite().gte(-90).lte(90),
        longitude: z.coerce.number().finite().gte(-180).lte(180),
      })
      .optional(),
  })
  .strict();

export type BreakEndRequestInput = z.infer<typeof breakEndRequestSchema>;
