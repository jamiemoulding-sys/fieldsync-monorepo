import React, { useState } from "react";
import moment from "moment";

export default function AddShiftModal({
  users,
  form,
  setForm,
  createShift,
  onClose,
}) {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [bulkDays, setBulkDays] = useState({
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: false,
    sun: false,
  });

  const toggleUser = (id) => {
    setSelectedUsers((prev) =>
      prev.includes(id)
        ? prev.filter((u) => u !== id)
        : [...prev, id]
    );
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map((u) => u.id));
    }
  };

  const handleBulkCreate = async () => {
    if (!form.startDate || !form.endDate) {
      alert("Select a date range");
      return;
    }

    if (selectedUsers.length === 0) {
      alert("Select at least one user");
      return;
    }

    setLoading(true);

    let current = moment(form.startDate);
    const end = moment(form.endDate);

    const promises = [];

    while (current.isSameOrBefore(end)) {
      const key = current.format("ddd").toLowerCase();

      if (bulkDays[key]) {
        selectedUsers.forEach((userId) => {
          promises.push(
            createShift({
              user_id: userId,
              date: current.format("YYYY-MM-DD"),
              start_time: `${current.format("YYYY-MM-DD")}T${form.start}:00`,
              end_time: `${current.format("YYYY-MM-DD")}T${form.end}:00`,
            })
          );
        });
      }

      current.add(1, "day");
    }

    await Promise.all(promises);

setLoading(false);
onClose();

// 🔥 ADD THIS
window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#020617] w-[420px] rounded-2xl p-6 space-y-6 border border-white/10 shadow-2xl animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center">
          <div>
            <div className="text-lg font-semibold">Create Shifts</div>
            <div className="text-xs text-gray-400">
              Bulk scheduling made easy
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg"
          >
            ✕
          </button>
        </div>

        {/* USERS */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs text-gray-400">Staff</div>
            <button
              onClick={toggleAllUsers}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              {selectedUsers.length === users.length
                ? "Clear all"
                : "Select all"}
            </button>
          </div>

          <div className="max-h-[150px] overflow-y-auto border border-white/10 rounded-lg p-2 space-y-1">
            {users.map((u) => (
              <div
                key={u.id}
                onClick={() => toggleUser(u.id)}
                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition ${
                  selectedUsers.includes(u.id)
                    ? "bg-indigo-600/20 border border-indigo-500"
                    : "hover:bg-white/5"
                }`}
              >
                <span className="text-sm">{u.name}</span>
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(u.id)}
                  readOnly
                  className="accent-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* DAYS */}
        <div>
          <div className="text-xs text-gray-400 mb-2">Repeat on</div>
          <div className="grid grid-cols-7 gap-2">
            {Object.keys(bulkDays).map((day) => (
              <button
                key={day}
                onClick={() =>
                  setBulkDays({ ...bulkDays, [day]: !bulkDays[day] })
                }
                className={`py-2 rounded-lg text-xs font-medium transition ${
                  bulkDays[day]
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-[#111827] text-gray-400 hover:bg-white/10"
                }`}
              >
                {day.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* DATE RANGE */}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            className="p-2 rounded-lg bg-[#020617] border border-white/10 text-white focus:ring-2 focus:ring-indigo-500"
            onChange={(e) =>
              setForm({ ...form, startDate: e.target.value })
            }
          />
          <input
            type="date"
            className="p-2 rounded-lg bg-[#020617] border border-white/10 text-white focus:ring-2 focus:ring-indigo-500"
            onChange={(e) =>
              setForm({ ...form, endDate: e.target.value })
            }
          />
        </div>

        {/* TIME */}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="time"
            value={form.start}
            className="p-2 rounded-lg bg-[#020617] border border-white/10 text-white"
            onChange={(e) =>
              setForm({ ...form, start: e.target.value })
            }
          />
          <input
            type="time"
            value={form.end}
            className="p-2 rounded-lg bg-[#020617] border border-white/10 text-white"
            onChange={(e) =>
              setForm({ ...form, end: e.target.value })
            }
          />
        </div>

        {/* ACTIONS */}
        <div className="space-y-2 pt-2">
          <button
            onClick={handleBulkCreate}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 p-2 rounded-lg font-medium transition disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Shifts"}
          </button>

          <button
            onClick={onClose}
            className="w-full p-2 rounded-lg border border-white/10 hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}