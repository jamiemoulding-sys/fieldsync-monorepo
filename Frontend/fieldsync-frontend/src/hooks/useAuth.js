// src/hooks/useAuth.js
// FULL FIXED INVITE / LOADING LOOP VERSION
// ✅ Fixes invite accepted stuck loading
// ✅ Fixes dashboard redirect after SetPassword
// ✅ Keeps billing / plans / trial logic
// ✅ Handles missing users row properly
// ✅ Fast auth refresh after invite

import {
  useState,
  useEffect,
  useCallback,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import supabase from "../lib/supabase";

/* ===================================================== */

let globalUser = null;
let globalLoading = true;
let listeners = [];
let started = false;

/* ===================================================== */

function emit() {
  listeners.forEach((fn) =>
    fn({
      user: globalUser,
      loading: globalLoading,
    })
  );
}

function setUser(user) {
  globalUser = user;
  emit();
}

function setLoading(v) {
  globalLoading = v;
  emit();
}

/* ===================================================== */

async function loadProfile() {
  try {
    const {
      data: { session },
    } =
      await supabase.auth.getSession();

    /* NO SESSION */
    if (!session?.user) {
      setUser(null);
      return;
    }

    const authUser =
      session.user;

    /* =====================================
       GET USERS ROW
    ===================================== */

    const {
      data: row,
    } =
      await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

    /* =====================================
       IF INVITE USER ROW MISSING
       still allow login
    ===================================== */

    if (!row) {
      setUser({
        id: authUser.id,
        email: authUser.email,
        role: "employee",
        name: "",
        companyId: null,
        companyName: "",
        isPro: false,
        currentPlan: "starter",
        trialActive: false,
        hasPremiumAccess: true,
      });

      return;
    }

    /* =====================================
       COMPANY
    ===================================== */

    let company = null;

    if (row.company_id) {
      const { data } =
        await supabase
          .from("companies")
          .select("*")
          .eq("id", row.company_id)
          .maybeSingle();

      company = data;
    }

    const trialEnd =
      company?.trial_ends_at ||
      company?.trial_end ||
      null;

    const trialActive =
      !!trialEnd &&
      new Date(trialEnd) >
        new Date();

    const paid =
      company?.subscription_status ===
        "active" ||
      company?.is_pro === true;

    const currentPlan =
      company?.current_plan ||
      "starter";

    setUser({
  ...row,                 // restores ALL columns directly
  id: authUser.id,
  email: authUser.email,
  companyId: row.company_id,
  companyName: company?.name || "",
  isPro: paid,
  currentPlan,
  trial_end: trialEnd,
  trialActive,
  hasPremiumAccess: paid || trialActive,
  company,
  profile: row,
});
  } catch (err) {
    console.error(err);
    setUser(null);
  }
}

/* ===================================================== */

async function init() {
  if (started) return;

  started = true;

  setLoading(true);

  try {
    await loadProfile();
  } finally {
    setLoading(false);
  }

  /* =====================================
     AUTH CHANGES
  ===================================== */

  supabase.auth.onAuthStateChange((_event, session) => {
  setTimeout(async () => {
    setLoading(true);
    await loadProfile();
    setLoading(false);
  }, 0);
});
}

/* ===================================================== */

export function useAuth() {
  const navigate =
    useNavigate();

  const [user, setLocalUser] =
    useState(globalUser);

  const [
    loading,
    setLocalLoading,
  ] = useState(
    globalLoading
  );

  useEffect(() => {
    const sub = (
      state
    ) => {
      setLocalUser(
        state.user
      );

      setLocalLoading(
        state.loading
      );
    };

    listeners.push(sub);

    init();

    return () => {
      listeners =
        listeners.filter(
          (x) =>
            x !== sub
        );
    };
  }, []);

  /* ===================================================== */

  const login =
    useCallback(
      async (
        email,
        password
      ) => {
        const {
          error,
        } =
          await supabase.auth.signInWithPassword(
            {
              email,
              password,
            }
          );

        if (error)
          throw error;

        await loadProfile();

        navigate(
          "/dashboard"
        );
      },
      [navigate]
    );

  const logout =
    useCallback(
      async () => {
        await supabase.auth.signOut({ scope: "local" });

        setUser(null);

        navigate(
          "/login",
          {
            replace: true,
          }
        );
      },
      [navigate]
    );

  const reloadUser =
    useCallback(
      async () => {
        await loadProfile();
      },
      []
    );

  return {
    user,
    loading,

    login,
    logout,
    reloadUser,

    isAdmin:
      user?.role ===
      "admin",

    isManager:
      user?.role ===
        "manager" ||
      user?.role ===
        "admin",

    isPaid:
      user?.isPro,

    trialActive:
      user?.trialActive,

    hasPremiumAccess:
      user?.hasPremiumAccess,

    plan:
      user?.currentPlan ||
      "starter",
  };
}

export default useAuth;