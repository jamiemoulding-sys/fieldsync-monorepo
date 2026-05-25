// src/pages/HolidayRequests.jsx
// FULL FILE REPLACEMENT
// ✅ Holiday allowance added back to list view
// ✅ List / Week / Month views kept
// ✅ Shows shifts + holidays
// ✅ Reject reason support
// ✅ Ready to paste

import { useEffect, useState } from "react";
import {
  holidayAPI,
  scheduleAPI,
  userAPI,
} from "../services/api";

import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  List,
  CalendarDays,
  CalendarRange,
} from "lucide-react";

export default function HolidayRequests() {
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);

  const [view, setView] = useState("list");
  const [loading, setLoading] = useState(true);

  const [openModal, setOpenModal] =
    useState(false);

  const [form, setForm] = useState({
    user_id: "",
    start_date: "",
    end_date: "",
    status: "approved",
  });

  const [date, setDate] = useState(
    new Date()
  );

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      const [h, s, u] =
        await Promise.all([
          holidayAPI.getAll(),
          scheduleAPI.getAll(),
          userAPI.getAll(),
        ]);

      setRequests(
        Array.isArray(h) ? h : []
      );

      setShifts(
        Array.isArray(s) ? s : []
      );

      setUsers(
        Array.isArray(u) ? u : []
      );
    } finally {
      setLoading(false);
    }
  }

  function getUser(id) {
    return (
      users.find(
        (x) => x.id === id
      ) || {}
    );
  }

  function allowance(id) {
    const u = getUser(id);

    return Number(
      u.holiday_allowance ??
        u.holiday_days ??
        u.annual_leave ??
        20
    );
  }

  function usedDays(id) {
    const approved =
      requests.filter(
        (x) =>
          x.user_id === id &&
          x.status === "approved"
      );

    let total = 0;

    approved.forEach((r) => {
      let d = new Date(
        r.start_date
      );

      const end = new Date(
        r.end_date
      );

      while (d <= end) {
        const day =
          d.getDay();

        if (
          day >= 1 &&
          day <= 5
        ) {
          total++;
        }

        d.setDate(
          d.getDate() + 1
        );
      }
    });

    return total;
  }

  function format(ds) {
    return new Date(
      ds
    ).toLocaleDateString("en-GB");
  }

  function dateStr(d) {
    const y = d.getFullYear();
    const m = String(
      d.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      d.getDate()
    ).padStart(2, "0");

    return `${y}-${m}-${day}`;
  }

  async function approve(id) {
    await holidayAPI.approve(id);
    load();
  }

  async function reject(id) {
    const reason = prompt(
      "Reason for rejection?"
    );

    await holidayAPI.reject(
      id,
      reason || ""
    );

    load();
  }

  async function remove(id) {
    await holidayAPI.delete(id);
    load();
  }

  async function createLeave() {
    await holidayAPI.create(form);

    setOpenModal(false);

    setForm({
      user_id: "",
      start_date: "",
      end_date: "",
      status: "approved",
    });

    load();
  }

  function prev() {
    const d = new Date(date);

    if (view === "month") {
      d.setMonth(
        d.getMonth() - 1
      );
    } else {
      d.setDate(
        d.getDate() - 7
      );
    }

    setDate(d);
  }

  function next() {
    const d = new Date(date);

    if (view === "month") {
      d.setMonth(
        d.getMonth() + 1
      );
    } else {
      d.setDate(
        d.getDate() + 7
      );
    }

    setDate(d);
  }

  function itemsForDay(ds) {
    const leave =
      requests.filter(
        (x) =>
          x.status ===
            "approved" &&
          x.start_date <= ds &&
          x.end_date >= ds
      );

    const rota =
      shifts.filter(
        (x) => x.date === ds
      );

    return { leave, rota };
  }

  function renderDay(ds) {
    const { leave, rota } =
      itemsForDay(ds);

    return (
      <div className="min-h-[140px] border border-white/5 p-2 space-y-1">
        <div className="text-xs text-gray-400">
          {ds.split("-")[2]}
        </div>

        {leave.map((x) => (
          <div
            key={x.id}
            className="text-xs px-2 py-1 rounded bg-green-600"
          >
            🌴{" "}
            {getUser(
              x.user_id
            ).name || "Unknown"}
          </div>
        ))}

        {rota.map((x) => (
          <div
            key={x.id}
            className="text-xs px-2 py-1 rounded bg-indigo-600"
          >
            🕒{" "}
            {getUser(
              x.user_id
            ).name || "Unknown"}
          </div>
        ))}
      </div>
    );
  }

  function MonthView() {
    const year =
      date.getFullYear();

    const month =
      date.getMonth();

    const lastDay =
      new Date(
        year,
        month + 1,
        0
      ).getDate();

    const days = [];

    for (
      let i = 1;
      i <= lastDay;
      i++
    ) {
      days.push(
        dateStr(
          new Date(
            year,
            month,
            i
          )
        )
      );
    }

    return (
      <div className="grid grid-cols-7 rounded-2xl overflow-hidden border border-white/10 bg-[#020617]">
        {days.map((d) => (
          <div key={d}>
            {renderDay(d)}
          </div>
        ))}
      </div>
    );
  }

  function WeekView() {
    const start =
      new Date(date);

    const day =
      start.getDay();

    start.setDate(
      start.getDate() - day
    );

    const days = [];

    for (
      let i = 0;
      i < 7;
      i++
    ) {
      const d =
        new Date(start);

      d.setDate(
        start.getDate() + i
      );

      days.push(dateStr(d));
    }

    return (
      <div className="grid grid-cols-7 rounded-2xl overflow-hidden border border-white/10 bg-[#020617]">
        {days.map((d) => (
          <div key={d}>
            {renderDay(d)}
          </div>
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold">
            Leave Manager
          </h1>

          <p className="text-sm text-gray-400">
            Holidays + rota
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() =>
              setView("list")
            }
            className={`px-4 py-2 rounded-xl ${
              view === "list"
                ? "bg-indigo-600"
                : "bg-[#0f172a]"
            }`}
          >
            <List size={16} />
          </button>

          <button
            onClick={() =>
              setView("week")
            }
            className={`px-4 py-2 rounded-xl ${
              view === "week"
                ? "bg-indigo-600"
                : "bg-[#0f172a]"
            }`}
          >
            <CalendarRange size={16} />
          </button>

          <button
            onClick={() =>
              setView("month")
            }
            className={`px-4 py-2 rounded-xl ${
              view === "month"
                ? "bg-indigo-600"
                : "bg-[#0f172a]"
            }`}
          >
            <CalendarDays size={16} />
          </button>

          <button
            onClick={() =>
              setOpenModal(true)
            }
            className="px-4 py-2 rounded-xl bg-emerald-600"
          >
            <Plus
              size={16}
              className="inline mr-2"
            />
            Add Leave
          </button>
        </div>
      </div>

      {/* NAV */}
      {view !== "list" && (
        <div className="flex justify-between items-center">
          <button
            onClick={prev}
            className="px-4 py-2 rounded-xl bg-[#0f172a]"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="font-semibold">
            {date.toLocaleDateString(
              "en-GB",
              {
                month: "long",
                year: "numeric",
              }
            )}
          </div>

          <button
            onClick={next}
            className="px-4 py-2 rounded-xl bg-[#0f172a]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* LIST */}
      {view === "list" && (
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#020617]">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="p-4 text-left">
                  Employee
                </th>
                <th className="p-4 text-left">
                  Dates
                </th>
                <th className="p-4 text-left">
                  Allowance
                </th>
                <th className="p-4 text-left">
                  Status
                </th>
                <th className="p-4 text-left">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {requests.map(
                (r) => (
                  <tr
                    key={r.id}
                    className="border-t border-white/5"
                  >
                    <td className="p-4">
                      {getUser(
                        r.user_id
                      ).name ||
                        "Unknown"}
                    </td>

                    <td className="p-4">
                      {format(
                        r.start_date
                      )}{" "}
                      →{" "}
                      {format(
                        r.end_date
                      )}
                    </td>

                    <td className="p-4">
                      {usedDays(
                        r.user_id
                      )}{" "}
                      /{" "}
                      {allowance(
                        r.user_id
                      )}
                    </td>

                    <td className="p-4 capitalize">
                      {r.status}
                    </td>

                    <td className="p-4 flex gap-2">
                      {r.status ===
                        "pending" && (
                        <>
                          <button
                            onClick={() =>
                              approve(
                                r.id
                              )
                            }
                            className="px-3 py-1 rounded bg-green-600 text-xs"
                          >
                            Accept
                          </button>

                          <button
                            onClick={() =>
                              reject(
                                r.id
                              )
                            }
                            className="px-3 py-1 rounded bg-red-600 text-xs"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      <button
                        onClick={() =>
                          remove(
                            r.id
                          )
                        }
                        className="px-3 py-1 rounded bg-gray-700"
                      >
                        <Trash2
                          size={12}
                        />
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === "week" &&
        WeekView()}

      {view === "month" &&
        MonthView()}

      {/* MODAL */}
      {openModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#020617] p-6 space-y-4">

            <h2 className="text-xl font-semibold">
              Add Leave
            </h2>

            <select
              value={
                form.user_id
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  user_id:
                    e.target
                      .value,
                })
              }
              className="w-full px-4 py-3 rounded-xl bg-[#0f172a]"
            >
              <option value="">
                Select Employee
              </option>

              {users.map(
                (u) => (
                  <option
                    key={u.id}
                    value={u.id}
                  >
                    {u.name}
                  </option>
                )
              )}
            </select>

            <input
              type="date"
              value={
                form.start_date
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  start_date:
                    e.target
                      .value,
                })
              }
              className="w-full px-4 py-3 rounded-xl bg-[#0f172a]"
            />

            <input
              type="date"
              value={
                form.end_date
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  end_date:
                    e.target
                      .value,
                })
              }
              className="w-full px-4 py-3 rounded-xl bg-[#0f172a]"
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() =>
                  setOpenModal(
                    false
                  )
                }
                className="py-3 rounded-xl bg-white/5"
              >
                Cancel
              </button>

              <button
                onClick={
                  createLeave
                }
                className="py-3 rounded-xl bg-emerald-600"
              >
                Save
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}