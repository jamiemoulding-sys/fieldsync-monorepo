// src/pages/MySchedule.jsx
// FULL PATCHED VERSION
// Your file preserved + upgrades added

import { useEffect, useMemo, useState } from "react";
import { scheduleAPI } from "../services/api";
import {
  CalendarDays,
  Clock3,
  Loader2,
  RefreshCw,
  Download,
  History,
} from "lucide-react";

export default function MySchedule() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] =
    useState(false);

  useEffect(() => {
    load();

    const timer = setInterval(
      load,
      30000
    );

    return () => clearInterval(timer);
  }, []);

  async function load() {
    try {
      setLoading(true);

      const data =
        await scheduleAPI.getMine();

      setRows(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (err) {
      console.error(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date) {
    if (!date) return "-";

    return new Date(
      date
    ).toLocaleDateString(
      "en-GB",
      {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }
    );
  }

  function formatTime(date) {
    if (!date) return "-";

    return new Date(
      date
    ).toLocaleTimeString(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = useMemo(() => {
    return rows
      .filter((row) => {
        const d = new Date(
          row.date
        );
        d.setHours(0, 0, 0, 0);
        return d >= today;
      })
      .sort(
        (a, b) =>
          new Date(a.date) -
          new Date(b.date)
      );
  }, [rows]);

  const history = useMemo(() => {
    return rows
      .filter((row) => {
        const d = new Date(
          row.date
        );
        d.setHours(0, 0, 0, 0);
        return d < today;
      })
      .sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      );
  }, [rows]);

  const thisWeek = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date();
    weekEnd.setDate(
      now.getDate() + 7
    );

    return upcoming.filter(
      (r) =>
        new Date(r.date) <=
        weekEnd
    ).length;
  }, [upcoming]);

  const workedHours = useMemo(() => {
    let total = 0;

    history.forEach((row) => {
      if (
        row.start_time &&
        row.end_time
      ) {
        const start =
          new Date(
            row.start_time
          );
        const end =
          new Date(
            row.end_time
          );

        const hrs =
          (end - start) /
          1000 /
          60 /
          60;

        total += hrs;
      }
    });

    return total.toFixed(1);
  }, [history]);

  function exportCSV() {
    const rowsCSV = [
      [
        "Date",
        "Start",
        "End",
      ],
    ];

    history.forEach((row) => {
      rowsCSV.push([
        row.date || "",
        row.start_time || "",
        row.end_time || "",
      ]);
    });

    const csv = rowsCSV
      .map((r) =>
        r
          .map(
            (x) =>
              `"${x}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv",
      }
    );

    const url =
      URL.createObjectURL(
        blob
      );

    const a =
      document.createElement(
        "a"
      );

    a.href = url;
    a.download =
      "my-shifts.csv";
    a.click();

    URL.revokeObjectURL(
      url
    );
  }

  if (loading) {
    return (
      <div className="text-gray-400 flex items-center gap-2">
        <Loader2
          size={16}
          className="animate-spin"
        />
        Loading schedule...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            My Schedule
          </h1>

          <p className="text-sm text-gray-400">
            Upcoming assigned shifts
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 flex items-center gap-2"
          >
            <RefreshCw
              size={15}
            />
            Refresh
          </button>

          <button
            onClick={() =>
              setShowHistory(
                !showHistory
              )
            }
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 flex items-center gap-2"
          >
            <History
              size={15}
            />
            History
          </button>

          <button
            onClick={
              exportCSV
            }
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 flex items-center gap-2"
          >
            <Download
              size={15}
            />
            Export
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid md:grid-cols-4 gap-4">

        <Card
          title="Upcoming"
          value={
            upcoming.length
          }
          icon={
            <CalendarDays size={16} />
          }
        />

        <Card
          title="This Week"
          value={thisWeek}
          icon={
            <Clock3 size={16} />
          }
        />

        <Card
          title="Next Shift"
          value={
            upcoming[0]
              ? formatDate(
                  upcoming[0]
                    .date
                )
              : "-"
          }
          icon={
            <CalendarDays size={16} />
          }
        />

        <Card
          title="Worked Hours"
          value={
            workedHours
          }
          icon={
            <Clock3 size={16} />
          }
        />

      </div>

      {/* UPCOMING */}
      <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#020617]">

        <table className="w-full text-left">
          <thead className="bg-white/5 text-gray-400 text-sm">
            <tr>
              <th className="p-4">
                Date
              </th>
              <th className="p-4">
                Start
              </th>
              <th className="p-4">
                End
              </th>
            </tr>
          </thead>

          <tbody>
            {upcoming.map(
              (row) => (
                <tr
                  key={
                    row.id
                  }
                  className="border-t border-white/5"
                >
                  <td className="p-4">
                    {formatDate(
                      row.date
                    )}
                  </td>

                  <td className="p-4">
                    {formatTime(
                      row.start_time
                    )}
                  </td>

                  <td className="p-4">
                    {formatTime(
                      row.end_time
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>

        {upcoming.length ===
          0 && (
          <div className="p-8 text-center text-gray-500">
            No upcoming shifts
          </div>
        )}
      </div>

      {/* HISTORY */}
      {showHistory && (
        <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#020617]">

          <div className="p-4 font-medium border-b border-white/10">
            Past Shifts
          </div>

          {history.map(
            (row) => (
              <div
                key={
                  row.id
                }
                className="p-4 border-t border-white/5"
              >
                <div>
                  {formatDate(
                    row.date
                  )}
                </div>

                <div className="text-sm text-gray-400 mt-1">
                  {formatTime(
                    row.start_time
                  )}{" "}
                  -{" "}
                  {formatTime(
                    row.end_time
                  )}
                </div>
              </div>
            )
          )}

          {history.length ===
            0 && (
            <div className="p-8 text-center text-gray-500">
              No past shifts
            </div>
          )}
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
    <div className="rounded-2xl border border-white/10 bg-[#020617] p-5">
      <div className="flex justify-between">
        <p className="text-sm text-gray-400">
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