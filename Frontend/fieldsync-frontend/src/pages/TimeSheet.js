// src/pages/TimeSheet.js
// FINAL TimeSheet PRO
// ✅ Full replacement
// ✅ Keeps Live Active Staff
// ✅ Keeps Force Clock Out
// ✅ Negative hours/pay fixed
// ✅ Employee only sees own data
// ✅ Manager/Admin all staff
// ✅ Correct totals
// ✅ Export CSV
// ✅ Production safe

import React, { useEffect, useMemo, useState } from "react";
import { reportAPI, userAPI, shiftAPI } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import HomeButton from "../components/HomeButton";
import { motion } from "framer-motion";

import {
  Clock3,
  Download,
  Search,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Users,
  CalendarDays,
  PoundSterling,
  Briefcase,
} from "lucide-react";

export default function TimeSheet() {
  const { user } = useAuth();

  const role = user?.role || "employee";

  const [rows, setRows] = useState([]);
  const [staff, setStaff] = useState([]);
  const [active, setActive] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState("");

  const [fromDate, setFromDate] = useState(
    new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .split("T")[0]
  );

  const [toDate, setToDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [finishTimes, setFinishTimes] = useState({});

  useEffect(() => {
    loadData();
  }, [fromDate, toDate, employee]);

  async function loadData() {
    try {
      setLoading(true);

      const [timesheets, users, live] =
        await Promise.all([
          reportAPI.getTimesheets(),
          userAPI.getAll(),
          shiftAPI.getActiveAll(),
        ]);

      let data = Array.isArray(timesheets)
        ? timesheets
        : [];

      if (role === "employee") {
        data = data.filter(
          (x) =>
            String(x.user_id) ===
            String(user.id)
        );
      }

      data = data.filter((row) => {
        if (!row.clock_in_time)
          return false;

        const day =
          row.clock_in_time.split("T")[0];

        const dateMatch =
          day >= fromDate &&
          day <= toDate;

        const employeeMatch =
          employee
            ? String(row.user_id) ===
              String(employee)
            : true;

        return (
          dateMatch &&
          employeeMatch
        );
      });

      setRows(data);
      setStaff(users || []);
      setActive(live || []);
    } finally {
      setLoading(false);
    }
  }

  function getUser(id) {
    return (
      staff.find(
        (u) =>
          String(u.id) ===
          String(id)
      ) || {}
    );
  }

  function formatDate(v) {
    if (!v) return "-";

    return new Date(v).toLocaleDateString(
      "en-GB"
    );
  }

  function formatTime(v) {
    if (!v) return "-";

    return new Date(v).toLocaleTimeString(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  function calcHours(
    start,
    end,
    breakSecs = 0
  ) {
    if (!start || !end) return 0;

    const diff =
      (new Date(end).getTime() -
        new Date(start).getTime()) /
        3600000 -
      Number(breakSecs || 0) / 3600;

    return Math.max(diff, 0);
  }

  function overtime(hours) {
    return hours > 8
      ? hours - 8
      : 0;
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const u = getUser(r.user_id);

      const txt = search.toLowerCase();

      return (
        (u.name || "")
          .toLowerCase()
          .includes(txt) ||
        (u.email || "")
          .toLowerCase()
          .includes(txt)
      );
    });
  }, [rows, search, staff]);

  const totalHours = filtered
    .reduce(
      (sum, r) =>
        sum +
        calcHours(
          r.clock_in_time,
          r.clock_out_time,
          r.total_break_seconds
        ),
      0
    )
    .toFixed(2);

  const totalOT = filtered
    .reduce(
      (sum, r) =>
        sum +
        overtime(
          calcHours(
            r.clock_in_time,
            r.clock_out_time,
            r.total_break_seconds
          )
        ),
      0
    )
    .toFixed(2);

  const totalWages = filtered
    .reduce((sum, r) => {
      const u = getUser(r.user_id);

      const hrs = calcHours(
        r.clock_in_time,
        r.clock_out_time,
        r.total_break_seconds
      );

      return (
        sum +
        hrs *
          Number(
            u.hourly_rate || 0
          )
      );
    }, 0)
    .toFixed(2);

  const overContractCount =
    staff.filter((u) => {
      const contract = Number(
        u.contracted_hours || 0
      );

      if (!contract) return false;

      const worked = filtered
        .filter(
          (r) =>
            String(r.user_id) ===
            String(u.id)
        )
        .reduce(
          (sum, r) =>
            sum +
            calcHours(
              r.clock_in_time,
              r.clock_out_time,
              r.total_break_seconds
            ),
          0
        );

      return worked > contract;
    }).length;

  async function forceOut(id) {
    try {
      setSaving(true);

      await shiftAPI.managerClockOut(
        id,
        finishTimes[id] || null
      );

      await loadData();
    } finally {
      setSaving(false);
    }
  }

  function exportCSV() {
    const csvRows = filtered.map(
      (r) => {
        const u = getUser(r.user_id);

        const hrs = calcHours(
          r.clock_in_time,
          r.clock_out_time,
          r.total_break_seconds
        );

        const wage =
          hrs *
          Number(
            u.hourly_rate || 0
          );

        return [
          u.name || "",
          formatDate(
            r.clock_in_time
          ),
          formatTime(
            r.clock_in_time
          ),
          formatTime(
            r.clock_out_time
          ),
          hrs.toFixed(2),
          overtime(hrs).toFixed(2),
          wage.toFixed(2),
        ];
      }
    );

    const csv = [
      [
        "Employee",
        "Date",
        "In",
        "Out",
        "Hours",
        "OT",
        "Wage",
      ],
      ...csvRows,
    ]
      .map((x) => x.join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv",
    });

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download =
      "timesheets.csv";
    a.click();
  }

  if (loading) {
    return (
      <div className="text-gray-400 flex gap-2 items-center">
        <Loader2
          size={16}
          className="animate-spin"
        />
        Loading timesheets...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between flex-wrap gap-4 items-center">
        <div>
          <h1 className="text-2xl font-semibold">
            Timesheets
          </h1>

          <p className="text-sm text-gray-400">
            Payroll & worked hours
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="px-4 py-2 rounded-xl bg-indigo-600"
          >
            <Download size={16} />
          </button>

          <HomeButton />
        </div>
      </div>

      {/* KPI */}
      <div className="grid md:grid-cols-5 gap-4">
        <Card
          title="Staff"
          value={staff.length}
          icon={<Users size={16} />}
        />

        <Card
          title="Entries"
          value={filtered.length}
          icon={
            <CalendarDays size={16} />
          }
        />

        <Card
          title="Hours"
          value={totalHours}
          icon={<Clock3 size={16} />}
        />

        <Card
          title="Overtime"
          value={totalOT}
          icon={
            <AlertTriangle size={16} />
          }
        />

        <Card
          title="Wages"
          value={`£${totalWages}`}
          icon={
            <PoundSterling size={16} />
          }
        />
      </div>

      {/* WARNING */}
      {overContractCount > 0 && (
        <div className="rounded-xl bg-amber-500/10 text-amber-300 px-4 py-3 text-sm flex gap-2 items-center">
          <Briefcase size={16} />
          {
            overContractCount
          }{" "}
          staff over contracted hours
        </div>
      )}

      {/* LIVE ACTIVE STAFF */}
      {role !== "employee" && (
        <div className="rounded-2xl border border-white/10 bg-[#020617] p-5 space-y-4">
          <h3 className="font-medium">
            Live Active Staff
          </h3>

          {active.length === 0 && (
            <p className="text-gray-500">
              Nobody clocked in
            </p>
          )}

          {active.map((s) => (
            <div
              key={s.id}
              className="border border-white/10 rounded-xl p-4 space-y-3"
            >
              <p className="font-medium">
                {s.users?.name ||
                  "Unknown"}
              </p>

              <input
                type="datetime-local"
                value={
                  finishTimes[s.id] ||
                  ""
                }
                onChange={(e) =>
                  setFinishTimes({
                    ...finishTimes,
                    [s.id]:
                      e.target.value,
                  })
                }
                className="w-full px-4 py-3 rounded-xl bg-[#0f172a]"
              />

              <button
                disabled={saving}
                onClick={() =>
                  forceOut(s.id)
                }
                className="w-full py-3 rounded-xl bg-red-600"
              >
                Force Clock Out
              </button>
            </div>
          ))}
        </div>
      )}

      {/* FILTERS */}
      <div className="grid md:grid-cols-4 gap-3">

        <input
          type="date"
          value={fromDate}
          onChange={(e) =>
            setFromDate(
              e.target.value
            )
          }
          className="px-4 py-3 rounded-xl bg-[#020617]"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) =>
            setToDate(
              e.target.value
            )
          }
          className="px-4 py-3 rounded-xl bg-[#020617]"
        />

        {role !==
          "employee" && (
          <select
            value={employee}
            onChange={(e) =>
              setEmployee(
                e.target.value
              )
            }
            className="px-4 py-3 rounded-xl bg-[#020617]"
          >
            <option value="">
              All Staff
            </option>

            {staff.map((u) => (
              <option
                key={u.id}
                value={u.id}
              >
                {u.name}
              </option>
            ))}
          </select>
        )}

        <div className="relative">
          <Search
            size={16}
            className="absolute left-4 top-4 text-gray-500"
          />

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#020617]"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="rounded-2xl border border-white/10 bg-[#020617] overflow-auto">
        <table className="w-full min-w-[1000px] text-sm">

          <thead className="bg-white/5 text-gray-400">
            <tr>
              <th className="p-4 text-left">
                Employee
              </th>
              <th className="p-4 text-left">
                Date
              </th>
              <th className="p-4 text-left">
                In
              </th>
              <th className="p-4 text-left">
                Out
              </th>
              <th className="p-4 text-left">
                Hours
              </th>
              <th className="p-4 text-left">
                OT
              </th>
              <th className="p-4 text-left">
                Wage
              </th>
              <th className="p-4 text-left">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {filtered.map(
              (row, i) => {
                const u =
                  getUser(
                    row.user_id
                  );

                const hrs =
                  calcHours(
                    row.clock_in_time,
                    row.clock_out_time,
                    row.total_break_seconds
                  );

                const wage =
                  hrs *
                  Number(
                    u.hourly_rate ||
                      0
                  );

                return (
                  <motion.tr
                    key={row.id}
                    initial={{
                      opacity: 0,
                      y: 8,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      delay:
                        i *
                        0.01,
                    }}
                    className="border-t border-white/5"
                  >
                    <td className="p-4">
                      {u.name ||
                        "Unknown"}
                    </td>

                    <td className="p-4">
                      {formatDate(
                        row.clock_in_time
                      )}
                    </td>

                    <td className="p-4">
                      {formatTime(
                        row.clock_in_time
                      )}
                    </td>

                    <td className="p-4">
                      {formatTime(
                        row.clock_out_time
                      )}
                    </td>

                    <td className="p-4">
                      {hrs.toFixed(
                        2
                      )}
                    </td>

                    <td className="p-4 text-amber-400">
                      {overtime(
                        hrs
                      ).toFixed(
                        2
                      )}
                    </td>

                    <td className="p-4">
                      £
                      {wage.toFixed(
                        2
                      )}
                    </td>

                    <td className="p-4">
                      {row.clock_out_time ? (
                        <span className="text-green-400 inline-flex gap-1 items-center">
                          <CheckCircle2 size={14} />
                          Complete
                        </span>
                      ) : (
                        <span className="text-red-400">
                          Open Shift
                        </span>
                      )}
                    </td>
                  </motion.tr>
                );
              }
            )}
          </tbody>

        </table>
      </div>

    </div>
  );
}

function Card({
  title,
  value,
  icon,
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#020617] p-4">
      <div className="flex justify-between">
        <p className="text-xs text-gray-400">
          {title}
        </p>

        <div className="text-indigo-400">
          {icon}
        </div>
      </div>

      <h2 className="text-2xl font-semibold mt-2">
        {value}
      </h2>
    </div>
  );
}