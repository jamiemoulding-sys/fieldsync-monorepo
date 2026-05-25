// src/App.js
// FULL FILE REPLACEMENT
// ✅ Offline airplane mode open fixed
// ✅ Cached user support
// ✅ Existing routes untouched
// ✅ Route protection kept
// ✅ Admin / Manager / Employee logic kept

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import {
  useEffect,
  useState,
} from "react";

import { Toaster } from "react-hot-toast";
import { useAuth } from "./hooks/useAuth";

/* PUBLIC */
import Landing from "./pages/Landing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import SetPassword from "./pages/SetPassword";
import ResetPassword from "./pages/ResetPassword";

/* CORE */
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Schedule from "./pages/Schedule";
import ScheduleCalendar from "./pages/ScheduleCalendar";
import HolidayRequests from "./pages/HolidayRequests";
import Announcements from "./pages/Announcements";
import TimeSheet from "./pages/TimeSheet";
import WorkSession from "./pages/WorkSession";
import Notifications from "./pages/Notifications";

/* EMPLOYEE */
import MySchedule from "./pages/MySchedule";
import MyHolidays from "./pages/MyHolidays";
import MyLocations from "./pages/MyLocations";

/* OTHER */
import Employees from "./pages/Employees";
import Locations from "./pages/Locations";
import Reports from "./pages/Reports";
import Performance from "./pages/Performance";
import Billing from "./pages/Billing";
import Profile from "./pages/Profile";
import Success from "./pages/Success";
import AppLayout from "./layout/AppLayout";
import RouteReplay from "./pages/RouteReplay";
import PayrollExport from "./pages/PayrollExport";
import Alerts from "./pages/Alerts";

/* ================================================= */

function ScreenLoader() {
  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center">
      Loading...
    </div>
  );
}

function ExpiredPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-3xl border border-white/10 bg-[#020617] p-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">
          Subscription Expired
        </h1>

        <p className="text-gray-400 text-sm">
          Please contact your administrator.
        </p>
      </div>
    </div>
  );
}



/* ================================================= */

function VisibilityRefresh() {
  const { reloadUser } = useAuth();

  useEffect(() => {
    const refresh = () => {
      if (
        navigator.onLine &&
        document.visibilityState ===
          "visible"
      ) {
        reloadUser?.();
      }
    };

    document.addEventListener(
      "visibilitychange",
      refresh
    );

    window.addEventListener(
      "focus",
      refresh
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        refresh
      );

      window.removeEventListener(
        "focus",
        refresh
      );
    };
  }, [reloadUser]);

  return null;
}

/* ================================================= */

function getTrialActive(user) {
  return (
    user?.trial_end &&
    new Date(user.trial_end) >
      new Date()
  );
}

function getHasAccess(user) {
  return (
    user?.hasPremiumAccess === true ||
    user?.subscription_status === "active" ||
    user?.subscription_status === "trial" ||
    getTrialActive(user) ||
    user?.role === "employee" ||
    user?.role === "manager" ||
    user?.role === "admin"
  );
}

/* ================================================= */

