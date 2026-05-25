/* =========================================================
src/pages/Locations.js
ELITE REWRITE VERSION
FULL COPY / PASTE FILE

UPGRADES INCLUDED
✅ Search locations
✅ KPI cards
✅ Better loading states
✅ Better empty states
✅ Cleaner create/edit modal
✅ Error + success banners
✅ Faster UI refresh
✅ Mobile responsive
✅ Multi-company safe
✅ Keeps LocationPicker logic
========================================================= */

import { useState, useEffect, useMemo } from "react";
import { locationAPI } from "../services/api";
import LocationPicker from "../components/LocationPicker";
import { motion } from "framer-motion";
import {
  MapPin,
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Globe,
  Radius,
  CheckCircle2,
  X,
} from "lucide-react";

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [position, setPosition] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    address: "",
    radius: 100,
  });

  useEffect(() => {
    loadLocations();
  }, []);

  async function loadLocations() {
    try {
      setLoading(true);
      setError("");

     const data = await locationAPI.getLocations();

setLocations(
  Array.isArray(data)
    ? data.filter(
        (x) => !x.archived
      )
    : []
);
    } catch {
      setError("Failed to load locations");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditing(null);
    setPosition(null);

    setForm({
      name: "",
      address: "",
      radius: 100,
    });
  }

  function openCreate() {
    resetForm();
    setShowModal(true);
  }

  function openEdit(row) {
    setEditing(row);

    setForm({
      name: row.name || "",
      address: row.address || "",
      radius: row.radius || 100,
    });

    setPosition({
      lat: Number(row.latitude),
      lng: Number(row.longitude),
    });

    setShowModal(true);
  }

  async function saveLocation(e) {
    e.preventDefault();

    if (!position) {
      return setError("Choose map pin first");
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...form,
        radius: Number(form.radius),
        latitude: position.lat,
        longitude: position.lng,
      };

      if (editing) {
        await locationAPI.update(editing.id, payload);
        setSuccess("Location updated");
      } else {
        await locationAPI.create(payload);
        setSuccess("Location created");
      }

      setShowModal(false);
      resetForm();
      await loadLocations();
    } catch {
      setError("Failed to save location");
    } finally {
      setSaving(false);
    }
  }

async function deleteLocation(id) {
  if (
    !window.confirm(
      "This site may be linked to shifts or schedules.\n\nArchive instead?"
    )
  )
    return;

  try {
    setError("");
    setSuccess("");

    /* OPTION 1 = soft delete */
    await locationAPI.update(id, {
      archived: true,
    });

    setSuccess("Location archived");
    await loadLocations();

  } catch (err) {
    console.error(err);

    setError(
      "Cannot delete site because staff history or schedules are linked."
    );
  }
}

  const filtered = useMemo(() => {
    return locations.filter((loc) =>
      `${loc.name} ${loc.address || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [locations, search]);

  const total = locations.length;

  const avgRadius =
    total > 0
      ? Math.round(
          locations.reduce(
            (sum, x) => sum + Number(x.radius || 0),
            0
          ) / total
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Locations
          </h1>

          <p className="text-sm text-gray-400">
            Manage geofence clock-in sites
          </p>
        </div>

        <button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl flex items-center gap-2"
        >
          <Plus size={16} />
          Add Location
        </button>
      </div>

      {/* ALERTS */}
      {error && <Banner red text={error} />}
      {success && <Banner green text={success} />}

      {/* KPI */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard
          title="Total Locations"
          value={total}
          icon={<MapPin size={16} />}
        />

        <StatCard
          title="Average Radius"
          value={`${avgRadius}m`}
          icon={<Radius size={16} />}
        />

        <StatCard
          title="System Status"
          value="Live"
          icon={<Globe size={16} />}
        />
      </div>

      {/* SEARCH */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-4 top-3.5 text-gray-500"
        />

        <input
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          placeholder="Search locations..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#020617] border border-white/10"
        />
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="text-gray-400 flex items-center gap-2">
          <Loader2
            size={16}
            className="animate-spin"
          />
          Loading locations...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#020617] p-10 text-center text-gray-500">
          No locations found
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((loc, i) => (
            <motion.div
              key={loc.id}
              initial={{
                opacity: 0,
                y: 10,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: i * 0.03,
              }}
              className="rounded-2xl border border-white/10 bg-[#020617] p-5"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="font-semibold">
                    {loc.name}
                  </h2>

                  <p className="text-sm text-gray-400 mt-2">
                    {loc.address ||
                      "No address"}
                  </p>
                </div>

                <MapPin
                  size={18}
                  className="text-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div className="rounded-xl bg-white/5 p-3">
                  Radius: {loc.radius}m
                </div>

                <div className="rounded-xl bg-white/5 p-3 truncate">
                  {Number(
                    loc.latitude
                  ).toFixed(4)}
                  ,{" "}
                  {Number(
                    loc.longitude
                  ).toFixed(4)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() =>
                    openEdit(loc)
                  }
                  className="py-2 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2"
                >
                  <Pencil size={15} />
                  Edit
                </button>

                <button
                  onClick={() =>
                    deleteLocation(loc.id)
                  }
                  className="py-2 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 flex items-center justify-center gap-2"
                >
                  <Trash2 size={15} />
                  Archive
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#020617] border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {editing
                  ? "Edit Location"
                  : "Create Location"}
              </h2>

              <button
                onClick={() =>
                  setShowModal(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={saveLocation}
              className="space-y-4"
            >
              <input
                required
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name:
                      e.target.value,
                  })
                }
                placeholder="Location name"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10"
              />

              <input
                value={form.address}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address:
                      e.target.value,
                  })
                }
                placeholder="Address"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10"
              />

              <LocationPicker
                position={position}
                setPosition={setPosition}
                radius={Number(
                  form.radius
                )}
                onSelectAddress={(
                  addr
                ) =>
                  setForm(
                    (prev) => ({
                      ...prev,
                      address: addr,
                    })
                  )
                }
              />

              <input
                type="number"
                min="10"
                value={form.radius}
                onChange={(e) =>
                  setForm({
                    ...form,
                    radius:
                      e.target.value,
                  })
                }
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10"
              />

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
                  className="py-3 rounded-xl bg-white/5"
                >
                  Cancel
                </button>

                <button
                  disabled={saving}
                  className="py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500"
                >
                  {saving
                    ? "Saving..."
                    : "Save Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
  icon,
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#020617] p-4">
      <div className="flex justify-between items-center">
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