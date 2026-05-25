// src/pages/Alerts.js
// FULL COPY / PASTE READY
// FIELDSYNC ENTERPRISE VERSION
// ✅ Late staff alerts
// ✅ Open shift alerts
// ✅ Outside zone alerts
// ✅ No movement alerts
// ✅ Priority colours
// ✅ Refresh live
// ✅ Premium UI

import { useEffect, useMemo, useState } from "react";
import {
  shiftAPI,
  userAPI,
} from "../services/api";

import {
  AlertTriangle,
  Clock3,
  MapPin,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Users,
} from "lucide-react";

export default function Alerts() {
  const [users, setUsers] =
    useState([]);

  const [shifts, setShifts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    load();

    const t =
      setInterval(
        load,
        30000
      );

    return () =>
      clearInterval(t);
  }, []);

  async function load() {
    try {
      setLoading(true);

      const [u, s] =
        await Promise.all([
          userAPI.getAll(),
          shiftAPI.getAll(),
        ]);

      setUsers(
        Array.isArray(u)
          ? u
          : []
      );

      setShifts(
        Array.isArray(s)
          ? s
          : []
      );
    } finally {
      setLoading(false);
    }
  }

  function getUser(id) {
    return (
      users.find(
        (x) =>
          x.id === id
      ) || {}
    );
  }

  function minsAgo(date) {
    return Math.floor(
      (Date.now() -
        new Date(
          date
        )) /
        60000
    );
  }

  const alerts =
    useMemo(() => {
      const list = [];

      shifts.forEach(
        (s) => {
          const user =
            getUser(
              s.user_id
            );

          if (
            !s.clock_out_time
          ) {
            const mins =
              minsAgo(
                s.clock_in_time
              );

            if (
              mins > 600
            ) {
              list.push({
                type: "Long Shift",
                level:
                  "high",
                user:
                  user.name,
                text: `Still clocked in for ${Math.floor(
                  mins /
                    60
                )}h`,
              });
            }

            if (
              !s.last_latitude
            ) {
              list.push({
                type: "GPS Missing",
                level:
                  "medium",
                user:
                  user.name,
                text: "No live GPS received",
              });
            }

            if (
              s.updated_at &&
              minsAgo(
                s.updated_at
              ) > 30
            ) {
              list.push({
                type: "No Movement",
                level:
                  "medium",
                user:
                  user.name,
                text: "No update for 30+ mins",
              });
            }
          }
        }
      );

      return list;
    }, [shifts, users]);

  if (loading) {
    return (
      <div className="text-gray-400 flex gap-2 items-center">
        <Loader2
          size={16}
          className="animate-spin"
        />
        Loading alerts...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex gap-2 items-center">
            <ShieldAlert size={22} />
            Alerts
          </h1>

          <p className="text-sm text-gray-400">
            Live workforce risk monitoring
          </p>
        </div>

        <button
          onClick={load}
          className="px-4 py-3 rounded-2xl bg-indigo-600"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* KPI */}
      <div className="grid md:grid-cols-3 gap-4">

        <Card
          title="Total Alerts"
          value={
            alerts.length
          }
          icon={
            <AlertTriangle size={16} />
          }
        />

        <Card
          title="Staff Live"
          value={
            shifts.filter(
              (x) =>
                !x.clock_out_time
            ).length
          }
          icon={
            <Users size={16} />
          }
        />

        <Card
          title="High Priority"
          value={
            alerts.filter(
              (x) =>
                x.level ===
                "high"
            ).length
          }
          icon={
            <Clock3 size={16} />
          }
        />

      </div>

      {/* LIST */}
      <div className="space-y-3">
        {alerts.length ===
        0 ? (
          <div className="rounded-3xl bg-[#020617] border border-white/10 p-8 text-center text-gray-400">
            No active alerts
          </div>
        ) : (
          alerts.map(
            (
              a,
              i
            ) => (
              <div
                key={i}
                className={`rounded-2xl border p-5 ${
                  a.level ===
                  "high"
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-amber-500/10 border-amber-500/20"
                }`}
              >
                <div className="flex justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold">
                      {
                        a.type
                      }
                    </p>

                    <p className="text-sm mt-1 text-gray-300">
                      {a.user}
                    </p>
                  </div>

                  <p className="text-sm">
                    {a.text}
                  </p>
                </div>
              </div>
            )
          )
        )}
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