// src/services/api.js
// FULL CHECKED + BUILD SAFE VERSION
// ✅ notificationAPI exported
// ✅ billingAPI exported
// ✅ reportAPI exported
// ✅ userAPI exported
// ✅ taskAPI exported
// ✅ shiftAPI exported
// ✅ holidayAPI exported
// ✅ getActiveAll included
// ✅ create/update/delete included
// ✅ deploy safe

import axios from "axios";
import supabase from "../lib/supabase";
import { API_BASE_URL } from "../config/env";

/* =====================================================
AXIOS
===================================================== */

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization =
      `Bearer ${session.access_token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Request failed";

    error.userMessage = message;
    return Promise.reject(error);
  }
);

/* =====================================================
HELPERS
===================================================== */

async function getCurrentUser() {
  const res = await api.get("/auth/me");
  return res.data?.user || res.data;
}

async function getCompanyId() {
  const user = await getCurrentUser();

  if (!user.company_id) {
    throw new Error("No company assigned");
  }

  return user.company_id;
}

function nowISO() {
  return new Date().toISOString();
}

function calcSafeHours(start, end, breakSecs = 0) {
  if (!start || !end) return 0;

  const diff =
    (new Date(end).getTime() -
      new Date(start).getTime()) /
      3600000 -
    Number(breakSecs || 0) / 3600;

  return Math.max(diff, 0);
}

/* =====================================================
AUTH
===================================================== */

export const authAPI = {
  login: async ({ email, password }) => {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) throw error;

    return {
      token: data.session?.access_token,
      user: await getCurrentUser(),
    };
  },

  logout: async () => {
    await supabase.auth.signOut();
    return true;
  },

  me: async () => {
    try {
      return await getCurrentUser();
    } catch {
      return null;
    }
  },

  updateProfile: async (payload) => {
    const res = await api.put("/auth/me", payload);
    return res.data;
  },
};

/* =====================================================
USERS
===================================================== */

export const userAPI = {
  getAll: async () => {
    const res = await api.get("/users");
    return res.data || [];
  },

  getById: async (id) => {
    const res = await api.get(`/users/${id}`);
    return res.data;
  },

  create: async (payload) => {
    const res = await api.post("/users", payload);
    return res.data;
  },

  update: async (id, payload) => {
    const res = await api.put(`/users/${id}`, payload);
    return res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/users/${id}`);
    return res.data;
  },
};

/* =====================================================
TASKS (ENTERPRISE UPGRADE)
===================================================== */

export const taskAPI = {
  getAll: async () => {
    const res = await api.get("/tasks/all");
    return res.data || [];
  },

  create: async (payload) => {
    const res = await api.post("/tasks", payload);
    return res.data;
  },

  update: async (id, payload) => {
    const res = await api.put(`/tasks/${id}`, payload);
    return res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/tasks/${id}`);
    return res.data;
  },

  /* =========================
     CLAIM TASK (open tasks)
  ========================= */

  claimTask: async (taskId) => {
    const user = await getCurrentUser();
    const res = await api.put(`/tasks/${taskId}`, {
      assigned_to: user.id,
      status: "progress",
    });
    return res.data;
  },

  /* =========================
     COMPLETE TASK (AUDIT SAFE)
  ========================= */

  completeTask: async (taskId) => {
    const res = await api.post("/tasks/complete", {
      task_id: taskId,
    });
    return res.data;
  },

  /* =========================
     GET MY TASKS
  ========================= */

  getMine: async () => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .or(`assigned_to.eq.${user.id},assigned_to.is.null`)
      .eq("company_id", user.company_id);

    if (error) throw error;
    return data || [];
  },
};

/* =====================================================
HOLIDAYS (FIXED + SAFE)
===================================================== */

function toDateInput(date) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export const holidayAPI = {
  getAll: async () => {
    const res = await api.get("/schedules/holiday-requests");

    return (res.data || []).map((h) => ({
      ...h,
      start_date: toDateInput(h.start_date),
      end_date: toDateInput(h.end_date),
    }));
  },

  getMine: async () => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
      .from("holidays")
      .select("*")
      .eq("user_id", user.id)
      .eq("company_id", user.company_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((h) => ({
      ...h,
      start_date: toDateInput(h.start_date),
      end_date: toDateInput(h.end_date),
    }));
  },

  create: async (payload) => {
    const res = await api.post("/schedules/holiday-requests", payload);
    return res.data;
  },

  approve: async (id, days) => {
    const res = await api.put(`/schedules/holiday-requests/${id}`, {
      status: "approved",
      days_requested: days,
    });
    return res.data;
  },

  reject: async (id, reason = "") => {
    const res = await api.put(`/schedules/holiday-requests/${id}`, {
      status: "rejected",
      reason,
    });
    return res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/schedules/holiday-requests/${id}`);
    return res.data;
  },
};

