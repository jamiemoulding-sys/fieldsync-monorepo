import { z } from "zod";

/**
 * PUT `/api/users/:id` (`routes/users.js`) — all fields optional via SQL `COALESCE` patches.
 * Frontend `Profile.js` currently edits only `name`, `phone`, `job_title` on `users`, plus company name separately.
 *
 * Use `.partial()` semantics via every field optional — reject unknown keys with `.strict()` to catch typos.
 */
export const employeeProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().optional(),
    job_title: z.string().trim().optional(),

    hourly_rate: z.coerce.number().finite().nonnegative().optional(),
    overtime_rate: z.coerce.number().finite().nonnegative().optional(),
    night_rate: z.coerce.number().finite().nonnegative().optional(),

    contracted_hours: z.coerce.number().finite().nonnegative().optional(),
    holiday_allowance: z.coerce.number().finite().nonnegative().optional(),

    department: z.string().trim().optional(),
    role: z.string().trim().optional(),
    /** Backend accepts timestamp/date strings without strict ISO enforcement today. */
    start_date: z.string().trim().min(1).optional(),
  })
  .strict();

export type EmployeeProfileUpdateInput = z.infer<
  typeof employeeProfileUpdateSchema
>;
