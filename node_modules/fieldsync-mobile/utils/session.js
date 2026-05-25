import API from "../services/api";

export async function getCurrentUser() {
  try {
    const { data } = await API.get("/auth/me");
    return data?.user || null;
  } catch {
    return null;
  }
}