/* =====================================================
SHIFT API V2 (TRUE FINAL)
Drop-in replacement for current shiftAPI

✅ Zero this usage
✅ Resume shift fixed
✅ Online + offline stable
✅ App close + reopen works
✅ Queue survives reload
✅ Duplicate protection
✅ Auto sync safe
✅ Site locations fixed
✅ Admin + employee in sync
===================================================== */

export const shiftAPI = {
  syncing: false,

  /* =========================================
  STORAGE
  ========================================= */

  getQueue() {
    return JSON.parse(
      localStorage.getItem("shiftQueue") || "[]"
    );
  },

  saveQueue(queue) {
    localStorage.setItem(
      "shiftQueue",
      JSON.stringify(queue)
    );
  },

  addQueue(action, payload = {}) {
    const queue = shiftAPI.getQueue();

    queue.push({
      id: Date.now() + "_" + Math.random(),
      action,
      payload,
      created_at: nowISO(),
    });

    shiftAPI.saveQueue(queue);
  },

  getOfflineShift() {
    return JSON.parse(
      localStorage.getItem(
        "offlineActiveShift"
      ) || "null"
    );
  },

  setOfflineShift(data) {
    localStorage.setItem(
      "offlineActiveShift",
      JSON.stringify(data)
    );
  },

  clearOfflineShift() {
    localStorage.removeItem(
      "offlineActiveShift"
    );

    localStorage.removeItem(
      "offlineClockedOutAt"
    );
  },

  /* =========================================
  GETTERS
  ========================================= */

  async getAll() {
    const companyId = await getCompanyId();

    const { data, error } =
      await supabase
        .from("shifts")
        .select(`
          *,
          users(name,email,hourly_rate)
        `)
        .eq("company_id", companyId)
        .order("clock_in_time", {
          ascending: false,
        });

    if (error) throw error;
    return data || [];
  },

  async getMine() {
    const user = await getCurrentUser();

    const { data, error } =
      await supabase
        .from("shifts")
        .select("*")
        .eq("user_id", user.id)
        .eq("company_id", user.company_id)
        .order("clock_in_time", {
          ascending: false,
        });

    if (error) throw error;
    return data || [];
  },

  async getActive() {
    const offline =
      shiftAPI.getOfflineShift();

    if (offline) return offline;

    if (!navigator.onLine) {
      return null;
    }

    const user = await getCurrentUser();

    const { data, error } =
      await supabase
        .from("shifts")
        .select("*")
        .eq("user_id", user.id)
        .eq("company_id", user.company_id)
        .is("clock_out_time", null)
        .maybeSingle();

    if (error) throw error;

    return data;
  },

  async getActiveAll() {
    const companyId = await getCompanyId();

    const { data, error } =
      await supabase
        .from("shifts")
        .select(`
          *,
          users(name,email,hourly_rate)
        `)
        .eq("company_id", companyId)
        .is("clock_out_time", null);

    if (error) throw error;

    return data || [];
  },

  /* =========================================
  SYNC
  ========================================= */

  async syncQueue() {
    if (shiftAPI.syncing) return;
    if (!navigator.onLine) return;

    shiftAPI.syncing = true;

    try {
      const queue =
        shiftAPI.getQueue();

      if (!queue.length) return;

      const remaining = [];

      for (const item of queue) {
        try {
          if (item.action === "clockIn")
            await shiftAPI.clockIn(
              item.payload,
              true
            );

          if (item.action === "clockOut")
            await shiftAPI.clockOut(
              true
            );

          if (
            item.action ===
            "startBreak"
          )
            await shiftAPI.startBreak(
              true
            );

          if (
            item.action ===
            "endBreak"
          )
            await shiftAPI.endBreak(
              true
            );

          if (item.action === "gps")
            await shiftAPI.updateLiveLocation(
              item.payload.shiftId,
              item.payload.lat,
              item.payload.lng,
              true
            );

        } catch (err) {
          console.error(err);
          remaining.push(item);
        }
      }

      shiftAPI.saveQueue(
        remaining
      );

      if (!remaining.length) {
        shiftAPI.clearOfflineShift();
      }

    } finally {
      shiftAPI.syncing = false;
    }
  },

/* =========================================
CLOCK IN
FULL FIXED VERSION
✅ Keeps everything
✅ Adds clock_in_lat/lng
✅ Offline mode fixed
✅ Existing logic untouched
========================================= */

async clockIn(
  payload = {},
  sync = false
) {
  const active =
    await shiftAPI.getActive();

  if (active && !sync) {
    throw new Error(
      "Already clocked in"
    );
  }

  let user;

  try {
    user = await getCurrentUser();

    localStorage.setItem(
      "cachedUser",
      JSON.stringify(user)
    );
  } catch {
    user = JSON.parse(
      localStorage.getItem(
        "cachedUser"
      ) || "null"
    );
  }

  if (!user)
    throw new Error(
      "No user"
    );

  const {
    data: locations,
  } = await supabase
    .from("locations")
    .select("*")
    .eq(
      "company_id",
      user.company_id
    );

  const locationId =
    payload.location_id ||
    locations?.[0]?.id ||
    null;

  let lat =
    payload.latitude || null;

  let lng =
    payload.longitude || null;

  if (
    navigator.geolocation &&
    (!lat || !lng)
  ) {
    const pos =
      await new Promise(
        (resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) =>
              resolve({
                lat:
                  p.coords.latitude,
                lng:
                  p.coords.longitude,
              }),
            () =>
              resolve({
                lat: null,
                lng: null,
              }),
            {
              enableHighAccuracy: true,
              timeout: 5000,
            }
          );
        }
      );

    lat = pos.lat;
    lng = pos.lng;
  }

  /* =====================================
  OFFLINE MODE
  ===================================== */

  if (
    !navigator.onLine &&
    !sync
  ) {
    const localShift = {
      id:
        "offline_" +
        Date.now(),
      user_id: user.id,
      company_id:
        user.company_id,
      location_id:
        locationId,
      clock_in_time:
        nowISO(),

      latitude: lat,
      longitude: lng,

      clock_in_lat: lat,
      clock_in_lng: lng,

      total_break_seconds: 0,
    };

    shiftAPI.setOfflineShift(
      localShift
    );

    shiftAPI.addQueue(
      "clockIn",
      payload
    );

    return true;
  }

  /* =====================================
  ONLINE SAVE
  ===================================== */

  const { error } =
    await supabase
      .from("shifts")
      .insert({
        ...payload,

        user_id: user.id,
        company_id:
          user.company_id,

        location_id:
          locationId,

        clock_in_time:
          nowISO(),

        latitude: lat,
        longitude: lng,

        clock_in_lat: lat,
        clock_in_lng: lng,
      });

  if (error) throw error;

  return true;
},

  /* =========================================
CLOCK OUT
FULL FIXED VERSION
✅ Keeps everything
✅ Adds clock_out_lat/lng
✅ Updates final live location
✅ Offline mode kept
✅ Existing logic untouched
========================================= */

