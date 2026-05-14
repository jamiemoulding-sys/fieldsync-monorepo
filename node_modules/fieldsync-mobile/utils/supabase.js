import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://nnoboofdgjfcnpngtaqq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ub2Jvb2ZkZ2pmY25wbmd0YXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzk4NDYsImV4cCI6MjA4OTYxNTg0Nn0.8T5pnMELupF8N-2lru9b-1OzoiCGGpcp8p27Twmc2gQ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);