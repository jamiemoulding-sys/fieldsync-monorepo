// src/pages/Dashboard.js
// CLEAN COPY / PASTE VERSION
// ✅ Removed any sidebar / layout duplication
// ✅ Dashboard content only
// ✅ Uses AppLayout sidebar only
// ✅ Employee dashboard preserved
// ✅ Admin dashboard preserved
// ✅ Nothing else changed

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

import {
  userAPI,
  shiftAPI,
  holidayAPI,
  billingAPI,
  taskAPI,
  scheduleAPI,
} from "../services/api";

import {
  Loader2,
  Clock3,
  CalendarDays,
  CheckSquare,
  AlertTriangle,
} from "lucide-react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

/* ================================================= */

export default function Dashboard() {
  const { user, loading } = useAuth();

  if (loading || !user) return <Loading />;

  if (user.role === "employee") {
    return <EmployeeDashboard user={user} />;
  }

  return <AdminDashboard user={user} />;
}

/* ================================================= */
/* EMPLOYEE DASHBOARD */
/* FULL FIXED VERSION */
/* ✅ Negative hours fixed
/* ✅ Negative pay fixed
/* ✅ Route Replay removed (employee)
/* ✅ Leave remaining added
/* ✅ Weekly hours
/* ✅ Overtime
/* ✅ Estimated pay
/* ✅ This week's shifts
/* ✅ Clean professional layout
/* ================================================= */