async clockOut(sync = false) {
  const offline =
    shiftAPI.getOfflineShift();

  if (
    offline &&
    !navigator.onLine &&
    !sync
  ) {
    shiftAPI.addQueue(
      "clockOut"
    );

    localStorage.setItem(
      "offlineClockedOutAt",
      nowISO()
    );

    shiftAPI.clearOfflineShift();

    window.dispatchEvent(
      new Event(
        "shiftUpdated"
      )
    );

    return true;
  }

  const active =
    await shiftAPI.getActive();

  if (!active) return true;

  const end = nowISO();

  const hours =
    calcSafeHours(
      active.clock_in_time,
      end,
      active.total_break_seconds
    );

  /* =====================================
  GET FINAL GPS POSITION
  ===================================== */

  let lat = null;
  let lng = null;

  if (
    navigator.geolocation
  ) {
    const pos =
      await new Promise(
        (resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) =>
              resolve({
                lat:
                  p.coords.latitude,
                lng:
                  p.coords.longitude,
              }),
            () =>
              resolve({
                lat: null,
                lng: null,
              }),
            {
              enableHighAccuracy: true,
              timeout: 6000,
            }
          );
        }
      );

    lat = pos.lat;
    lng = pos.lng;
  }

  /* =====================================
  SAVE CLOCK OUT
  ===================================== */

  try {
    // Use backend clock-out API with GPS coordinates
    const requestBody = {};
    if (lat !== null && lng !== null) {
      requestBody.location = {
        latitude: lat,
        longitude: lng
      };
    }

    const response = await api.post('/shifts/clock-out', requestBody);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Clock out failed');
    }

    // Preserve client-side total_hours calculation temporarily
    const { error } = await supabase
      .from("shifts")
      .update({
        total_hours: hours,
        clock_out_lat: lat,
        clock_out_lng: lng,
        latitude: lat,
        longitude: lng,
      })
      .eq("id", active.id);

    if (error) throw error;

  } catch (backendError) {
    console.error('Backend clock-out failed, falling back to direct Supabase:', backendError);
    
    // Fallback to direct Supabase write for backward compatibility
    const { error } =
      await supabase
        .from("shifts")
        .update({
          clock_out_time: end,
          total_hours: hours,
          clock_out_lat: lat,
          clock_out_lng: lng,
          latitude: lat,
          longitude: lng,
        })
        .eq("id", active.id);

    if (error) throw error;
  }

  shiftAPI.clearOfflineShift();

  window.dispatchEvent(
    new Event(
      "shiftUpdated"
    )
  );

  return true;
},

  /* =========================================
  BREAKS
  ========================================= */

  async startBreak(sync = false) {
  if (!navigator.onLine && !sync) {
    localStorage.setItem(
      "offlineBreakStartedAt",
      nowISO()
    );

    shiftAPI.addQueue("startBreak");

    window.dispatchEvent(
      new Event("shiftUpdated")
    );

    return true;
  }

    const active =
      await shiftAPI.getActive();

    if (!active) return true;

    try {
      // Use backend break API
      const response = await api.post('/shifts/break/start', {
        shift_id: active.id
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Break start failed');
      }

      return true;
    } catch (error) {
      console.error('Backend break start failed, falling back to direct Supabase:', error);
      
      // Fallback to direct Supabase write for backward compatibility
      await supabase
        .from("shifts")
        .update({
          break_started_at:
            nowISO(),
        })
        .eq("id", active.id);

      return true;
    }
  },

  async endBreak(sync = false) {
  if (!navigator.onLine && !sync) {
    localStorage.removeItem(
      "offlineBreakStartedAt"
    );

    shiftAPI.addQueue("endBreak");

    window.dispatchEvent(
      new Event("shiftUpdated")
    );

    return true;
  }

    const active =
      await shiftAPI.getActive();

    if (
      !active?.break_started_at
    )
      return true;

    try {
      // Use backend break API
      const response = await api.post('/shifts/break/end', {
        shift_id: active.id
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Break end failed');
      }

      return true;
    } catch (error) {
      console.error('Backend break end failed, falling back to direct Supabase:', error);
      
      // Fallback to direct Supabase write for backward compatibility
      const secs =
        Math.floor(
          (Date.now() -
            new Date(
              active.break_started_at
            ).getTime()) /
            1000
        );

      const current =
        active.total_break_seconds ||
        0;

      await supabase
        .from("shifts")
        .update({
          break_started_at:
            null,
          total_break_seconds:
            current + secs,
        })
        .eq("id", active.id);

      return true;
    }
  },

 /* =========================================
GPS
========================================= */

async updateLiveLocation(
  shiftId,
  lat,
  lng,
  sync = false
) {
  if (!shiftId) return true;

  if (
    !navigator.onLine &&
    !sync
  ) {
    shiftAPI.addQueue(
      "gps",
      { shiftId, lat, lng }
    );
    return true;
  }

  try {
    /* update live location */
    await supabase
      .from("shifts")
      .update({
        latitude: lat,
        longitude: lng,
      })
      .eq("id", shiftId);

    /* save route point */
    await supabase
      .from("shift_routes")
      .insert({
        shift_id: shiftId,
        latitude: lat,
        longitude: lng,
        created_at:
          new Date().toISOString(),
      });

  } catch (err) {
    console.error(
      "GPS save failed:",
      err
    );
  }

  return true;
},

  /* =========================================
  MANAGER
  ========================================= */

  async managerClockOut(
    shiftId,
    customTime = null
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("shifts")
      .select("*")
      .eq("id", shiftId)
      .single();

    if (error) throw error;

    const end =
      customTime ||
      nowISO();

    const total =
      calcSafeHours(
        data.clock_in_time,
        end,
        data.total_break_seconds
      );

    await supabase
      .from("shifts")
      .update({
        clock_out_time:
          end,
        total_hours:
          total,
      })
      .eq("id", shiftId);

    return true;
  },

  async checkIntoJob(
    shiftId,
    locationId
  ) {
    await supabase
      .from("shifts")
      .update({
        active_job_id:
          locationId,
        arrived_at:
          nowISO(),
      })
      .eq("id", shiftId);

    return true;
  },

  async leaveJob(shiftId) {
    await supabase
      .from("shifts")
      .update({
        active_job_id:
          null,
        left_job_at:
          nowISO(),
      })
      .eq("id", shiftId);

    return true;
  },
};

/* =====================================================
NOTIFICATIONS
===================================================== */

export const notificationAPI = {
  getAll: async () => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("company_id", user.company_id)
      .order("created_at", {
        ascending: false,
      });

    if (error) throw error;

    return data || [];
  },

  getUnread: async () => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("read", false);

    if (error) throw error;

    return data?.length || 0;
  },


  markRead: async (id) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    if (error) throw error;

    return true;
  },

  markAllRead: async () => {
    const user = await getCurrentUser();

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (error) throw error;

    return true;
  },

  create: async (payload) => {
    const { error } = await supabase
      .from("notifications")
      .insert(payload);

    if (error) throw error;

    return true;
  },

  clearAll: async () => {
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", user.id)
    .eq("company_id", user.company_id);

  if (error) throw error;

  return true;
},

