import { supabase } from "./supabase";
import { getCurrentUser } from "./session";

/* =========================
   GET SHIFTS (HISTORY)
========================= */
export async function getShifts(options = {}) {
  const { throwOnError = false } = options;
  const user = await getCurrentUser();

  if (!user) {
    console.log("NO USER");
    if (throwOnError) throw new Error("No active session. Please sign in again.");
    return [];
  }

  const { data, error } = await supabase
    .from("shifts")
    .select(`
      *,
      locations!shifts_location_id_fkey (
        id,
        name
      )
    `)
    .eq("user_id", user.id)
    .eq("company_id", user.company_id)
    .order("clock_in_time", { ascending: false });

  if (error) {
    console.log("GET SHIFTS ERROR:", error);
    if (throwOnError) throw error;
    return [];
  }

  console.log("GET SHIFTS SUCCESS:", data?.length || 0, "shifts loaded");
  return data || [];
}
