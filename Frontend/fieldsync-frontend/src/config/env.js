const PRODUCTION_API_BASE_URL =
  "https://fieldsync-backend-clean.onrender.com/api";

export const API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? PRODUCTION_API_BASE_URL
    : process.env.REACT_APP_API_URL || PRODUCTION_API_BASE_URL;

export const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "";

export const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";