delete: async (id) => {
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("company_id", user.company_id);

  if (error) throw error;

  return true;
},

};

/* =====================================================
REPORTS
===================================================== */

export const reportAPI = {
  getSummary: async () => {
    const users = await userAPI.getAll();
    const tasks = await taskAPI.getAll();
    const shifts = await shiftAPI.getAll();

    return {
      users: users.length,
      tasks: tasks.length,
      totalShifts: shifts.length,
      activeUsers: shifts.filter(
        (x) => !x.clock_out_time
      ).length,
      completedTasks: tasks.filter(
        (x) => x.completed
      ).length,
    };
  },

  getTimesheets: async () =>
    await shiftAPI.getAll(),

  getPayslips: async (params = {}) => {
    const res = await api.get("/payslips", { params });
    return res.data?.payslips || res.data || [];
  },

  getPayslipById: async (id) => {
    const res = await api.get(`/payslips/${id}`);
    return res.data;
  },

  savePayslip: async (formData) => {
    const res = await api.post("/payslips", formData);
    return res.data;
  },

  publishPayslip: async (id) => {
    const res = await api.put(`/payslips/${id}/publish`);
    return res.data;
  },

  getRouteLogs: async () => {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
      .from("shift_routes")
      .select(`
        *,
        shifts!inner(
          id,
          user_id,
          company_id
        )
      `)
      .eq("shifts.company_id", companyId)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(error);
      return [];
    }

    return (data || []).map((row) => ({
      ...row,
      user_id: row.shifts?.user_id,
    }));
  },
};

