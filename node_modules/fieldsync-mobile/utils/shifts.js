import { supabase } from "./supabase";
import { getCurrentUser } from "./session";

/* =========================
   GET SHIFTS (HISTORY)
========================= */
export async function getShifts() {
  const user = await getCurrentUser();

  if (!user) {
    console.log("NO USER");
    return [];
  }

  const { data, error } = await supabase
    .from("shifts")
    .select(`
      *,
      locations (
        id,
        name
      )
    `)
    .eq("user_id", user.id)
    .eq("company_id", user.company_id)
    .order("clock_in_time", { ascending: false });

  if (error) {
    console.log("GET SHIFTS ERROR:", error);
    return [];
  }

  return data || [];
}