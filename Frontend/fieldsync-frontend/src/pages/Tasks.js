// src/pages/Tasks.jsx
// FULL MERGE FINAL FIX
// ✅ Your original V4 kept
// ✅ Locations dropdown readable
// ✅ Route planner clear
// ✅ Better select styling
// ✅ Production ready

import { useEffect, useMemo, useState } from "react";
import {
  taskAPI,
  userAPI,
  locationAPI,
} from "../services/api";

import { useAuth } from "../hooks/useAuth";

import {
  Plus,
  Loader2,
  Search,
  X,
  Trash2,
  CheckCircle2,
  Route,
  Users,
} from "lucide-react";

export default function Tasks() {
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  const canManage =
    user?.role === "admin" ||
    user?.role === "manager";

  const [form, setForm] = useState({
    title: "",
    description: "",
    assigned_users: [],
    route_locations: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [
        taskRows,
        userRows,
        locationRows,
      ] = await Promise.all([
        taskAPI.getAll(),
        userAPI.getAll(),
        locationAPI.getAll(),
      ]);

      setTasks(taskRows || []);
      setUsers(userRows || []);
      setLocations(locationRows || []);
    } finally {
      setLoading(false);
    }
  }

  async function createTask(e) {
    e.preventDefault();

    try {
      setSaving(true);

      await taskAPI.create({
        title: form.title,
        description: form.description,
        assigned_users: form.assigned_users,
        route_locations: form.route_locations,
        status: "todo",
        completed: false,
      });

      setShowModal(false);

      setForm({
        title: "",
        description: "",
        assigned_users: [],
        route_locations: [],
      });

      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function completeTask(task) {
    await taskAPI.update(task.id, {
      completed: true,
      status: "done",
    });

    loadData();
  }

  async function deleteTask(id) {
    if (!window.confirm("Delete task?")) return;

    await taskAPI.delete(id);
    loadData();
  }

  function toggleUser(id) {
    const exists =
      form.assigned_users.includes(id);

    setForm({
      ...form,
      assigned_users: exists
        ? form.assigned_users.filter(
            (x) => x !== id
          )
        : [...form.assigned_users, id],
    });
  }

  function addStop(id) {
    if (!id) return;

    setForm({
      ...form,
      route_locations: [
        ...form.route_locations,
        id,
      ],
    });
  }

  function removeStop(index) {
    setForm({
      ...form,
      route_locations:
        form.route_locations.filter(
          (_, i) => i !== index
        ),
    });
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return tasks.filter((t) =>
      `${t.title} ${t.description}`
        .toLowerCase()
        .includes(q)
    );
  }, [tasks, search]);

  if (loading) {
    return (
      <div className="flex gap-2 text-gray-300">
        <Loader2
          size={16}
          className="animate-spin"
        />
        Loading tasks...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center flex-wrap gap-4">

        <div>
          <h1 className="text-2xl font-semibold text-white">
            Tasks & Route Planner
          </h1>

          <p className="text-gray-400 text-sm">
            Jobs, staff assignment &
            multi-stop routes
          </p>
        </div>

        {canManage && (
          <button
            onClick={() =>
              setShowModal(true)
            }
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex gap-2 items-center"
          >
            <Plus size={16} />
            New Task
          </button>
        )}

      </div>

      {/* SEARCH */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-4 top-4 text-gray-500"
        />

        <input
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          placeholder="Search tasks..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#020617] border border-white/10 text-white"
        />
      </div>

      {/* TASK LIST */}
      <div className="grid gap-4">

        {filtered.map((task) => (
          <div
            key={task.id}
            className="rounded-2xl bg-[#020617] border border-white/10 p-5 space-y-4"
          >

            <div className="flex justify-between">

              <div>
                <h2 className="text-white font-semibold text-lg">
                  {task.title}
                </h2>

                <p className="text-gray-300 text-sm mt-1">
                  {task.description}
                </p>
              </div>

              {task.completed && (
                <CheckCircle2 className="text-green-500" />
              )}

            </div>

            <div className="text-sm text-indigo-300 flex gap-2 items-center">
              <Users size={14} />
              {task.assigned_users?.length || 0}
              {" "}Staff Assigned
            </div>

            {task.route_locations?.length > 0 && (
              <div className="space-y-2">

                <div className="text-sm text-orange-300 flex gap-2 items-center">
                  <Route size={14} />
                  Planned Route
                </div>

                {task.route_locations.map(
                  (id, i) => {
                    const loc =
                      locations.find(
                        (x) =>
                          String(x.id) ===
                          String(id)
                      );

                    return (
                      <div
                        key={i}
                        className="text-sm text-gray-200 bg-white/5 rounded-lg px-3 py-2"
                      >
                        {i + 1}.{" "}
                        {loc?.name ||
                          "Location"}
                      </div>
                    );
                  }
                )}

              </div>
            )}

            <div className="flex gap-2">

              {!task.completed && (
                <button
                  onClick={() =>
                    completeTask(task)
                  }
                  className="px-4 py-2 rounded-lg bg-green-600"
                >
                  Complete
                </button>
              )}

              {canManage && (
                <button
                  onClick={() =>
                    deleteTask(task.id)
                  }
                  className="px-4 py-2 rounded-lg bg-red-600 flex gap-2 items-center"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}

            </div>

          </div>
        ))}

      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">

          <div className="w-full max-w-xl rounded-2xl bg-[#020617] border border-white/10 p-6 space-y-5">

            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">
                New Task & Route Planner
              </h2>

              <button
                onClick={() =>
                  setShowModal(false)
                }
              >
                <X />
              </button>
            </div>

            <form
              onSubmit={createTask}
              className="space-y-4"
            >

              <input
                required
                placeholder="Task title"
                value={form.title}
                onChange={(e) =>
                  setForm({
                    ...form,
                    title:
                      e.target.value,
                  })
                }
                className="w-full px-4 py-3 rounded-xl bg-white/5 text-white"
              />

              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description:
                      e.target.value,
                  })
                }
                className="w-full px-4 py-3 rounded-xl bg-white/5 text-white"
              />

              {/* USERS */}
              <div>
                <p className="text-white mb-2">
                  Assign Employees
                </p>

                <div className="grid gap-2 max-h-44 overflow-y-auto">

                  {users.map((u) => (
                    <label
                      key={u.id}
                      className="flex gap-3 items-center px-3 py-2 rounded-lg bg-white/5 text-white"
                    >
                      <input
                        type="checkbox"
                        checked={form.assigned_users.includes(
                          u.id
                        )}
                        onChange={() =>
                          toggleUser(
                            u.id
                          )
                        }
                      />

                      {u.name ||
                        u.email}
                    </label>
                  ))}

                </div>
              </div>

              {/* ROUTE */}
              <div>
                <p className="text-white mb-2">
                  Route Planner
                </p>

                <select
                  onChange={(e) =>
                    addStop(
                      e.target.value
                    )
                  }
                  className="w-full px-4 py-3 rounded-xl bg-[#0f172a] text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option
                    value=""
                    className="bg-[#0f172a] text-white"
                  >
                    Add location stop
                  </option>

                  {locations.map((l) => (
                    <option
                      key={l.id}
                      value={l.id}
                      className="bg-[#0f172a] text-white"
                    >
                      {l.name}
                    </option>
                  ))}
                </select>

                <div className="mt-3 space-y-2">

                  {form.route_locations.map(
                    (id, i) => {
                      const loc =
                        locations.find(
                          (x) =>
                            String(
                              x.id
                            ) ===
                            String(id)
                        );

                      return (
                        <div
                          key={i}
                          className="flex justify-between bg-white/5 px-3 py-2 rounded-lg text-white"
                        >
                          <span>
                            {i + 1}.{" "}
                            {loc?.name}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              removeStop(
                                i
                              )
                            }
                          >
                            X
                          </button>
                        </div>
                      );
                    }
                  )}

                </div>
              </div>

              <button
                disabled={saving}
                className="w-full py-3 rounded-xl bg-indigo-600"
              >
                {saving
                  ? "Saving..."
                  : "Create Task"}
              </button>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}