function EmployeeDashboard({ user }) {
  const navigate = useNavigate();

  const [loading, setLoading] =
    useState(true);

  const [shifts, setShifts] =
    useState([]);

  const [holidays, setHolidays] =
    useState([]);

  const [tasks, setTasks] =
    useState([]);

  const [activeShift, setActiveShift] =
    useState(null);

  /* ====================================== */
  /* FIRST LOAD + AUTO REFRESH */
  /* ====================================== */

  useEffect(() => {
    load();

    const t = setInterval(load, 15000);

    return () => clearInterval(t);
  }, []);

  /* ====================================== */
  /* LIVE SHIFT REFRESH (offline buttons fix)
  /* ====================================== */

  useEffect(() => {
    const refresh = () => load();

    window.addEventListener(
      "shiftUpdated",
      refresh
    );

    return () =>
      window.removeEventListener(
        "shiftUpdated",
        refresh
      );
  }, []);

  async function load() {
    try {
      const [
        allShifts,
        allHolidays,
        allTasks,
      ] = await Promise.all([
        shiftAPI.getAll(),
        holidayAPI.getAll(),
        taskAPI.getAll(),
      ]);

      const mine =
        (allShifts || []).filter(
          (x) =>
            String(x.user_id) ===
            String(user.id)
        );

      const myHolidays =
        (allHolidays || []).filter(
          (x) =>
            String(x.user_id) ===
            String(user.id)
        );

      const myTasks =
        (allTasks || []).filter((x) =>
          x.assigned_users?.includes(
            user.id
          )
        );

      const live = mine.find(
        (x) =>
          x.clock_in_time &&
          !x.clock_out_time
      );

      setShifts(mine);
      setHolidays(myHolidays);
      setTasks(myTasks);
      setActiveShift(live || null);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Loading />;

  /* ====================================== */
  /* WEEK START */
  /* ====================================== */

  const now = new Date();

  const startWeek = new Date(now);

  const day =
    startWeek.getDay() || 7;

  startWeek.setDate(
    startWeek.getDate() - day + 1
  );

  startWeek.setHours(0, 0, 0, 0);

  /* ====================================== */
  /* THIS WEEK SHIFTS */
  /* ====================================== */

  const weekShifts = shifts.filter(
    (row) =>
      row.clock_in_time &&
      new Date(
        row.clock_in_time
      ) >= startWeek
  );

  /* ====================================== */
  /* HOURS */
  /* ====================================== */

  const totalHours = weekShifts.reduce(
    (sum, row) => {
      if (!row.clock_in_time)
        return sum;

      const start = new Date(
        row.clock_in_time
      );

      const end = row.clock_out_time
        ? new Date(
            row.clock_out_time
          )
        : new Date();

      const diff =
        (end - start) / 3600000;

      if (
        isNaN(diff) ||
        diff < 0
      )
        return sum;

      return sum + diff;
    },
    0
  );

  const weekHours =
    totalHours.toFixed(1);

  const overtime = Math.max(
    totalHours - 40,
    0
  ).toFixed(1);

  /* ====================================== */
  /* PAY */
  /* ====================================== */

  const hourlyRate = Number(
    user?.profile?.hourly_rate ||
      user?.profile?.hourly_wage ||
      user?.profile?.wage ||
      user?.profile?.pay_rate ||
      0
  );

  const estimatedPay = (
    totalHours * hourlyRate
  ).toFixed(2);

  /* ====================================== */
  /* LEAVE */
  /* ====================================== */

  const allowance =
    Number(
      user?.company
        ?.holiday_allowance
    ) || 20;

  const used = holidays
    .filter(
      (x) =>
        x.status === "approved"
    )
    .reduce(
      (sum, row) =>
        sum +
        Number(row.days || 1),
      0
    );

  const remaining =
    allowance - used;

  /* ====================================== */

  const pending =
    tasks.filter(
      (x) => !x.completed
    ).length;

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div>
        <p className="text-sm text-gray-400">
          Dashboard
        </p>

        <h1 className="text-3xl font-bold mt-1">
          Good morning, {user.name}
        </h1>
      </div>

      {/* CLOCK BUTTON */}

      <button
        onClick={() =>
          navigate("/work-session")
        }
        className="w-full py-5 rounded-3xl bg-indigo-600 text-lg font-semibold"
      >
        {activeShift
          ? "Resume Shift"
          : "Clock In"}
      </button>

      {/* TOP CARDS */}

      <div className="grid md:grid-cols-4 gap-4">

        <SmallCard
          title="Hours This Week"
          value={`${weekHours} hrs`}
          icon={<Clock3 size={18} />}
        />

        <SmallCard
          title="Overtime"
          value={`${overtime} hrs`}
          icon={<Clock3 size={18} />}
        />

        <SmallCard
          title="Pending Tasks"
          value={pending}
          icon={
            <CheckSquare size={18} />
          }
        />

        <SmallCard
          title="Est. Pay"
          value={`£${estimatedPay}`}
          icon={<Clock3 size={18} />}
        />

      </div>

      {/* LEAVE CARD */}

      <div className="rounded-3xl bg-white/5 p-6 border border-white/10">

        <div className="flex items-center justify-between">

          <p className="text-sm text-gray-400">
            Leave Remaining
          </p>

          <span className="text-xs px-3 py-1 rounded-full bg-indigo-600/20 text-indigo-300">
            {user?.company
              ?.holiday_year_type ===
            "tax"
              ? "Tax Year"
              : "Jan-Dec"}
          </span>

        </div>

        <div className="mt-4 flex items-end gap-2">

          <h2 className="text-5xl font-bold">
            {remaining}
          </h2>

          <p className="text-gray-400 mb-2">
            of {allowance} days
          </p>

        </div>

        <p className="text-sm text-gray-400 mt-2">
          {used} used this year
        </p>

        <div className="mt-4 h-3 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-green-500"
            style={{
              width: `${Math.max(
                (remaining /
                  allowance) *
                  100,
                0
              )}%`,
            }}
          />
        </div>

      </div>

      {/* THIS WEEK SHIFTS */}

      <div className="rounded-3xl bg-white/5 p-6">

        <h2 className="text-xl font-semibold mb-4">
          This Week's Shifts
        </h2>

        <div className="space-y-3 max-h-[320px] overflow-y-auto">

          {weekShifts.length ? (
            weekShifts.map((row) => {
              const start =
                new Date(
                  row.clock_in_time
                );

              const end =
                row.clock_out_time
                  ? new Date(
                      row.clock_out_time
                    )
                  : null;

              let hrs = "--";

              if (end) {
                const diff =
                  (end -
                    start) /
                  3600000;

                hrs =
                  diff > 0
                    ? diff.toFixed(1)
                    : "0.0";
              }

              return (
                <div
                  key={row.id}
                  className="grid grid-cols-3 gap-3 text-sm bg-white/5 rounded-2xl p-4"
                >
                  <span>
                    {start.toLocaleDateString(
                      "en-GB"
                    )}
                  </span>

                  <span>
                    {start.toLocaleTimeString(
                      "en-GB",
                      {
                        hour:
                          "2-digit",
                        minute:
                          "2-digit",
                      }
                    )}
                  </span>

                  <span className="text-indigo-300 text-right">
                    {hrs} hrs
                  </span>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-400">
              No shifts completed this week.
            </p>
          )}

        </div>

      </div>

    </div>
  );
}
/* ================================================= */
/* ADMIN DASHBOARD */
/* ================================================= */

function AdminDashboard({ user }) {
  const [loading, setLoading] =
    useState(true);

  const [staff, setStaff] =
    useState([]);

  const [live, setLive] =
    useState([]);

  const [leave, setLeave] =
    useState([]);

  const [plan, setPlan] =
    useState("starter");

  const [shifts, setShifts] =
    useState([]);

  const [schedules, setSchedules] =
    useState([]);

  useEffect(() => {
    load();

    const t = setInterval(load, 15000);

    return () => clearInterval(t);
  }, []);

  async function load() {
  try {
    const results = await Promise.allSettled([
      userAPI.getAll(),
      shiftAPI.getAll(),
      holidayAPI.getAll(),
      billingAPI.getStatus(),
      shiftAPI.getAll(),
      scheduleAPI.getAll(),
    ]);

    const users =
      results[0].status === "fulfilled"
        ? results[0].value
        : [];

    const active =
      results[1].status === "fulfilled"
        ? results[1].value
        : [];

    const holidays =
      results[2].status === "fulfilled"
        ? results[2].value
        : [];

    const billing =
      results[3].status === "fulfilled"
        ? results[3].value
        : {};

    const allShifts =
      results[4].status === "fulfilled"
        ? results[4].value
        : [];

    const roster =
      results[5].status === "fulfilled"
        ? results[5].value
        : [];

    setStaff(Array.isArray(users) ? users : []);
    const today = new Date().toISOString().split("T")[0];

const todayRows = (active || []).filter(
  (x) =>
    x.clock_in_time &&
    x.clock_in_time.startsWith(today)
);

setLive(todayRows);
    setLeave(holidays);
    setPlan(billing?.plan || "starter");
    setShifts(allShifts);
    setSchedules(roster);

  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
}

  if (loading) return <Loading />;

  const aiAlerts =
    buildAIAlerts(shifts, staff);

  const todayWages =
    estimateWages(shifts, staff, 1);

  const weekWages =
    estimateWages(shifts, staff, 7);

  return (
    <div className="space-y-6">

      <div>
        <p className="text-sm text-gray-400">
          Dashboard
        </p>

        <h1 className="text-4xl font-bold mt-1">
          Good morning, {user.name}
        </h1>
      </div>

      <div className="grid md:grid-cols-5 gap-4">

        <Card
          title="Employees"
          value={staff.length}
          sub="Total"
        />

        <Card
          title="Clocked In"
          value={live.length}
          sub="Now"
        />

        <Card
          title="Leave"
          value={
            leave.filter(
              (x) =>
                x.status ===
                "approved"
            ).length
          }
          sub="Approved"
        />

        <Card
          title="Plan"
          value={plan}
          sub="Subscription"
        />

        <Card
          title="AI Alerts"
          value={aiAlerts.length}
          sub="Detected"
        />

      </div>

      <div className="grid md:grid-cols-2 gap-4">

        <Panel title="Live Attendance">
          <AttendanceTable
            staff={staff}
            live={live}
            schedules={schedules}
          />
        </Panel>

        <Panel title="Live Staff Map">
          <LiveMap live={live} />
        </Panel>

      </div>

      <div className="grid md:grid-cols-2 gap-4">

        <MoneyCard
          title="Today's Wages"
          value={todayWages}
        />

        <MoneyCard
          title="Weekly Wages"
          value={weekWages}
        />

      </div>

      {/* AI INSIGHTS */}
<div className="rounded-3xl bg-white/5 p-6">
  <h2 className="text-xl font-semibold mb-5">
    AI Insights
  </h2>

  <div className="grid md:grid-cols-3 gap-4">

    {aiAlerts.length ? (
      aiAlerts.map((item, i) => (
        <div
          key={i}
          className="rounded-2xl bg-[#020617] border border-white/10 p-4"
        >
          <p className="text-sm text-indigo-300">
            {item}
          </p>
        </div>
      ))
    ) : (
      <>
        <div className="rounded-2xl bg-[#020617] border border-white/10 p-4">
          <p className="text-sm text-green-400">
            No staffing risks detected.
          </p>
        </div>

        <div className="rounded-2xl bg-[#020617] border border-white/10 p-4">
          <p className="text-sm text-indigo-300">
            Wage costs stable this week.
          </p>
        </div>

        <div className="rounded-2xl bg-[#020617] border border-white/10 p-4">
          <p className="text-sm text-yellow-400">
            No anomalies found.
          </p>
        </div>
      </>
    )}

  </div>
</div>

    </div>
  );
}

/* ================================================= */

function AttendanceTable({
  staff,
  live,
  schedules,
}) {
  function timeOnly(v) {
    if (!v) return "--";

    if (String(v).includes("T")) {
      return new Date(v)
        .toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
    }

    return String(v).slice(0, 5);
  }

  function mapLink(lat, lng) {
    if (!lat || !lng) return null;

    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  function shortLocation(lat, lng) {
    if (!lat || !lng) return "--";

    return "View Location";
  }

function getStatus(emp) {
  const rows = live
    .filter(
      (x) =>
        String(x.user_id) ===
        String(emp.id)
    )
    .sort(
      (a, b) =>
        new Date(b.clock_in_time) -
        new Date(a.clock_in_time)
    );

  const shift = rows[0];

  const sched = schedules.find(
    (x) =>
      String(x.user_id) ===
      String(emp.id)
  );

  const scheduleText =
    sched?.start_time
      ? `${timeOnly(
          sched.start_time
        )}-${timeOnly(
          sched.end_time
        )}`
      : "--";

  const now = new Date();

  if (shift) {
    const clockIn = shift.clock_in_time
      ? new Date(
          shift.clock_in_time
        )
      : null;

    const clockOut =
      shift.clock_out_time
        ? new Date(
            shift.clock_out_time
          )
        : null;

    let startToday = null;
    let endToday = null;

    if (sched?.start_time) {
      const [h, m] =
        sched.start_time
          .slice(0, 5)
          .split(":");

      startToday = new Date();

      startToday.setHours(
        Number(h),
        Number(m),
        0,
        0
      );
    }

    if (sched?.end_time) {
      const [h, m] =
        sched.end_time
          .slice(0, 5)
          .split(":");

      endToday = new Date();

      endToday.setHours(
        Number(h),
        Number(m),
        0,
        0
      );
    }

    /* CLOCKED OUT */
    if (clockOut) {
      const worked =
        (clockOut - clockIn) /
        3600000;

      if (
        endToday &&
        clockOut < endToday
      ) {
        return {
          status: "Left Early",
          color:
            "text-amber-400",
          clock: timeOnly(
            shift.clock_in_time
          ),
          out: timeOnly(
            shift.clock_out_time
          ),
          schedule:
            scheduleText,
        };
      }

      if (
        worked > 10
      ) {
        return {
          status: "Overtime",
          color:
            "text-purple-400",
          clock: timeOnly(
            shift.clock_in_time
          ),
          out: timeOnly(
            shift.clock_out_time
          ),
          schedule:
            scheduleText,
        };
      }

      return {
        status: "Completed",
        color:
          "text-green-400",
        clock: timeOnly(
          shift.clock_in_time
        ),
        out: timeOnly(
          shift.clock_out_time
        ),
        schedule:
          scheduleText,
      };
    }

    /* ACTIVE SHIFT */
    const liveHours =
      (now - clockIn) /
      3600000;

    if (
      liveHours > 10
    ) {
      return {
        status: "Long Shift",
        color:
          "text-red-400",
        clock: timeOnly(
          shift.clock_in_time
        ),
        out: "--",
        schedule:
          scheduleText,
      };
    }

    return {
      status: "On Shift",
      color:
        "text-green-400",
      clock: timeOnly(
        shift.clock_in_time
      ),
      out: "--",
      schedule:
        scheduleText,
    };
  }

  if (sched?.start_time) {
    const [h, m] =
      sched.start_time
        .slice(0, 5)
        .split(":");

    const startToday =
      new Date();

    startToday.setHours(
      Number(h),
      Number(m),
      0,
      0
    );

    const minsLate =
      Math.floor(
        (now - startToday) /
        60000
      );

    if (minsLate >= 60) {
      return {
        status: "Absent",
        color:
          "text-red-400",
        clock: "--",
        out: "--",
        schedule:
          scheduleText,
      };
    }

    if (minsLate > 0) {
      return {
        status: `Late ${minsLate}m`,
        color:
          "text-amber-400",
        clock: "--",
        out: "--",
        schedule:
          scheduleText,
      };
    }

    return {
      status: "Scheduled",
      color:
        "text-indigo-300",
      clock: "--",
      out: "--",
      schedule:
        scheduleText,
    };
  }

  return {
    status: "Off",
    color:
      "text-gray-500",
    clock: "--",
    out: "--",
    schedule: "--",
  };
}

  return (
    <div className="rounded-3xl bg-white/5 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-gray-400">
          <tr>
            <th className="p-4 text-left">
              Employee
            </th>
            <th className="p-4 text-left">
              In
            </th>
            <th className="p-4 text-left">
              Out
            </th>
            <th className="p-4 text-left">
              Schedule
            </th>
            <th className="p-4 text-left">
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          {staff.map((emp) => {
            const row =
              getStatus(emp);

            return (
              <tr
                key={emp.id}
                className="border-t border-white/5"
              >
                <td className="p-4 font-medium">
                  {emp.name}
                </td>

                <td className="p-4">
                  <div>
                    {row.clock}
                  </div>

                  {row.inLat &&
                    row.inLng && (
                      <a
                        href={mapLink(
                          row.inLat,
                          row.inLng
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-300 hover:underline"
                      >
                        {shortLocation(
                          row.inLat,
                          row.inLng
                        )}
                      </a>
                    )}
                </td>

                <td className="p-4">
                  <div>{row.out}</div>

                  {row.outLat &&
                    row.outLng && (
                      <a
                        href={mapLink(
                          row.outLat,
                          row.outLng
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-300 hover:underline"
                      >
                        {shortLocation(
                          row.outLat,
                          row.outLng
                        )}
                      </a>
                    )}
                </td>

                <td className="p-4">
                  {row.schedule}
                </td>

                <td
                  className={`p-4 font-medium ${row.color}`}
                >
                  {row.status}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function estimateWages(
  shifts,
  staff,
  days = 7
) {
  let total = 0;

  const fromDate = new Date();

  fromDate.setDate(
    fromDate.getDate() - (days - 1)
  );

  fromDate.setHours(0, 0, 0, 0);

  shifts.forEach((row) => {
    if (!row.clock_in_time)
      return;

    const start = new Date(
      row.clock_in_time
    );

    if (start < fromDate)
      return;

    const end =
      row.clock_out_time
        ? new Date(
            row.clock_out_time
          )
        : new Date();

    const emp = staff.find(
      (x) =>
        String(x.id) ===
        String(row.user_id)
    );

    const rate = Number(
      emp?.hourly_rate || 0
    );

    const hours = Math.max(
      (end - start) / 3600000,
      0
    );

    total += hours * rate;
  });

  return total.toFixed(2);
}


function buildAIAlerts(shifts, staff) {
  const alerts = [];

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  /* ===============================
     PER EMPLOYEE ANALYSIS
  =============================== */

  staff.forEach((emp) => {
    const rows = shifts.filter(
      (x) =>
        String(x.user_id) ===
        String(emp.id)
    );

    const recent = rows.slice(-14);

    let late = 0;
    let missed = 0;
    let overtime = 0;

    recent.forEach((row) => {
      if (!row.clock_in_time) {
        missed++;
        return;
      }

      if (row.start_time) {
        const actual = new Date(
          row.clock_in_time
        );

        const planned = new Date(
          row.start_time
        );

        const mins =
          (actual - planned) /
          60000;

        if (mins > 5) late++;
      }

      if (
        row.clock_in_time &&
        row.clock_out_time
      ) {
        const hrs =
          (new Date(
            row.clock_out_time
          ) -
            new Date(
              row.clock_in_time
            )) /
          3600000;

        if (hrs > 10) overtime++;
      }
    });

    /* repeat lateness */
    if (late >= 3) {
      alerts.push(
        `${emp.name} attendance declining (${late} late arrivals).`
      );
    }

    /* missed shifts */
    if (missed >= 2) {
      alerts.push(
        `${emp.name} missed ${missed} scheduled shifts.`
      );
    }

    /* burnout risk */
    if (overtime >= 3) {
      alerts.push(
        `${emp.name} may be burnout risk (${overtime} long shifts).`
      );
    }

    /* today no clock in */
    const todayShift = rows.find(
      (x) => x.date === today
    );

    if (
      todayShift &&
      !todayShift.clock_in_time &&
      todayShift.start_time
    ) {
      const start = new Date(
        todayShift.start_time
      );

      if (
        now >
        new Date(
          start.getTime() +
            30 * 60000
        )
      ) {
        alerts.push(
          `${emp.name} has not clocked in for today's shift.`
        );
      }
    }
  });

  /* ===============================
     COMPANY ANALYSIS
  =============================== */

  const open = shifts.filter(
    (x) =>
      x.clock_in_time &&
      !x.clock_out_time
  ).length;

  if (open > 5) {
    alerts.push(
      "Multiple open shifts still active."
    );
  }

  const totalLate = alerts.filter((x) =>
    x.includes("late")
  ).length;

  if (totalLate >= 3) {
    alerts.push(
      "Company lateness trend rising this week."
    );
  }

  const totalHours = shifts.reduce(
    (sum, row) => {
      if (
        !row.clock_in_time ||
        !row.clock_out_time
      )
        return sum;

      return (
        sum +
        (new Date(
          row.clock_out_time
        ) -
          new Date(
            row.clock_in_time
          )) /
          3600000
      );
    },
    0
  );

  if (totalHours > 250) {
    alerts.push(
      "Weekly labour hours unusually high."
    );
  }

  return alerts.slice(0, 8);
}

function LiveMap({ live }) {
  const points = live.filter(
    (x) =>
      x.clock_in_lat &&
      x.clock_in_lng
  );

  const center = points.length
    ? [
        Number(points[0].clock_in_lat),
        Number(points[0].clock_in_lng),
      ]
    : [51.5072, -0.1276];

  return (
    <div className="h-[390px] rounded-2xl overflow-hidden">
      <MapContainer
        center={center}
        zoom={11}
        style={{
          height: "100%",
          width: "100%",
        }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {points.map((row) => (
          <Marker
            key={row.id}
            position={[
              Number(row.clock_in_lat),
              Number(row.clock_in_lng),
            ]}
          >
            <Popup>
              {row.users?.name || "Staff"}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

/* ================================================= */

function SmallCard({
  title,
  value,
  icon,
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-5">
      <p>{title}</p>
      <h2 className="text-2xl font-bold mt-3">
        {value}
      </h2>
    </div>
  );
}

function Card({
  title,
  value,
  sub,
}) {
  return (
    <div className="rounded-3xl bg-white/5 p-5">
      <p>{title}</p>
      <h2 className="text-4xl font-bold mt-3">
        {value}
      </h2>
      <p>{sub}</p>
    </div>
  );
}

function MoneyCard({
  title,
  value,
}) {
  return (
    <div className="rounded-3xl bg-white/5 p-6">
      <p>{title}</p>
      <h2 className="text-4xl font-bold mt-4">
        £{value}
      </h2>
    </div>
  );
}

function Panel({
  title,
  children,
}) {
  return (
    <div className="rounded-3xl bg-white/5 p-6">
      <h2 className="font-semibold text-xl mb-5">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="p-10 flex gap-2 text-gray-400">
      <Loader2
        size={16}
        className="animate-spin"
      />
      Loading dashboard...
    </div>
  );
}