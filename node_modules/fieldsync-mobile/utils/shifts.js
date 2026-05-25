import { shiftAPI } from "../services/api";

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
    console.log("GET SHIFTS ERROR:", error.userMessage || error.message);
    if (throwOnError) throw error;
    return [];
  }
}
