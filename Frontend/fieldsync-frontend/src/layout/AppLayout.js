// src/layout/AppLayout.js
// FULL APPLAYOUT CLEAN FIX
// ✅ Correct admin sidebar order
// ✅ Schedules fixed (/schedule)
// ✅ Management tools at top
// ✅ My Schedule + My Holidays lower section
// ✅ Notifications restored
// ✅ Mobile menu fixed
// ✅ Logout kept
// ✅ No duplicate sidebar
// ✅ No dead links
// ✅ Nothing removed

import {
  useMemo,
  useState,
  useRef,
  useEffect,
} from "react";

import {
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { notificationAPI } from "../services/api";

import {
  LayoutDashboard,
  Clock,
  ClipboardList,
  CheckSquare,
  Users,
  Calendar,
  MapPin,
  FileText,
  BarChart3,
  User,
  CreditCard,
  Plane,
  Bell,
  Menu,
  X,
  ChevronRight,
  Loader2,
  Crown,
  Route as RouteIcon,
  BellRing,
  Wallet,
} from "lucide-react";

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    user,
    logout,
    plan,
    trialActive,
  } = useAuth();

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [notifOpen, setNotifOpen] =
    useState(false);

  const [notifications, setNotifications] =
    useState([]);

  const [loadingNotif, setLoadingNotif] =
    useState(true);

  const notifRef = useRef(null);

  const role =
    user?.role || "employee";

  const company =
    user?.companyName ||
    "FieldSync";

  /* ================================================= */
  /* NOTIFICATIONS */
  /* ================================================= */

  useEffect(() => {
    if (!user) return;

    loadNotifications();

    const t = setInterval(
      loadNotifications,
      15000
    );

    return () => clearInterval(t);
  }, [user]);

  async function loadNotifications() {
    try {
      setLoadingNotif(true);

      const rows =
        await notificationAPI.getAll();

      setNotifications(
        (rows || []).slice(0, 8)
      );
    } finally {
      setLoadingNotif(false);
    }
  }

  async function markRead(id) {
    await notificationAPI.markRead(id);
    loadNotifications();
  }

  async function markAllRead() {
    await notificationAPI.markAllRead();
    loadNotifications();
  }

  const unread =
    notifications.filter(
      (x) => !x.read
    ).length;

  useEffect(() => {
    function close(e) {
      if (
        notifRef.current &&
        !notifRef.current.contains(
          e.target
        )
      ) {
        setNotifOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      close
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        close
      );
  }, []);

  /* ================================================= */
  /* MENUS */
  /* ================================================= */

  const employeeMenu = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
    },
    {
      label: "Clock In / Out",
      icon: Clock,
      path: "/work-session",
    },
    {
      label: "Timesheet",
      icon: ClipboardList,
      path: "/timesheet",
    },
    {
      label: "Tasks",
      icon: CheckSquare,
      path: "/tasks",
    },
    {
      label: "Locations",
      icon: MapPin,
      path: "/my-locations",
    },
    {
      label: "Notifications",
      icon: BellRing,
      path: "/notifications",
    },
    {
      label: "My Schedule",
      icon: Calendar,
      path: "/my-schedule",
    },
    {
      label: "My Holidays",
      icon: Plane,
      path: "/my-holidays",
    },
    {
      label: "Profile",
      icon: User,
      path: "/profile",
    },
  ];

  const managerMenu = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
    },
    {
      label: "Employees",
      icon: Users,
      path: "/employees",
    },
    {
      label: "Schedules",
      icon: Calendar,
      path: "/schedule",
    },
    {
      label: "Holiday Requests",
      icon: FileText,
      path: "/holiday-requests",
    },
    {
      label: "Performance",
      icon: BarChart3,
      path: "/performance",
    },
    {
      label: "Clock In / Out",
      icon: Clock,
      path: "/work-session",
    },
    {
      label: "Timesheet",
      icon: ClipboardList,
      path: "/timesheet",
    },
    {
      label: "Tasks",
      icon: CheckSquare,
      path: "/tasks",
    },
    {
      label: "Locations",
      icon: MapPin,
      path: "/locations",
    },
    {
      label: "Route Replay",
      icon: RouteIcon,
      path: "/route-replay",
    },
    {
      label: "Notifications",
      icon: BellRing,
      path: "/notifications",
    },
    {
      label: "My Schedule",
      icon: Calendar,
      path: "/my-schedule",
    },
    {
      label: "My Holidays",
      icon: Plane,
      path: "/my-holidays",
    },
    {
      label: "Profile",
      icon: User,
      path: "/profile",
    },
  ];

  const adminMenu = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
    },
    {
      label: "Employees",
      icon: Users,
      path: "/employees",
    },
    {
      label: "Schedules",
      icon: Calendar,
      path: "/schedule",
    },
    {
      label: "Holiday Requests",
      icon: FileText,
      path: "/holiday-requests",
    },
    {
      label: "Reports",
      icon: BarChart3,
      path: "/reports",
    },
    {
      label: "Performance",
      icon: BarChart3,
      path: "/performance",
    },
    {
      label: "Payroll Export",
      icon: Wallet,
      path: "/payroll-export",
    },
    {
      label: "Billing",
      icon: CreditCard,
      path: "/billing",
    },
    {
      label: "Clock In / Out",
      icon: Clock,
      path: "/work-session",
    },
    {
      label: "Timesheet",
      icon: ClipboardList,
      path: "/timesheet",
    },
    {
      label: "Tasks",
      icon: CheckSquare,
      path: "/tasks",
    },
    {
      label: "Locations",
      icon: MapPin,
      path: "/locations",
    },
    {
      label: "Route Replay",
      icon: RouteIcon,
      path: "/route-replay",
    },
    {
      label: "Notifications",
      icon: BellRing,
      path: "/notifications",
    },
    {
      label: "My Schedule",
      icon: Calendar,
      path: "/my-schedule",
    },
    {
      label: "My Holidays",
      icon: Plane,
      path: "/my-holidays",
    },
    {
      label: "Profile",
      icon: User,
      path: "/profile",
    },
  ];

  const menu = useMemo(() => {
    if (role === "admin")
      return adminMenu;

    if (role === "manager")
      return managerMenu;

    return employeeMenu;
  }, [role]);

  const pageTitle =
    menu.find(
      (x) =>
        x.path ===
        location.pathname
    )?.label || "Dashboard";

  function go(path) {
    navigate(path);
    setMobileOpen(false);
  }

  /* ================================================= */
  /* SIDEBAR */
  /* ================================================= */

  function Sidebar() {
    return (
      <div className="h-full flex flex-col bg-[#030712]">

        {/* TOP */}
        <div className="shrink-0">

          <div className="p-6 border-b border-white/5">
            <div className="flex items-center gap-4">

              <img
                src="/fieldsync-logo.png"
                alt="FieldSync"
                className="h-14 w-auto"
              />

              <div>
                <h1 className="font-bold text-white">
                  {company}
                </h1>

                <p className="text-xs text-gray-400 capitalize">
                  {role} portal
                </p>
              </div>

            </div>
          </div>

          <div className="px-4 pt-4">
            <div className="rounded-2xl bg-indigo-600/10 border border-indigo-500/20 p-4">

              <div className="flex items-center gap-2 text-indigo-300 text-sm">
                <Crown size={15} />

                {trialActive
                  ? "Trial Active"
                  : `${plan} plan`}
              </div>

              <button
                onClick={() =>
                  go("/billing")
                }
                className="mt-3 text-xs bg-indigo-600 px-3 py-2 rounded-xl"
              >
                Manage Plan
              </button>

            </div>
          </div>

        </div>

        {/* MENU */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">

          {menu.map((item) => {
            const Icon =
              item.icon;

            const active =
              location.pathname ===
              item.path;

            return (
              <button
                key={item.path}
                onClick={() =>
                  go(item.path)
                }
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  <span>
                    {item.label}
                  </span>
                </div>

                {active && (
                  <ChevronRight size={16} />
                )}
              </button>
            );
          })}

        </div>

        {/* BOTTOM */}
        <div className="shrink-0 p-4 border-t border-white/5">

          <div className="rounded-2xl bg-white/5 p-4 mb-4">
            <p className="font-medium text-sm">
              {user?.name || "User"}
            </p>

            <p className="text-xs text-gray-400 capitalize">
              {role}
            </p>
          </div>

          <button
            onClick={logout}
            className="w-full py-3 rounded-2xl bg-red-500/20 text-red-300"
          >
            Sign Out
          </button>

        </div>

      </div>
    );
  }

  /* ================================================= */
  /* MAIN */
  /* ================================================= */

  return (
    <div className="h-screen bg-[#020617] text-white flex overflow-hidden">

      {/* DESKTOP */}
      <aside className="hidden lg:block w-80 border-r border-white/5 h-screen">
        <Sidebar />
      </aside>

      {/* CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">

        {/* HEADER */}
        <header className="h-16 shrink-0 border-b border-white/5 px-5 flex items-center justify-between bg-[#020617]">

          <div className="flex items-center gap-4">

            <button
              className="lg:hidden"
              onClick={() =>
                setMobileOpen(true)
              }
            >
              <Menu size={18} />
            </button>

            <div>
              <h1 className="font-semibold">
                {pageTitle}
              </h1>

              <p className="text-xs text-gray-500">
                {company}
              </p>
            </div>

          </div>

          <div className="flex items-center gap-3">

            {/* NOTIFICATIONS */}
            <div
              className="relative"
              ref={notifRef}
            >
              <button
                onClick={() =>
                  setNotifOpen(
                    !notifOpen
                  )
                }
                className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center relative"
              >
                <Bell size={17} />

                {unread > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-3 w-[360px] bg-[#0f172a] border border-white/10 rounded-2xl overflow-hidden z-50">

                  <div className="p-4 border-b border-white/5 flex justify-between">
                    <h3 className="font-semibold">
                      Notifications
                    </h3>

                    <button
                      onClick={
                        markAllRead
                      }
                      className="text-xs text-indigo-400"
                    >
                      Mark all read
                    </button>
                  </div>

                  {loadingNotif ? (
                    <div className="p-6 flex justify-center">
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto">
                      {notifications.map(
                        (item) => (
                          <button
                            key={item.id}
                            onClick={() =>
                              markRead(
                                item.id
                              )
                            }
                            className="w-full text-left p-4 border-b border-white/5 hover:bg-white/5"
                          >
                            <p className="text-sm font-medium">
                              {item.title}
                            </p>

                            <p className="text-xs text-gray-400 mt-1">
                              {item.message}
                            </p>
                          </button>
                        )
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>

            <button
              onClick={() =>
                navigate(
                  "/profile"
                )
              }
              className="w-11 h-11 rounded-xl bg-indigo-600 font-semibold"
            >
              {(
                user?.name || "U"
              )
                .charAt(0)
                .toUpperCase()}
            </button>

          </div>

        </header>

        {/* MOBILE */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/70">

            <div className="w-80 h-full bg-[#030712] relative">

              <button
                onClick={() =>
                  setMobileOpen(
                    false
                  )
                }
                className="absolute top-4 right-4"
              >
                <X size={18} />
              </button>

              <Sidebar />

            </div>

          </div>
        )}

        {/* PAGE */}
        <main className="flex-1 overflow-y-auto p-5 min-h-0">
          <Outlet />
        </main>

      </div>

    </div>
  );
}