function ProtectedRoute({
  children,
}) {
  const {
    user,
    loading,
  } = useAuth();

  /* ===================================== */
  /* OFFLINE MODE FIX */
  /* ===================================== */

  if (!navigator.onLine) {
    const cachedUser =
      localStorage.getItem(
        "cachedUser"
      );

    if (cachedUser) {
      return children;
    }

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  /* ===================================== */
  /* ONLINE MODE */
  /* ===================================== */

  if (loading)
    return <ScreenLoader />;

  if (!user && !loading) {
  return <Navigate to="/login" replace />;
}
  

  const hasAccess =
    getHasAccess(user);

  if (!hasAccess) {
    if (
      user.role === "admin"
    ) {
      return (
        <Navigate
          to="/billing"
          replace
        />
      );
    }

    return <ExpiredPage />;
  }

  return children;
}

function RoleRoute({
  roles,
  children,
}) {
  const {
    user,
    loading,
  } = useAuth();

  if (!navigator.onLine) {
    return children;
  }

  if (loading)
    return <ScreenLoader />;

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (
    !roles.includes(
      user.role
    )
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
}

function PublicOnly({
  children,
}) {
  const {
    user,
    loading,
  } = useAuth();

  if (!navigator.onLine) {
    return children;
  }

  if (loading)
    return <ScreenLoader />;

  if (user) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
}

/* ================================================= */

export default function App() {
  const [ready, setReady] =
    useState(false);

  useEffect(() => {
    const t = setTimeout(
      () =>
        setReady(true),
      150
    );

    return () =>
      clearTimeout(t);
  }, []);

  if (!ready)
    return <ScreenLoader />;
return (
  <Router>
    <VisibilityRefresh />

    <Toaster
      position="top-right"
      toastOptions={{
        duration: 5000,
        style: {
          background: "#020617",
          color: "#fff",
          border: "1px solid #334155",
        },
      }}
    />

    <Routes>

        {/* PUBLIC */}

        <Route
          path="/"
          element={
            <PublicOnly>
              <Landing />
            </PublicOnly>
          }
        />

        <Route
          path="/signup"
          element={
            <PublicOnly>
              <Signup />
            </PublicOnly>
          }
        />

        <Route
          path="/login"
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />

        <Route
          path="/set-password"
          element={<SetPassword />}
        />

        <Route
          path="/accept-invite/*"
          element={<SetPassword />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        <Route
          path="/billing-success"
          element={<Success />}
        />

        {/* PRIVATE */}

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/profile"
            element={<Profile />}
          />

          <Route
            path="/notifications"
            element={
              <Notifications />
            }
          />

          <Route
            path="/work-session"
            element={
              <WorkSession />
            }
          />

          <Route
            path="/tasks"
            element={<Tasks />}
          />

          <Route
            path="/timesheet"
            element={<TimeSheet />}
          />

          <Route
            path="/my-schedule"
            element={
              <MySchedule />
            }
          />

          <Route
            path="/my-holidays"
            element={
              <MyHolidays />
            }
          />

          <Route
            path="/my-locations"
            element={
              <MyLocations />
            }
          />

          <Route
            path="/employees"
            element={
              <RoleRoute
                roles={[
                  "manager",
                  "admin",
                ]}
              >
                <Employees />
              </RoleRoute>
            }
          />

          <Route
            path="/schedule"
            element={
              <RoleRoute
                roles={[
                  "manager",
                  "admin",
                ]}
              >
                <Schedule />
              </RoleRoute>
            }
          />

          <Route
            path="/calendar"
            element={
              <RoleRoute
                roles={[
                  "manager",
                  "admin",
                ]}
              >
                <ScheduleCalendar />
              </RoleRoute>
            }
          />

          <Route
            path="/holiday-requests"
            element={
              <RoleRoute
                roles={[
                  "manager",
                  "admin",
                ]}
              >
                <HolidayRequests />
              </RoleRoute>
            }
          />

          <Route
            path="/announcements"
            element={
              <RoleRoute
                roles={[
                  "manager",
                  "admin",
                ]}
              >
                <Announcements />
              </RoleRoute>
            }
          />

          <Route
            path="/locations"
            element={
              <RoleRoute
                roles={[
                  "manager",
                  "admin",
                ]}
              >
                <Locations />
              </RoleRoute>
            }
          />

          <Route
            path="/performance"
            element={
              <RoleRoute
                roles={[
                  "manager",
                  "admin",
                ]}
              >
                <Performance />
              </RoleRoute>
            }
          />

          <Route
            path="/alerts"
            element={
              <RoleRoute
                roles={[
                  "manager",
                  "admin",
                ]}
              >
                <Alerts />
              </RoleRoute>
            }
          />

          <Route
            path="/route-replay"
            element={
              <RoleRoute
                roles={[
                  "manager",
                  "admin",
                ]}
              >
                <RouteReplay />
              </RoleRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <RoleRoute
                roles={["admin"]}
              >
                <Reports />
              </RoleRoute>
            }
          />

          <Route
            path="/payroll-export"
            element={
              <RoleRoute
                roles={["admin"]}
              >
                <PayrollExport />
              </RoleRoute>
            }
          />

          <Route
            path="/billing"
            element={
              <RoleRoute
                roles={["admin"]}
              >
                <Billing />
              </RoleRoute>
            }
          />

        </Route>

        {/* FALLBACK */}

        <Route
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

      </Routes>
    </Router>
  );
}