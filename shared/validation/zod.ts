import z from "zod";

export function coercedNumber(schema: z.ZodNumber = z.number()) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === "" ? value : Number(trimmed);
  }, schema);
}
