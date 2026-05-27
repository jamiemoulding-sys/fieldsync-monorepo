import { supabase } from "./supabase";
import { getToken, removeToken, setToken } from "./auth";

export async function getActiveSessionToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token || (await getToken());

  if (session?.access_token) {
    await setToken(session.access_token);
  }

  return token || null;
}

export async function clearLocalSession() {
  await removeToken();
  await supabase.auth.signOut({ scope: "local" });
}

export function isAuthError(error) {
  const status = error?.response?.status;
  const message = String(error?.userMessage || error?.message || "").toLowerCase();
  return status === 401 || message.includes("session") || message.includes("unauthorized");
}
