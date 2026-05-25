import React, { useEffect, useMemo, useState } from "react";
import moment from "moment";
import { scheduleAPI, userAPI } from "../services/api";
import AddShiftModal from "../components/AddShiftModal";

export default function Schedule() {
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("week");
  const [date, setDate] = useState(new Date());

  const [editing, setEditing] = useState(null);
  const [dayModal, setDayModal] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [conflict, setConflict] = useState(null);

  const [form, setForm] = useState({
    start: "09:00",
    end: "17:00",
  });

  const holidays = [
    { date: "2026-05-08", name: "Bank Holiday" },
    { date: "2026-05-12", name: "Maintenance Day" },
  ];

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [u, s] = await Promise.all([
      userAPI.getAll(),
      scheduleAPI.getAll(),
    ]);
    setUsers(u || []);
    setShifts(s || []);
    setLoading(false);
  }

  function isHoliday(dateStr) {
    return holidays.find(h => moment(h.date).format("YYYY-MM-DD") === dateStr);
  }

  function sortShifts(list) {
    return [...list].sort(
      (a, b) => new Date(a.start_time) - new Date(b.start_time)
    );
  }

  async function createShift(data, override = false) {
    const holiday = isHoliday(data.date);

    if (holiday && !override) {
      setConflict({ type: "holiday", data, holiday });
      return;
    }

    const overlap = shifts.find(
      s =>
        s.user_id === data.user_id &&
        s.date === data.date &&
        new Date(data.start_time) < new Date(s.end_time) &&
        new Date(data.end_time) > new Date(s.start_time)
    );

    if (overlap && !override) {
      const user = users.find(u => u.id === data.user_id);

      setConflict({
        type: "overlap",
        user: user?.name,
        existing: overlap,
        attempted: data,
      });
      return;
    }

    await scheduleAPI.create(data);
    load();
  }

  async function updateShift(id, data) {
    await scheduleAPI.update(id, data);
    load();
  }

  async function deleteShift(id) {
    await scheduleAPI.delete(id);
    load();
  }

  function prev() {
    setDate(moment(date).subtract(1, view === "month" ? "month" : "week").toDate());
  }

  function next() {
    setDate(moment(date).add(1, view === "month" ? "month" : "week").toDate());
  }

  function formatName(name) {
    if (!name) return "";
    const [first, last] = name.split(" ");
    return last ? `${first} ${last[0]}` : first;
  }

  const days = useMemo(() => {
    const start = moment(date).startOf("isoWeek");
    return Array.from({ length: 7 }).map((_, i) =>
      start.clone().add(i, "days")
    );
  }, [date]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-400">
        Loading schedule...
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0B1220] text-white">

      {/* HEADER */}
      <div className="flex justify-between items-center px-6 py-4 bg-[#111827]/80 backdrop-blur border-b border-white/10">
        <div className="text-lg font-semibold">
          {view === "week" &&
            `${moment(date).startOf("isoWeek").format("DD MMM")} - ${moment(date).endOf("isoWeek").format("DD MMM YYYY")}`}
          {view === "month" && moment(date).format("MMMM YYYY")}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setView("week")} className="btn-secondary">Week</button>
          <button onClick={() => setView("month")} className="btn-secondary">Month</button>

          <button onClick={prev} className="btn-secondary">←</button>
          <button onClick={() => setDate(new Date())} className="btn-secondary">Today</button>
          <button onClick={next} className="btn-secondary">→</button>

          <button onClick={() => setShowAdd(true)} className="btn-primary">
            + Shift
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-auto p-6">

        {/* WEEK */}
        {view === "week" && (
          <div className="border border-white/10 rounded-xl overflow-hidden">

            <div className="grid grid-cols-8 bg-[#020617] border-b border-white/10">
              <div className="p-2 text-xs text-gray-400">Employee</div>
              {days.map((d, i) => (
                <div key={i} className="p-2 text-xs text-center text-gray-400">
                  {d.format("ddd DD")}
                </div>
              ))}
            </div>

            {users.length === 0 && (
              <div className="p-6 text-center text-gray-400">
                No staff found
              </div>
            )}

            {users.map(user => (
              <div key={user.id} className="grid grid-cols-8 border-b border-white/10">

                <div className="p-3 text-sm">{user.name}</div>

                {days.map((day, i) => {
                  const ds = day.format("YYYY-MM-DD");
                  const holiday = isHoliday(ds);

                  const dayShifts = sortShifts(
                    shifts.filter(s => s.date === ds && s.user_id === user.id)
                  );

                  return (
                    <div
                      key={i}
                      onClick={() => setDayModal(ds)}
                      className={`p-2 min-h-[72px] cursor-pointer hover:bg-white/5 ${
                        holiday ? "bg-red-500/10" : ""
                      }`}
                    >
                      {holiday && (
                        <div className="text-[10px] text-red-400">
                          {holiday.name}
                        </div>
                      )}

                      {dayShifts.map(s => (
                        <div
                          key={s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(s);
                          }}
                          className="bg-indigo-600 text-xs px-2 py-1 rounded mt-1"
                        >
                          {formatName(user.name)}
                          <div className="text-[10px]">
                            {moment(s.start_time).format("HH:mm")} - {moment(s.end_time).format("HH:mm")}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}

              </div>
            ))}

          </div>
        )}

        {/* MONTH */}
        {view === "month" && (
          <div className="grid grid-cols-7 gap-3">
            {Array.from({ length: 42 }).map((_, i) => {
              const start = moment(date).startOf("month").startOf("isoWeek");
              const d = start.clone().add(i, "days");
              const ds = d.format("YYYY-MM-DD");
              const holiday = isHoliday(ds);

              const dayShifts = sortShifts(
                shifts.filter(s => s.date === ds)
              );

              return (
                <div
                  key={i}
                  onClick={() => setDayModal(ds)}
                  className="border p-3 rounded-xl hover:bg-white/5 cursor-pointer"
                >
                  <div className="text-xs text-gray-400">{d.format("DD")}</div>

                  {holiday && (
                    <div className="text-[10px] text-red-400">
                      {holiday.name}
                    </div>
                  )}

                  {dayShifts.slice(0, 3).map(s => {
                    const user = users.find(u => u.id === s.user_id);
                    return (
                      <div key={s.id} className="text-[10px] bg-indigo-600 mt-1 px-1 rounded">
                        {formatName(user?.name)}
                      </div>
                    );
                  })}

                  {dayShifts.length > 3 && (
                    <div className="text-[10px] text-gray-400 mt-1">
                      +{dayShifts.length - 3} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ADD MODAL */}
      {showAdd && (
        <AddShiftModal
          users={users}
          form={form}
          setForm={setForm}
          createShift={createShift}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* DAY MODAL */}
      {dayModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-[#020617] p-6 w-[420px] max-h-[80vh] overflow-y-auto rounded-xl">
            <div className="text-lg mb-3">
              {moment(dayModal).format("DD MMM YYYY")}
            </div>

            {sortShifts(shifts.filter(s => s.date === dayModal)).map(s => {
              const user = users.find(u => u.id === s.user_id);

              return (
                <div key={s.id} className="border p-2 rounded mb-2">
                  {user?.name}
                  <div className="text-xs text-gray-400">
                    {moment(s.start_time).format("HH:mm")} - {moment(s.end_time).format("HH:mm")}
                  </div>
                </div>
              );
            })}

            <button onClick={() => setDayModal(null)} className="btn-secondary w-full">
              Close
            </button>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-[#020617] p-6 rounded-xl space-y-3 w-[320px]">

            <input
              type="time"
              defaultValue={moment(editing.start_time).format("HH:mm")}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  start_time: `${editing.date}T${e.target.value}:00`,
                })
              }
            />

            <input
              type="time"
              defaultValue={moment(editing.end_time).format("HH:mm")}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  end_time: `${editing.date}T${e.target.value}:00`,
                })
              }
            />

            <button onClick={() => { updateShift(editing.id, editing); setEditing(null); }}>
              Save
            </button>

            <button onClick={() => { deleteShift(editing.id); setEditing(null); }}>
              Delete
            </button>

            <button onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* CONFLICT MODAL WITH OVERRIDE */}
      {conflict && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-[#020617] p-6 rounded-xl w-[360px] space-y-3 border border-red-500/30">

            <div className="text-red-400 font-semibold">Conflict</div>

            {conflict.type === "holiday" && (
              <div>Holiday: {conflict.holiday.name}</div>
            )}

            {conflict.type === "overlap" && (
              <>
                <div>{conflict.user} already working:</div>
                <div className="text-xs text-gray-400">
                  {moment(conflict.existing.start_time).format("HH:mm")} - {moment(conflict.existing.end_time).format("HH:mm")}
                </div>
              </>
            )}

            <button
              onClick={() => {
                createShift(conflict.attempted, true);
                setConflict(null);
              }}
              className="bg-yellow-500 w-full p-2 rounded"
            >
              Override Anyway
            </button>

            <button onClick={() => setConflict(null)} className="btn-secondary w-full">
              Cancel
            </button>

          </div>
        </div>
      )}

    </div>
  );
}