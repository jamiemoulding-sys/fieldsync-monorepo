import axios from "axios";
import { supabase } from "../utils/supabase";
import { getToken, removeToken, setToken } from "../utils/auth";
import { API_BASE_URL } from "../config/env";

const API = axios.create({
  baseURL: API_BASE_URL,
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

    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Request failed";

    error.userMessage = message;
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
    const response = await API.get("/payslips");
    return response.data;
  },
};

export const payslipAPI = {
  getAll: async () => {
    const response = await API.get("/payslips");
    return response.data;
  },

  getById: async (id) => {
    const response = await API.get(`/payslips/${id}`);
    return response.data;
  },

  getDownload: async (id) => {
    const response = await API.get(`/payslips/${id}/download`);
    return response.data;
  },
};
