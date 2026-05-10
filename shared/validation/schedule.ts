import { z } from "zod";

/**
 * POST `/api/schedules` (`routes/schedules.js`) — `user_id`, `date`, `start_time`, `end_time` required (truthy strings).
 * Bulk create skips rows missing `user_id` or `date`; still validates core shape when present.
 *
 * Supabase `scheduleAPI.create` forwards arbitrary `payload` — this schema matches the Express contract + typical web rows.
 */
export const scheduleCreationSchema = z
  .object({
    user_id: z.union([z.coerce.number(), z.string().min(1)]),

    /** Usually `YYYY-MM-DD` from date inputs; backend stores as provided. */
    date: z.string().trim().min(1),

    /** ISO timestamps or time fragments depending on migrations — keep as non-empty string. */
    start_time: z.string().trim().min(1),
    end_time: z.string().trim().min(1),

    /** Often present on Supabase-backed schedules even if older Express insert omits them. */
    company_id: z.union([z.coerce.number(), z.string().min(1)]).optional(),
    location_id: z.union([z.coerce.number(), z.string().min(1)]).optional(),
  })
  .strict();

export type ScheduleCreationInput = z.infer<typeof scheduleCreationSchema>;