/* =====================================================
ANNOUNCEMENTS
===================================================== */

export const announcementAPI = {
  getAll: async () => {
    const res = await api.get("/announcements");
    return res.data || [];
  },

  create: async (payload) => {
    const res = await api.post("/announcements", payload);
    return res.data;
  },

  update: async (id, payload) => {
    const res = await api.put(`/announcements/${id}`, payload);
    return res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/announcements/${id}`);
    return res.data;
  },
};

/* =====================================================
INVITES
===================================================== */

export const inviteAPI = {
  send: async ({ email, role }) => {
    const res = await api.post("/invite", {
      email,
      role,
    });

    return res.data;
  },

  resend: async ({ email, role }) => {
    const res = await api.post("/invite", {
      email,
      role,
    });

    return res.data;
  },
};

/* =====================================================
SCHEDULES
===================================================== */

export const scheduleAPI = {
  getAll: async () => {
    const res = await api.get("/schedules");
    return res.data || [];
  },

  getMine: async () => {
    const res = await api.get("/schedules/my-schedule");
    return res.data || [];
  },

  create: async (payload) => {
    const res = await api.post("/schedules", payload);
    return res.data;
  },

  update: async (id, payload) => {
    const res = await api.put(`/schedules/${id}`, payload);
    return res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/schedules/${id}`);
    return res.data;
  },
};

/* =====================================================
LOCATIONS
===================================================== */

