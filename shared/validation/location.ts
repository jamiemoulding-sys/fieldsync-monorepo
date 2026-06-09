import z from "zod";
import { coercedNumber } from "./zod";

/**
 * POST `/api/locations` (`routes/locations.js`) — `name`, `latitude`, `longitude` required; `address` defaults ""; `radius` defaults 100.
 */
export const locationCreationSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),

    address: z.string().optional(),

    latitude: coercedNumber(
      z.number({ invalid_type_error: "latitude must be a number" }).finite().gte(-90).lte(90)
    ),

    longitude: coercedNumber(
      z.number({ invalid_type_error: "longitude must be a number" }).finite().gte(-180).lte(180)
    ),

    radius: coercedNumber(z.number().finite().positive()).optional(),
  })
  .strict();

export type LocationCreationInput = z.infer<typeof locationCreationSchema>;
