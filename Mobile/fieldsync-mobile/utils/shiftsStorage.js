import { supabase } from "./supabase";
import { getCurrentUser } from "./session";
import { getTodayShift } from "./schedule";

function devLog(...args) {
  if (__DEV__) {
    console.log(...args);
  }
}

/* =========================
   ▶️ START SHIFT
========================= */
export async function startShift(locationId, isOpenShift = false) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      devLog("NO USER");
      return null;
    }

    let isLate = false;

    // 🔥 ONLY check lateness for scheduled shifts
    if (!isOpenShift) {
      const scheduled = await getTodayShift();

      if (scheduled?.start_time) {
        const now = new Date();
        const start = new Date(scheduled.start_time);

        const diffMinutes = (now - start) / 60000;

        if (diffMinutes > 5) {
          isLate = true;
        }
      }
    }

    const { data, error } = await supabase
      .from("shifts")
      .insert([
        {
          user_id: user.id,
          company_id: user.company_id,
          location_id: locationId || null,
          clock_in_time: new Date().toISOString(),
          clock_out_time: null,
          is_late: isLate,
          is_open_shift: isOpenShift,
          device_type: "mobile",
        },
      ])
      .select()
      .single();

    if (error) {
      devLog("START SHIFT ERROR:", error);
      return null;
    }

    return data;
  } catch (err) {
    devLog("START SHIFT CRASH:", err);
    return null;
  }
}

/* =========================
   ⏹ END SHIFT
========================= */
export async function endShift(shiftId) {
  try {
    if (!shiftId) return null;

    const { data, error } = await supabase
      .from("shifts")
      .update({
        clock_out_time: new Date().toISOString(),
      })
      .eq("id", shiftId)
      .select()
      .single();

    if (error) {
      devLog("END SHIFT ERROR:", error);
      return null;
    }

    return data;
  } catch (err) {
    devLog("END SHIFT CRASH:", err);
    return null;
  }
}

/* =========================
   📊 GET ACTIVE SHIFT
========================= */
export async function getActiveShift() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .eq("user_id", user.id)
      .is("clock_out_time", null)
      .order("clock_in_time", { ascending: false })
      .limit(1);

    if (error) {
      devLog("ACTIVE SHIFT ERROR:", error);
      return null;
    }

    return data?.[0] || null;
  } catch (err) {
    devLog("ACTIVE SHIFT CRASH:", err);
    return null;
  }
}