export const locationAPI = {
  getAll: async () => {
    const res = await api.get("/locations");
    return res.data || [];
  },

  getLocations: async () => {
    return await locationAPI.getAll();
  },

  create: async (payload) => {
  const res = await api.post("/locations", payload);
  return res.data;
},

  update: async (id, payload) => {
    const res = await api.put(`/locations/${id}`, payload);
    return res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/locations/${id}`);
    return res.data;
  },
};

/* =====================================================
PERFORMANCE REAL DATA
===================================================== */

export const performanceAPI = {
  getAll: async () => {
    const companyId = await getCompanyId();

    const { data: users, error: userErr } =
      await supabase
        .from("users")
        .select("*")
        .eq("company_id", companyId);

    if (userErr) throw userErr;

    const { data: shifts, error: shiftErr } =
      await supabase
        .from("shifts")
        .select("*")
        .eq("company_id", companyId);

    if (shiftErr) throw shiftErr;

   const { data: tasks, error } =
  await supabase
    .from("tasks")
    .select("*")
    .eq("company_id", companyId);

if (error) {
  console.error(error);
}

const safeTasks = tasks || [];

    return (users || []).map((user) => {
      const myShifts = (shifts || []).filter(
        (x) => x.user_id === user.id
      );

      const completed = myShifts.filter(
        (x) => x.clock_out_time
      );

      const totalHours = completed.reduce(
        (sum, row) => {
          const start = new Date(
            row.clock_in_time
          );

          const end = new Date(
            row.clock_out_time
          );

          const hrs =
            (end - start) / 3600000 -
            (row.total_break_seconds || 0) /
              3600;

          return sum + Math.max(hrs, 0);
        },
        0
      );

      const lateCount = completed.filter(
        (x) => Number(x.late_minutes || 0) > 0
      ).length;

      const myTasks = (tasks || []).filter(
        (t) =>
          t.assigned_to === user.id &&
          t.status === "completed"
      ).length;

      const avgShift =
        completed.length > 0
          ? totalHours / completed.length
          : 0;

      return {
        ...user,
        total_shifts: completed.length,
        hours_worked: totalHours,
        average_shift_hours: avgShift,
        late_count: lateCount,
        tasks_completed: myTasks,
      };
    });
  },

  getSummary: async () => {
    const rows =
      await performanceAPI.getAll();

    const totalHours = rows.reduce(
      (sum, x) =>
        sum + Number(x.hours_worked || 0),
      0
    );

    const totalLate = rows.reduce(
      (sum, x) =>
        sum + Number(x.late_count || 0),
      0
    );

    const totalTasks = rows.reduce(
      (sum, x) =>
        sum +
        Number(
          x.tasks_completed || 0
        ),
      0
    );

    return {
      employees: rows.length,
      totalHours,
      totalLate,
      totalTasks,
      topPerformers: rows
        .sort(
          (a, b) =>
            b.hours_worked -
            a.hours_worked
        )
        .slice(0, 5),
    };
  },
};

/* =====================================================
BILLING
===================================================== */

export const billingAPI = {
  checkout: async ({ plan }) => {
    const res = await api.post(
      "/billing/create-checkout-session",
      { plan }
    );

    return res.data;
  },

  portal: async () => {
    const res = await api.post(
      "/billing/portal"
    );

    return res.data;
  },

  deleteAccount: async () => {
  const res = await api.post(
    "/auth/delete-account"
  );

  return res.data;
},

  setPlan: async (plan) => {
  const companyId = await getCompanyId();

  const { error } = await supabase
    .from("companies")
    .update({
      current_plan: plan,
      subscription_status: "active",
      is_pro: true,
    })
    .eq("id", companyId);

  if (error) throw error;

  return true;
},

cancel: async () => {
  const companyId = await getCompanyId();

  const { error } = await supabase
    .from("companies")
    .update({
      subscription_status: "inactive",
      is_pro: false,
    })
    .eq("id", companyId);


  if (error) throw error;
  return true;
},

  getStatus: async () => {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (error) throw error;

    return {
  plan: data?.current_plan || "starter",
  status: data?.subscription_status || "inactive",
  trial_ends_at: data?.trial_ends_at,
  trial_end: data?.trial_end,
  is_pro: data?.is_pro,

  canUseReports: ["pro", "business"].includes(
    data?.current_plan
  ),

  canUsePerformance: ["business"].includes(
    data?.current_plan
  ),

  canUseAdvancedScheduling: [
    "pro",
    "business",
  ].includes(data?.current_plan),

  maxEmployees:
    data?.current_plan === "starter"
      ? 5
      : data?.current_plan === "pro"
      ? 15
      : 30,
};
  },
};

export default api;

/* =========================================
AUTO SYNC
========================================= */

if (navigator.onLine) {
  shiftAPI.syncQueue();
}

window.addEventListener("online", () => {
  shiftAPI.syncQueue();
});
