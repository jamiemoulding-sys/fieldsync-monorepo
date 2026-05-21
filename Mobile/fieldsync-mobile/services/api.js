import axios from "axios";
import { supabase } from "../utils/supabase";
import { getToken, removeToken, setToken } from "../utils/auth";

const API = axios.create({
  baseURL: "https://fieldsync-backend-clean.onrender.com/api",
  timeout: 10000,
});

API.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token || await getToken();

  if (session?.access_token) {
    await setToken(session.access_token);
  }

  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await removeToken();
      await supabase.auth.signOut({ scope: "local" });
    }

    return Promise.reject(error);
  }
);

export default API;

// Report API for timesheets and payslips
export const reportAPI = {
  getTimesheets: async () => {
    try {
      const response = await API.get("/reports/timesheets");
      return response.data;
    } catch {
      return [];
    }
  },

  getPayslips: async () => {
    try {
      const response = await API.get("/reports/payslips");
      return response.data;
    } catch {
      return [];
    }
  },
};
