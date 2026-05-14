import { z } from "zod";

const isoDateLike = z
  .string()
  .trim()
  .min(1)
  .refine(
    (s) => !Number.isNaN(Date.parse(s)),
    "start_date / end_date must be parseable dates"
  );

/**
 * POST `/api/schedules/holiday-requests` — requires `start_date` & `end_date`.
 * Supabase `holidayAPI.create` adds `user_id` (optional override for admins), `company_id`, `status: pending`.
 */
export const leaveRequestCreateSchema = z
  .object({
    start_date: isoDateLike,
    end_date: isoDateLike,
    user_id: z.union([z.coerce.number(), z.string().min(1)]).optional(),
  })
  .strict()
  .refine(
    (v) => {
      const a = Date.parse(v.start_date);
      const b = Date.parse(v.end_date);
      return b >= a;
    },
    { message: "end_date must be on or after start_date", path: ["end_date"] }
  );

export type LeaveRequestCreateInput = z.infer<typeof leaveRequestCreateSchema>;

/**
 * PUT `/api/schedules/holiday-requests/:id` — updates approval workflow (`status` column).
 */
export const leaveRequestStatusUpdateSchema = z
  .object({
    status: z.enum(["pending", "approved", "rejected"]),
  })
  .strict();

export type LeaveRequestStatusUpdateInput = z.infer<
  typeof leaveRequestStatusUpdateSchema
>;
