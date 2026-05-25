// src/pages/AdminDashboard.js
// FULL FIXED VERSION
// Based on the file you sent
// Updated for your current api.js methods

import React, {
  useState,
  useEffect,
} from "react";

import {
  shiftAPI,
  taskAPI,
  locationAPI,
} from "../services/api";

import {
  Users,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Camera,
  CheckCircle,
  X,
} from "lucide-react";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] =
    useState("employees");

  const [activeShifts, setActiveShifts] =
    useState([]);

  const [locations, setLocations] =
    useState([]);

  const [tasks, setTasks] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [showTaskModal, setShowTaskModal] =
    useState(false);

  const [
    showLocationModal,
    setShowLocationModal,
  ] = useState(false);

  const [editingItem, setEditingItem] =
    useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [
        shifts,
        locs,
        taskRows,
      ] = await Promise.all([
        shiftAPI.getActiveAll(),
        locationAPI.getAll(),
        taskAPI.getAll(),
      ]);

      setActiveShifts(
        Array.isArray(shifts)
          ? shifts
          : []
      );

      setLocations(
        Array.isArray(locs)
          ? locs
          : []
      );

      setTasks(
        Array.isArray(taskRows)
          ? taskRows
          : []
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveTask(data) {
    try {
      if (editingItem) {
        await taskAPI.update(
          editingItem.id,
          data
        );
      } else {
        await taskAPI.create({
          ...data,
          status: "todo",
          completed: false,
        });
      }

      setShowTaskModal(false);
      setEditingItem(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  async function saveLocation(data) {
    try {
      if (editingItem) {
        await locationAPI.update(
          editingItem.id,
          data
        );
      } else {
        await locationAPI.create(data);
      }

      setShowLocationModal(false);
      setEditingItem(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  async function removeLocation(id) {
    if (
      !window.confirm(
        "Delete location?"
      )
    )
      return;

    await locationAPI.delete(id);
    loadData();
  }

  if (loading) {
    return (
      <div className="text-gray-400">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* TITLE */}
      <div>
        <h1 className="text-3xl font-semibold">
          Admin Dashboard
        </h1>

        <p className="text-sm text-gray-400">
          Business control center
        </p>
      </div>

      {/* STATS */}
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          title="Clocked In"
          value={activeShifts.length}
          icon={
            <Users size={18} />
          }
        />

        <StatCard
          title="Locations"
          value={locations.length}
          icon={
            <MapPin size={18} />
          }
        />

        <StatCard
          title="Tasks"
          value={tasks.length}
          icon={
            <CheckCircle
              size={18}
            />
          }
        />

        <StatCard
          title="Open Tasks"
          value={
            tasks.filter(
              (x) =>
                x.status !==
                "done"
            ).length
          }
          icon={
            <Camera size={18} />
          }
        />
      </div>

      {/* TABS */}
      <div className="flex gap-2 flex-wrap">
        {[
          "employees",
          "locations",
          "tasks",
        ].map((tab) => (
          <button
            key={tab}
            onClick={() =>
              setActiveTab(tab)
            }
            className={`px-4 py-2 rounded-xl capitalize ${
              activeTab === tab
                ? "bg-indigo-600"
                : "bg-white/5"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="rounded-2xl border border-white/10 bg-[#020617] p-6">
        {activeTab ===
          "employees" && (
          <div className="space-y-3">
            {activeShifts.length ===
              0 && (
              <p className="text-gray-400">
                No staff clocked in
              </p>
            )}

            {activeShifts.map(
              (row) => (
                <div
                  key={row.id}
                  className="border border-white/10 rounded-xl p-4"
                >
                  <p className="font-medium">
                    {row.users
                      ?.name ||
                      row.users
                        ?.email ||
                      "Staff"}
                  </p>

                  <p className="text-sm text-gray-400 mt-1">
                    {new Date(
                      row.clock_in_time
                    ).toLocaleString()}
                  </p>
                </div>
              )
            )}
          </div>
        )}

        {activeTab ===
          "locations" && (
          <div className="space-y-3">
            <button
              onClick={() => {
                setEditingItem(
                  null
                );
                setShowLocationModal(
                  true
                );
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 flex items-center gap-2"
            >
              <Plus size={16} />
              Add Location
            </button>

            {locations.map(
              (item) => (
                <div
                  key={item.id}
                  className="border border-white/10 rounded-xl p-4 flex justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {item.name}
                    </p>

                    <p className="text-sm text-gray-400">
                      {
                        item.address
                      }
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingItem(
                          item
                        );
                        setShowLocationModal(
                          true
                        );
                      }}
                    >
                      <Edit2
                        size={
                          16
                        }
                      />
                    </button>

                    <button
                      onClick={() =>
                        removeLocation(
                          item.id
                        )
                      }
                    >
                      <Trash2
                        size={
                          16
                        }
                      />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {activeTab ===
          "tasks" && (
          <div className="space-y-3">
            <button
              onClick={() => {
                setEditingItem(
                  null
                );
                setShowTaskModal(
                  true
                );
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 flex items-center gap-2"
            >
              <Plus size={16} />
              Add Task
            </button>

            {tasks.map(
              (task) => (
                <div
                  key={task.id}
                  className="border border-white/10 rounded-xl p-4"
                >
                  <p className="font-medium">
                    {task.title}
                  </p>

                  <p className="text-sm text-gray-400 mt-1">
                    {task.description ||
                      "No description"}
                  </p>

                  <p className="text-xs mt-2 text-indigo-400">
                    {task.status ||
                      "todo"}
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* MODALS */}
      {showTaskModal && (
        <TaskModal
          task={editingItem}
          locations={locations}
          onClose={() => {
            setShowTaskModal(
              false
            );
            setEditingItem(
              null
            );
          }}
          onSave={saveTask}
        />
      )}

      {showLocationModal && (
        <LocationModal
          location={editingItem}
          onClose={() => {
            setShowLocationModal(
              false
            );
            setEditingItem(
              null
            );
          }}
          onSave={saveLocation}
        />
      )}
    </div>
  );
}

/* ================================================= */

function TaskModal({
  task,
  locations,
  onClose,
  onSave,
}) {
  const [form, setForm] =
    useState({
      title:
        task?.title || "",
      description:
        task?.description ||
        "",
      location_id:
        task?.location_id ||
        "",
    });

  function submit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <Modal
      title={
        task
          ? "Edit Task"
          : "Create Task"
      }
      onClose={onClose}
    >
      <form
        onSubmit={submit}
        className="space-y-4"
      >
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) =>
            setForm({
              ...form,
              title:
                e.target
                  .value,
            })
          }
          className="input"
          required
        />

        <textarea
          placeholder="Description"
          value={
            form.description
          }
          onChange={(e) =>
            setForm({
              ...form,
              description:
                e.target
                  .value,
            })
          }
          className="input"
        />

        <select
          value={
            form.location_id
          }
          onChange={(e) =>
            setForm({
              ...form,
              location_id:
                e.target
                  .value,
            })
          }
          className="input"
        >
          <option value="">
            Select Location
          </option>

          {locations.map(
            (l) => (
              <option
                key={l.id}
                value={l.id}
              >
                {l.name}
              </option>
            )
          )}
        </select>

        <button className="btn">
          Save
        </button>
      </form>
    </Modal>
  );
}

function LocationModal({
  location,
  onClose,
  onSave,
}) {
  const [form, setForm] =
    useState({
      name:
        location?.name ||
        "",
      address:
        location?.address ||
        "",
    });

  function submit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <Modal
      title={
        location
          ? "Edit Location"
          : "Create Location"
      }
      onClose={onClose}
    >
      <form
        onSubmit={submit}
        className="space-y-4"
      >
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) =>
            setForm({
              ...form,
              name:
                e.target
                  .value,
            })
          }
          className="input"
        />

        <textarea
          placeholder="Address"
          value={
            form.address
          }
          onChange={(e) =>
            setForm({
              ...form,
              address:
                e.target
                  .value,
            })
          }
          className="input"
        />

        <button className="btn">
          Save
        </button>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-[#020617] border border-white/10 rounded-2xl p-6 w-full max-w-lg">
        <div className="flex justify-between mb-5">
          <h2 className="font-semibold">
            {title}
          </h2>

          <button
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#020617] p-5">
      <div className="flex justify-between">
        <p className="text-sm text-gray-400">
          {title}
        </p>

        <div className="text-indigo-400">
          {icon}
        </div>
      </div>

      <h3 className="text-2xl font-semibold mt-3">
        {value}
      </h3>
    </div>
  );
}