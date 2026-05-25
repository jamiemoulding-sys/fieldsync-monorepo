// src/pages/RouteReplay.js
// FULL FIXED FILE
// ✅ Mileage now in MILES
// ✅ UK friendly
// ✅ Full existing logic kept
// ✅ Premium UI kept
// ✅ Copy / Paste Ready

import { useEffect, useMemo, useState } from "react";
import { reportAPI, userAPI } from "../services/api";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  Map,
  Navigation,
  CalendarDays,
  Truck,
  Clock3,
  Loader2,
} from "lucide-react";

/* FIX DEFAULT LEAFLET ICON */
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function RouteReplay() {
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [employee, setEmployee] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      const [u, routes] =
        await Promise.all([
          userAPI.getAll(),
          reportAPI.getRouteLogs
            ? reportAPI.getRouteLogs()
            : [],
        ]);

      setUsers(
        Array.isArray(u) ? u : []
      );

      setRows(
        Array.isArray(routes)
          ? routes
          : []
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let data = [...rows];

    if (employee) {
      data = data.filter(
        (x) =>
          String(x.user_id) ===
          String(employee)
      );
    }

    data = data.filter((x) => {
      const day =
        x.created_at?.split(
          "T"
        )[0];

      return day === date;
    });

    data.sort(
      (a, b) =>
        new Date(a.created_at) -
        new Date(b.created_at)
    );

    return data;
  }, [rows, employee, date]);

 const points = filtered
  .filter(
    (x) =>
      x.latitude &&
      x.longitude
  )
  .map((x) => [
    Number(x.latitude),
    Number(x.longitude),
  ]);

  function kmBetween(
    lat1,
    lon1,
    lat2,
    lon2
  ) {
    const R = 6371;

    const dLat =
      ((lat2 - lat1) *
        Math.PI) /
      180;

    const dLon =
      ((lon2 - lon1) *
        Math.PI) /
      180;

    const a =
      Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +
      Math.cos(
        (lat1 * Math.PI) / 180
      ) *
        Math.cos(
          (lat2 * Math.PI) / 180
        ) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return R * c;
  }

  /* FIXED TO MILES */
  const mileage = useMemo(() => {
    let km = 0;

    for (
      let i = 1;
      i < filtered.length;
      i++
    ) {
      km += kmBetween(
        Number(
          filtered[i - 1]
            .latitude
        ),
        Number(
          filtered[i - 1]
            .longitude
        ),
        Number(
          filtered[i]
            .latitude
        ),
        Number(
          filtered[i]
            .longitude
        )
      );
    }

    const miles =
      km * 0.621371;

    return miles.toFixed(2);
  }, [filtered]);

  const start =
    filtered[0];

  const finish =
    filtered[
      filtered.length - 1
    ];

  if (loading) {
    return (
      <div className="text-gray-400 flex gap-2 items-center">
        <Loader2
          size={16}
          className="animate-spin"
        />
        Loading route replay...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-semibold flex gap-2 items-center">
          <Map size={22} />
          Route Replay
        </h1>

        <p className="text-sm text-gray-400">
          View travelled routes
          and mileage
        </p>
      </div>

      {/* FILTERS */}
      <div className="grid md:grid-cols-3 gap-4">

        <select
          value={employee}
          onChange={(e) =>
            setEmployee(
              e.target.value
            )
          }
          className="px-4 py-3 rounded-2xl bg-[#020617] border border-white/10"
        >
          <option value="">
            All Employees
          </option>

          {users.map((u) => (
            <option
              key={u.id}
              value={u.id}
            >
              {u.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={date}
          onChange={(e) =>
            setDate(
              e.target.value
            )
          }
          className="px-4 py-3 rounded-2xl bg-[#020617] border border-white/10"
        />

        <button
          onClick={load}
          className="rounded-2xl bg-indigo-600"
        >
          Refresh
        </button>
      </div>

      {/* KPI */}
      <div className="grid md:grid-cols-4 gap-4">

        <Card
          title="GPS Points"
          value={filtered.length}
          icon={
            <Navigation
              size={16}
            />
          }
        />

        <Card
          title="Mileage"
          value={`${mileage} mi`}
          icon={
            <Truck
              size={16}
            />
          }
        />

        <Card
          title="Start"
          value={
            start
              ? new Date(
                  start.created_at
                ).toLocaleTimeString(
                  "en-GB",
                  {
                    hour: "2-digit",
                    minute:
                      "2-digit",
                  }
                )
              : "-"
          }
          icon={
            <Clock3
              size={16}
            />
          }
        />

        <Card
          title="Finish"
          value={
            finish
              ? new Date(
                  finish.created_at
                ).toLocaleTimeString(
                  "en-GB",
                  {
                    hour: "2-digit",
                    minute:
                      "2-digit",
                  }
                )
              : "-"
          }
          icon={
            <CalendarDays
              size={16}
            />
          }
        />

      </div>

      {/* MAP */}
      <div className="rounded-3xl overflow-hidden border border-white/10">
        <div className="h-[600px] w-full">

          <MapContainer
            center={
              points.length
                ? points[0]
                : [51.5, -0.1]
            }
            zoom={13}
            scrollWheelZoom
            style={{
              height: "100%",
              width: "100%",
            }}
          >

            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {points.length >
              1 && (
              <Polyline
                positions={
                  points
                }
                pathOptions={{
                  color:
                    "#2563eb",
                  weight: 5,
                }}
              />
            )}

            {start && (
              <Marker
                position={[
                  Number(
                    start.latitude
                  ),
                  Number(
                    start.longitude
                  ),
                ]}
              >
                <Popup>
                  Start
                </Popup>
              </Marker>
            )}

            {finish &&
              finish.id !==
                start?.id && (
                <Marker
                  position={[
                    Number(
                      finish.latitude
                    ),
                    Number(
                      finish.longitude
                    ),
                  ]}
                >
                  <Popup>
                    Finish
                  </Popup>
                </Marker>
              )}

          </MapContainer>

        </div>
      </div>

      {/* TIMELINE */}
      <div className="rounded-3xl bg-[#020617] border border-white/10 p-5">
        <h3 className="font-medium mb-4">
          Timeline
        </h3>

        <div className="space-y-2 max-h-[400px] overflow-auto">
          {filtered.map(
            (r, i) => (
              <div
                key={
                  r.id || i
                }
                className="flex justify-between text-sm border-b border-white/5 pb-2"
              >
                <span>
                  Point{" "}
                  {i + 1}
                </span>

                <span className="text-gray-400">
                  {new Date(
                    r.created_at
                  ).toLocaleTimeString(
                    "en-GB"
                  )}
                </span>
              </div>
            )
          )}
        </div>
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
    <div className="rounded-2xl bg-[#020617] border border-white/10 p-5">
      <div className="flex justify-between">
        <p className="text-xs text-gray-400">
          {title}
        </p>

        <div className="text-indigo-400">
          {icon}
        </div>
      </div>

      <h2 className="text-2xl font-semibold mt-3">
        {value}
      </h2>
    </div>
  );
}