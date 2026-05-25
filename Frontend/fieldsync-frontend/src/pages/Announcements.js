// src/pages/Announcements.jsx
// ELITE UPGRADE VERSION
// FULL COPY / PASTE FILE

import { useEffect, useMemo, useState } from "react";
import { announcementAPI } from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone,
  Plus,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Info,
  Loader2,
  RefreshCw,
  Search,
  X,
  CheckCircle2,
  Filter,
  Clock3,
} from "lucide-react";

export default function Announcements() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    title: "",
    message: "",
    priority: "normal",
  });

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!success && !error) return;

    const t = setTimeout(() => {
      setSuccess("");
      setError("");
    }, 3000);

    return () => clearTimeout(t);
  }, [success, error]);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const data = await announcementAPI.getAll();

      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setItems([]);
      setError("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }

  async function createItem(e) {
    e?.preventDefault();

    if (!form.title.trim() || !form.message.trim()) {
      return setError("Fill all fields");
    }

    try {
      setSaving(true);
      setError("");

      await announcementAPI.create({
        title: form.title.trim(),
        message: form.message.trim(),
        priority: form.priority,
      });

      setForm({
        title: "",
        message: "",
        priority: "normal",
      });

      setShowModal(false);
      setSuccess("Announcement sent");
      await load();
    } catch (err) {
      console.error(err);
      setError("Failed to send announcement");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id) {
    if (!window.confirm("Delete announcement?")) return;

    try {
      await announcementAPI.delete(id);
      setSuccess("Announcement deleted");
      await load();
    } catch (err) {
      console.error(err);
      setError("Delete failed");
    }
  }

  const filtered = useMemo(() => {
    let rows = [...items];

    if (filter !== "all") {
      rows = rows.filter((x) => x.priority === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();

      rows = rows.filter(
        (x) =>
          x.title?.toLowerCase().includes(q) ||
          x.message?.toLowerCase().includes(q)
      );
    }

    return rows;
  }, [items, search, filter]);

  const critical = items.filter(
    (x) => x.priority === "critical"
  ).length;

  const warning = items.filter(
    (x) => x.priority === "warning"
  ).length;

  function cardStyle(priority) {
    if (priority === "critical") {
      return "border-red-500/30 bg-red-500/10";
    }

    if (priority === "warning") {
      return "border-yellow-500/30 bg-yellow-500/10";
    }

    return "border-white/10 bg-[#020617]";
  }

  function icon(priority) {
    if (priority === "critical") {
      return (
        <ShieldAlert
          size={16}
          className="text-red-400"
        />
      );
    }

    if (priority === "warning") {
      return (
        <AlertTriangle
          size={16}
          className="text-yellow-400"
        />
      );
    }

    return (
      <Info
        size={16}
        className="text-indigo-400"
      />
    );
  }

  if (loading) {
    return (
      <div className="text-gray-400 flex items-center gap-2">
        <Loader2
          size={16}
          className="animate-spin"
        />
        Loading announcements...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Megaphone size={22} />
            Announcements
          </h1>

          <p className="text-sm text-gray-400 mt-1">
            Broadcast updates to staff
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 flex items-center gap-2 text-sm"
          >
            <RefreshCw size={15} />
            Refresh
          </button>

          <button
            onClick={() =>
              setShowModal(true)
            }
            className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl text-sm flex items-center gap-2"
          >
            <Plus size={15} />
            New
          </button>
        </div>
      </div>

      {/* BANNERS */}
      {error && (
        <Banner red text={error} />
      )}

      {success && (
        <Banner green text={success} />
      )}

      {/* KPI */}
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          title="Total"
          value={items.length}
        />

        <StatCard
          title="Critical"
          value={critical}
        />

        <StatCard
          title="Warnings"
          value={warning}
        />

        <StatCard
          title="Visible"
          value={filtered.length}
        />
      </div>

      {/* FILTERS */}
      <div className="grid md:grid-cols-2 gap-3">
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
            placeholder="Search announcements..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#020617] border border-white/10"
          />
        </div>

        <div className="relative">
          <Filter
            size={16}
            className="absolute left-4 top-4 text-gray-500"
          />

          <select
            value={filter}
            onChange={(e) =>
              setFilter(
                e.target.value
              )
            }
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#020617] border border-white/10"
          >
            <option value="all">
              All Priorities
            </option>
            <option value="normal">
              Normal
            </option>
            <option value="warning">
              Warning
            </option>
            <option value="critical">
              Critical
            </option>
          </select>
        </div>
      </div>

      {/* LIST */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-10">
            No announcements found
          </div>
        )}

        {filtered.map(
          (item, i) => (
            <motion.div
              key={item.id}
              initial={{
                opacity: 0,
                y: 15,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay:
                  i * 0.03,
              }}
              className={`rounded-2xl border p-5 ${cardStyle(
                item.priority
              )}`}
            >
              <div className="flex justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {icon(
                      item.priority
                    )}

                    <h3 className="font-semibold">
                      {item.title}
                    </h3>

                    <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-400">
                      {
                        item.priority
                      }
                    </span>
                  </div>

                  <p className="text-sm text-gray-300 mt-3 leading-relaxed whitespace-pre-wrap">
                    {
                      item.message
                    }
                  </p>

                  <div className="mt-4 text-xs text-gray-500 flex items-center gap-1">
                    <Clock3
                      size={12}
                    />
                    Live post
                  </div>
                </div>

                <button
                  onClick={() =>
                    deleteItem(
                      item.id
                    )
                  }
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2
                    size={16}
                  />
                </button>
              </div>
            </motion.div>
          )
        )}
      </div>

      {/* MODAL */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{
                scale: 0.95,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              exit={{
                scale: 0.95,
                opacity: 0,
              }}
              className="w-full max-w-xl rounded-2xl bg-[#020617] border border-white/10 p-6"
            >
              <div className="flex justify-between items-center mb-5">
                <h2 className="font-semibold text-lg">
                  Create Announcement
                </h2>

                <button
                  onClick={() =>
                    setShowModal(
                      false
                    )
                  }
                >
                  <X
                    size={18}
                  />
                </button>
              </div>

              <form
                onSubmit={
                  createItem
                }
                className="space-y-4"
              >
                <input
                  value={
                    form.title
                  }
                  onChange={(
                    e
                  ) =>
                    setForm({
                      ...form,
                      title:
                        e
                          .target
                          .value,
                    })
                  }
                  placeholder="Title"
                  maxLength="80"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10"
                />

                <textarea
                  rows="6"
                  value={
                    form.message
                  }
                  onChange={(
                    e
                  ) =>
                    setForm({
                      ...form,
                      message:
                        e
                          .target
                          .value,
                    })
                  }
                  placeholder="Write message..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10"
                />

                <select
                  value={
                    form.priority
                  }
                  onChange={(
                    e
                  ) =>
                    setForm({
                      ...form,
                      priority:
                        e
                          .target
                          .value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10"
                >
                  <option value="normal">
                    Normal
                  </option>
                  <option value="warning">
                    Warning
                  </option>
                  <option value="critical">
                    Critical
                  </option>
                </select>

                <button
                  disabled={
                    saving
                  }
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500"
                >
                  {saving
                    ? "Sending..."
                    : "Send Announcement"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Banner({
  text,
  red,
  green,
}) {
  return (
    <div
      className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
        red
          ? "bg-red-500/10 text-red-300 border border-red-500/20"
          : "bg-green-500/10 text-green-300 border border-green-500/20"
      }`}
    >
      <CheckCircle2 size={15} />
      {text}
    </div>
  );
}

function StatCard({
  title,
  value,
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#020617] p-4">
      <p className="text-xs text-gray-400">
        {title}
      </p>

      <h2 className="text-2xl font-semibold mt-2">
        {value}
      </h2>
    </div>
  );
}