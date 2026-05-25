// src/pages/Performance.js
// FULL PREMIUM PERFORMANCE REPLACEMENT V2
// ✅ Real company-useful metrics
// ✅ Lateness / attendance / utilisation
// ✅ Top performers
// ✅ Needs attention list
// ✅ Clean premium UI
// ✅ Full copy + paste ready

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { performanceAPI } from "../services/api";
import { motion } from "framer-motion";

import {
  Trophy,
  RefreshCw,
  Loader2,
  Search,
  Users,
  Clock3,
  AlertTriangle,
  TrendingUp,
  Star,
  Medal,
  TimerReset,
  ShieldAlert,
} from "lucide-react";

export default function Performance() {
  const [data, setData] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [sortBy, setSortBy] =
    useState("score");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      const res =
        await performanceAPI.getAll();

      setData(
        Array.isArray(res)
          ? res
          : []
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    let arr = [...data];

    if (search.trim()) {
      const q =
        search.toLowerCase();

      arr = arr.filter(
        (x) =>
          x.name
            ?.toLowerCase()
            .includes(q) ||
          x.email
            ?.toLowerCase()
            .includes(q)
      );
    }

    arr.sort((a, b) => {
      if (sortBy === "hours")
        return (
          getHours(b) -
          getHours(a)
        );

      if (sortBy === "late")
        return (
          getLate(b) -
          getLate(a)
        );

      if (sortBy === "attendance")
        return (
          getAttendance(b) -
          getAttendance(a)
        );

      return (
        getScore(b) -
        getScore(a)
      );
    });

    return arr;
  }, [data, search, sortBy]);

  const top =
    rows[0] || null;

  const totalHours =
    rows.reduce(
      (sum, x) =>
        sum +
        getHours(x),
      0
    );

  const avgHours =
    rows.length
      ? (
          totalHours /
          rows.length
        ).toFixed(1)
      : "0";

  const totalLate =
    rows.reduce(
      (sum, x) =>
        sum +
        getLate(x),
      0
    );

  const avgScore =
    rows.length
      ? Math.round(
          rows.reduce(
            (sum, x) =>
              sum +
              getScore(x),
            0
          ) / rows.length
        )
      : 0;

  const lowStaff =
    rows.filter(
      (x) =>
        getScore(x) < 55
    ).length;

  const bestAttendance =
    rows.length
      ? Math.max(
          ...rows.map((x) =>
            getAttendance(x)
          )
        )
      : 0;

  const insights = [];

  if (top) {
    insights.push(
      `${top.name} currently highest performer`
    );
  }

  if (totalLate > 0) {
    insights.push(
      `${totalLate} late arrivals recorded`
    );
  }

  if (lowStaff > 0) {
    insights.push(
      `${lowStaff} staff need review`
    );
  }

  if (Number(avgHours) > 42) {
    insights.push(
      "Average weekly hours are high"
    );
  }

  if (!insights.length) {
    insights.push(
      "Team performance healthy"
    );
  }

  if (loading) {
    return (
      <Center
        text="Loading performance..."
        loading
      />
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex justify-between items-center flex-wrap gap-4">

        <div>
          <h1 className="text-3xl font-semibold">
            Performance
          </h1>

          <p className="text-sm text-gray-400">
            Real workforce productivity intelligence
          </p>
        </div>

        <button
          onClick={load}
          className="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh
        </button>

      </div>

      {/* HERO */}

      {top && (
        <div className="rounded-3xl p-[1px] bg-gradient-to-r from-yellow-500/30 via-indigo-500/20 to-transparent">

          <div className="rounded-3xl bg-[#020617] border border-white/10 p-6">

            <div className="flex justify-between flex-wrap gap-4 items-center">

              <div className="flex gap-4 items-center">

                <div className="w-14 h-14 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center">
                  <Trophy size={24} />
                </div>

                <div>
                  <p className="text-sm text-gray-400">
                    Top Performer
                  </p>

                  <h2 className="text-2xl font-semibold">
                    {top.name}
                  </h2>

                  <p className="text-sm text-gray-400 mt-1">
                    {getHours(top).toFixed(
                      1
                    )} hrs •{" "}
                    {getAttendance(
                      top
                    )}% attendance
                  </p>
                </div>

              </div>

              <div className="text-right">
                <p className="text-xs text-gray-400">
                  Score
                </p>

                <p className="text-4xl font-semibold text-yellow-400">
                  {getScore(top)}%
                </p>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* KPI */}

      <div className="grid md:grid-cols-5 gap-4">

        <KPI
          title="Employees"
          value={rows.length}
          icon={<Users size={16} />}
        />

        <KPI
          title="Avg Score"
          value={`${avgScore}%`}
          icon={<Star size={16} />}
        />

        <KPI
          title="Avg Hours"
          value={avgHours}
          icon={<Clock3 size={16} />}
        />

        <KPI
          title="Late Arrivals"
          value={totalLate}
          icon={<TimerReset size={16} />}
        />

        <KPI
          title="Best Attendance"
          value={`${bestAttendance}%`}
          icon={<TrendingUp size={16} />}
        />

      </div>

      {/* INSIGHTS */}

      <div className="grid md:grid-cols-4 gap-4">

        {insights.map(
          (item, i) => (
            <div
              key={i}
              className="rounded-2xl bg-[#020617] border border-white/10 p-4 text-sm text-indigo-300"
            >
              {item}
            </div>
          )
        )}

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
            placeholder="Search employee..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#020617] border border-white/10"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(
              e.target.value
            )
          }
          className="px-4 py-3 rounded-2xl bg-[#020617] border border-white/10"
        >
          <option value="score">
            Sort by Score
          </option>
          <option value="hours">
            Sort by Hours
          </option>
          <option value="late">
            Sort by Lateness
          </option>
          <option value="attendance">
            Sort by Attendance
          </option>
        </select>

      </div>

      {/* STAFF CARDS */}

      <div className="grid md:grid-cols-3 gap-4">

        {rows.map(
          (item, i) => {
            const score =
              getScore(item);

            const risk =
              score < 55;

            return (
              <motion.div
                key={item.id}
                initial={{
                  opacity: 0,
                  y: 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay:
                    i * 0.02,
                }}
                className="rounded-3xl p-[1px] bg-gradient-to-b from-white/10 to-transparent"
              >
                <div className="rounded-3xl bg-[#020617] border border-white/10 p-5">

                  <div className="flex justify-between">

                    <div>
                      <p className="font-medium">
                        {item.name}
                      </p>

                      <p className="text-xs text-gray-400">
                        Team Member
                      </p>
                    </div>

                    {i === 0 ? (
                      <Medal
                        size={18}
                        className="text-yellow-400"
                      />
                    ) : risk ? (
                      <ShieldAlert
                        size={18}
                        className="text-red-400"
                      />
                    ) : null}

                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">

                    <Stat
                      label="Hours"
                      value={getHours(
                        item
                      ).toFixed(1)}
                    />

                    <Stat
                      label="Shifts"
                      value={getShifts(
                        item
                      )}
                    />

                    <Stat
                      label="Late"
                      value={getLate(
                        item
                      )}
                    />

                    <Stat
                      label="Attendance"
                      value={`${getAttendance(
                        item
                      )}%`}
                    />

                  </div>

                  <div className="mt-4">

                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-gray-400">
                        Performance Score
                      </span>

                      <span>
                        {score}%
                      </span>
                    </div>

                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">

                      <div
                        className={`h-full ${
                          risk
                            ? "bg-red-500"
                            : score >
                              80
                            ? "bg-green-500"
                            : "bg-indigo-500"
                        }`}
                        style={{
                          width: `${score}%`,
                        }}
                      />

                    </div>

                  </div>

                </div>
              </motion.div>
            );
          }
        )}

      </div>

    </div>
  );
}

