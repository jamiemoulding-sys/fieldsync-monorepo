import { shiftAPI } from "../services/api";

function devLog(...args) {
  if (__DEV__) {
    console.log(...args);
  }
}

export async function getShifts(options = {}) {
  const {
    before,
    from,
    limit = 50,
    throwOnError = false,
  } = options;

  try {
    return await shiftAPI.getHistory({
      before,
      from,
      limit,
    });
  } catch (error) {
    devLog("GET SHIFTS ERROR:", error.userMessage || error.message);
    if (throwOnError) throw error;
    return [];
  }
}
