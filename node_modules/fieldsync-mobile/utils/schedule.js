import { supabase } from "./supabase";
import { getCurrentUser } from "./session";

export async function getTodayShift() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    // 🔥 SAFE DATE RANGE (no timezone bugs)
    const now = new Date();

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    // 🔥 1. GET SHIFTS (NO .single())
    const { data: shifts, error } = await supabase
      .from("schedules")
      .select("*")
      .eq("user_id", user.id)
      .eq("company_id", user.company_id)
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString())
      .order("start_time", { ascending: true });

    if (error) {
      console.log("SCHEDULE ERROR:", error);
      return null;
    }

    if (!shifts || shifts.length === 0) return null;

    // 🔥 pick first shift of the day
    const shift = shifts[0];

    // 🔥 2. GET LOCATION
    const { data: location } = await supabase
      .from("locations")
      .select("*")
      .eq("id", shift.location_id)
      .single();

    // 🔥 3. GET TASKS
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("shift_id", shift.id);

    // 🔥 FINAL CLEAN OBJECT
    return {
      ...shift,
      locations: location || null,
      tasks: tasks || [],
    };

  } catch (err) {
    console.log("GET TODAY SHIFT ERROR:", err);
    return null;
  }
}