/* HELPERS */

function getHours(x) {
  return Number(
    x.hours_worked || 0
  );
}

function getShifts(x) {
  return Number(
    x.total_shifts || 0
  );
}

function getLate(x) {
  return Number(
    x.late_count ||
      x.total_late ||
      0
  );
}

function getAttendance(x) {
  const shifts =
    getShifts(x);

  if (!shifts) return 0;

  const late =
    getLate(x);

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        ((shifts - late) /
          shifts) *
          100
      )
    )
  );
}

function getScore(x) {
  const hours =
    getHours(x);

  const shifts =
    getShifts(x);

  const late =
    getLate(x);

  const attendance =
    getAttendance(x);

  let score =
    hours * 1.5 +
    shifts * 6 +
    attendance -
    late * 8;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(score)
    )
  );
}

/* UI */

function KPI({
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

function Stat({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-white/5 p-3 text-center">
      <p className="text-xs text-gray-400">
        {label}
      </p>

      <p className="text-sm font-semibold mt-1">
        {value}
      </p>
    </div>
  );
}

function Center({
  text,
  loading,
}) {
  return (
    <div className="h-[60vh] flex items-center justify-center gap-2 text-gray-400">
      {loading && (
        <Loader2
          size={16}
          className="animate-spin"
        />
      )}
      {text}
    </div>
  );
}