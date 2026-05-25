// src/pages/Schedule.jsx
// COMPLETE FINAL MERGED VERSION
// COPY / PASTE READY
// ✅ Uses your EXISTING Schedule page
// ✅ Weekly + Monthly views
// ✅ Big rota for many staff
// ✅ Holidays + shifts together
// ✅ Different colours
// ✅ Hover shows employee + hours
// ✅ Monthly wages auto update by selected month
// ✅ Quick delete single shifts
// ✅ Drag / resize shifts
// ✅ Prevent shift if on holiday
// ✅ Keep KPI cards
// ✅ Keep modern styling

import React, { useEffect, useState } from "react";
import {
  Calendar,
  momentLocalizer,
} from "react-big-calendar";

import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";

import moment from "moment";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

import {
  scheduleAPI,
  holidayAPI,
  userAPI,
} from "../services/api";

import {
  CalendarDays,
  Users,
  PoundSterling,
  Plane,
  Plus,
  RefreshCw,
} from "lucide-react";

const localizer =
  momentLocalizer(moment);

const DnDCalendar =
  withDragAndDrop(Calendar);

export default function Schedule() {
  const [events, setEvents] =
    useState([]);

  const [users, setUsers] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [date, setDate] =
    useState(new Date());

  const [showCreate, setShowCreate] =
    useState(false);

  const [form, setForm] = useState({
    user_id: "",
    start: "",
    end: "",
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      const [
        schedules,
        holidays,
        usersData,
      ] = await Promise.all([
        scheduleAPI.getAll(),
        holidayAPI.getAll(),
        userAPI.getAll(),
      ]);

      const safeUsers =
        usersData || [];

      const userMap = {};

      safeUsers.forEach((u) => {
        userMap[u.id] =
          u.name || u.email;
      });

      const shiftEvents =
        (schedules || []).map(
          (s) => ({
            id:
              "shift-" +
              s.id,
            dbId: s.id,
            type: "shift",
            user_id:
              s.user_id,
            title: `${
              userMap[
                s.user_id
              ] || "Staff"
            } (${moment(
              s.start_time
            ).format(
              "HH:mm"
            )}-${moment(
              s.end_time
            ).format(
              "HH:mm"
            )})`,
            start:
              new Date(
                s.start_time
              ),
            end:
              new Date(
                s.end_time
              ),
            hourly_rate:
              Number(
                safeUsers.find(
                  (u) =>
                    u.id ===
                    s.user_id
                )
                  ?.hourly_rate ||
                  0
              ),
          })
        );

      const holidayEvents =
        (holidays || [])
          .filter(
            (h) =>
              h.status ===
              "approved"
          )
          .map((h) => ({
            id:
              "holiday-" +
              h.id,
            dbId: h.id,
            type: "holiday",
            title: `${
              userMap[
                h.user_id
              ] ||
              h.name ||
              "Staff"
            } - HOLIDAY`,
            start:
              new Date(
                h.start_date
              ),
            end: moment(
              h.end_date
            )
              .add(
                1,
                "day"
              )
              .toDate(),
            allDay: true,
          }));

      setUsers(safeUsers);

      setEvents([
        ...shiftEvents,
        ...holidayEvents,
      ]);
    } finally {
      setLoading(false);
    }
  }

  function inMonth(d) {
    return (
      d.getMonth() ===
        date.getMonth() &&
      d.getFullYear() ===
        date.getFullYear()
    );
  }

  const monthShifts =
    events.filter(
      (e) =>
        e.type ===
          "shift" &&
        inMonth(
          e.start
        )
    );

  const holidayCount =
    events.filter(
      (e) =>
        e.type ===
          "holiday" &&
        inMonth(
          e.start
        )
    ).length;

  const monthlyWage =
    monthShifts.reduce(
      (sum, e) => {
        const hrs =
          (e.end -
            e.start) /
          3600000;

        return (
          sum +
          hrs *
            Number(
              e.hourly_rate ||
                0
            )
        );
      },
      0
    );

  function isOnHoliday(
    userId,
    start,
    end
  ) {
    return events.some(
      (e) =>
        e.type ===
          "holiday" &&
        e.title.includes(
          users.find(
            (u) =>
              u.id ===
              userId
          )?.name || ""
        ) &&
        start <
          e.end &&
        end >
          e.start
    );
  }

  async function createShift(
    e
  ) {
    e.preventDefault();

    const start =
      new Date(
        form.start
      );

    const end =
      new Date(
        form.end
      );

    if (
      isOnHoliday(
        form.user_id,
        start,
        end
      )
    ) {
      return alert(
        "Employee is on holiday"
      );
    }

    await scheduleAPI.create({
      user_id:
        form.user_id,
      date: moment(
        form.start
      ).format(
        "YYYY-MM-DD"
      ),
      start_time:
        form.start,
      end_time:
        form.end,
    });

    setShowCreate(false);
    load();
  }

  async function deleteShift(
    event
  ) {
    if (
      event.type !==
      "shift"
    )
      return;

    if (
      !window.confirm(
        "Delete shift?"
      )
    )
      return;

    await scheduleAPI.delete(
      event.dbId
    );

    load();
  }

  async function moveShift({
    event,
    start,
    end,
  }) {
    if (
      event.type !==
      "shift"
    )
      return;

    if (
      isOnHoliday(
        event.user_id,
        start,
        end
      )
    ) {
      return alert(
        "Cannot move onto holiday"
      );
    }

    await scheduleAPI.update(
      event.dbId,
      {
        start_time:
          start,
        end_time: end,
      }
    );

    load();
  }

  function styleEvent(
    event
  ) {
    if (
      event.type ===
      "holiday"
    ) {
      return {
        style: {
          backgroundColor:
            "#16a34a",
          borderRadius:
            "8px",
          border:
            "none",
          fontSize:
            "12px",
        },
      };
    }

    return {
      style: {
        backgroundColor:
          "#4f46e5",
        borderRadius:
          "8px",
        border:
          "none",
        fontSize:
          "12px",
        cursor:
          "pointer",
      },
    };
  }

  if (loading) {
    return (
      <div className="text-gray-400">
        Loading schedule...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center flex-wrap gap-4">

        <div>
          <h1 className="text-3xl font-semibold">
            Schedule
          </h1>

          <p className="text-sm text-gray-400">
            Company rota planner
          </p>
        </div>

        <div className="flex gap-2">

          <button
            onClick={load}
            className="px-4 py-2 rounded-xl bg-white/5"
          >
            <RefreshCw
              size={16}
            />
          </button>

          <button
            onClick={() =>
              setShowCreate(
                true
              )
            }
            className="px-4 py-2 rounded-xl bg-indigo-600"
          >
            <Plus
              size={16}
            />
          </button>

        </div>

      </div>

      {/* KPI */}
      <div className="grid md:grid-cols-4 gap-4">

        <Card
          title="Staff"
          value={users.length}
          icon={
            <Users
              size={16}
            />
          }
        />

        <Card
          title="Month Shifts"
          value={
            monthShifts.length
          }
          icon={
            <CalendarDays
              size={16}
            />
          }
        />

        <Card
          title="Holiday"
          value={
            holidayCount
          }
          icon={
            <Plane
              size={16}
            />
          }
        />

        <Card
          title="Monthly Wage"
          value={`£${monthlyWage.toFixed(
            2
          )}`}
          icon={
            <PoundSterling
              size={16}
            />
          }
        />

      </div>

      {/* CALENDAR */}
      <div className="rounded-2xl border border-white/10 bg-[#020617] p-4">

        <DnDCalendar
          localizer={
            localizer
          }
          events={events}
          startAccessor="start"
          endAccessor="end"
          selectable
          popup
          resizable
          defaultView="week"
          views={[
            "month",
            "week",
            "day",
            "agenda",
          ]}
          style={{
            height:
              "78vh",
          }}
          date={date}
          onNavigate={(
            d
          ) =>
            setDate(
              d
            )
          }
          onDoubleClickEvent={
            deleteShift
          }
          onEventDrop={
            moveShift
          }
          onEventResize={
            moveShift
          }
          eventPropGetter={
            styleEvent
          }
          tooltipAccessor={(
            event
          ) =>
            event.title
          }
        />

      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">

          <div className="w-full max-w-md bg-[#020617] border border-white/10 rounded-2xl p-6">

            <h2 className="text-lg font-semibold mb-4">
              Add Shift
            </h2>

            <form
              onSubmit={
                createShift
              }
              className="space-y-4"
            >

              <select
                required
                value={
                  form.user_id
                }
                onChange={(
                  e
                ) =>
                  setForm({
                    ...form,
                    user_id:
                      e
                        .target
                        .value,
                  })
                }
                className="w-full px-4 py-3 rounded-xl bg-white/5"
              >
                <option value="">
                  Select Staff
                </option>

                {users.map(
                  (u) => (
                    <option
                      key={
                        u.id
                      }
                      value={
                        u.id
                      }
                    >
                      {u.name}
                    </option>
                  )
                )}

              </select>

              <input
                type="datetime-local"
                required
                value={
                  form.start
                }
                onChange={(
                  e
                ) =>
                  setForm({
                    ...form,
                    start:
                      e
                        .target
                        .value,
                  })
                }
                className="w-full px-4 py-3 rounded-xl bg-white/5"
              />

              <input
                type="datetime-local"
                required
                value={
                  form.end
                }
                onChange={(
                  e
                ) =>
                  setForm({
                    ...form,
                    end:
                      e
                        .target
                        .value,
                  })
                }
                className="w-full px-4 py-3 rounded-xl bg-white/5"
              />

              <button className="w-full py-3 rounded-xl bg-indigo-600">
                Save Shift
              </button>

              <button
                type="button"
                onClick={() =>
                  setShowCreate(
                    false
                  )
                }
                className="w-full py-3 rounded-xl bg-white/5"
              >
                Cancel
              </button>

            </form>

          </div>

        </div>
      )}

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