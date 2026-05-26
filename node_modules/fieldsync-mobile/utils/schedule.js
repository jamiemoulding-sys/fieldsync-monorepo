import { scheduleAPI } from "../services/api";

function devLog(...args) {
  if (__DEV__) {
    console.log(...args);
  }
}

export async function getSchedule(params = {}) {
  return await scheduleAPI.getMine(params);
}

export async function getTodayShift() {
  try {
    const now = new Date();

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const shifts = await getSchedule({
      from: start.toISOString(),
      to: end.toISOString(),
      limit: 1,
    });

    if (!shifts || shifts.length === 0) return null;

    const shift = shifts[0];

    return {
      ...shift,
      locations: shift.locations || shift.location || null,
      location: shift.location || shift.locations || null,
      tasks: shift.tasks || [],
    };
  } catch (err) {
    devLog("GET TODAY SHIFT ERROR:", err.userMessage || err.message);
    return null;
  }
}
