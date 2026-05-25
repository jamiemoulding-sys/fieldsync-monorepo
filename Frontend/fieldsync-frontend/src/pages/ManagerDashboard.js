// src/pages/ManagerDashboard.js

import React, {
  useEffect,
  useState,
} from "react";

import {
  managerAPI,
} from "../services/api";

import BackButton from "../components/BackButton";

function ManagerDashboard() {
  const [workers, setWorkers] =
    useState([]);

  const [time, setTime] =
    useState(Date.now());

  const [savingId, setSavingId] =
    useState(null);

  useEffect(() => {
    loadWorkers();

    const fetchInterval =
      setInterval(() => {
        loadWorkers();
      }, 5000);

    const timerInterval =
      setInterval(() => {
        setTime(Date.now());
      }, 1000);

    return () => {
      clearInterval(
        fetchInterval
      );
      clearInterval(
        timerInterval
      );
    };
  }, []);

  const loadWorkers =
    async () => {
      try {
        const res =
          await managerAPI.getActiveShifts();

        setWorkers(
          res.data || []
        );
      } catch (err) {
        console.error(
          "LOAD WORKERS ERROR:",
          err
        );
      }
    };

  const getDuration = (
    startTime
  ) => {
    const start =
      new Date(startTime);

    const now =
      new Date(time);

    const seconds =
      Math.floor(
        (now - start) / 1000
      );

    const h = Math.floor(
      seconds / 3600
    );

    const m = Math.floor(
      (seconds % 3600) / 60
    );

    const s =
      seconds % 60;

    return `${h}h ${m}m ${s}s`;
  };

  const manualClockOut =
    async (worker) => {
      const chosen =
        prompt(
          `Clock out ${worker.name} at time:\nUse HH:MM (24hr)\nExample 17:00`,
          new Date()
            .toTimeString()
            .slice(0, 5)
        );

      if (!chosen) return;

      try {
        setSavingId(
          worker.id
        );

        await managerAPI.clockOutStaff(
          worker.id,
          chosen
        );

        await loadWorkers();
      } catch (err) {
        console.error(err);

        alert(
          "Failed to clock out staff"
        );
      } finally {
        setSavingId(
          null
        );
      }
    };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">

        <BackButton />

        <h1 className="text-3xl font-bold mb-2">
          Manager Dashboard
        </h1>

        <p className="text-gray-400 mb-6">
          Live staff shifts +
          manual override
        </p>

        {workers.length ===
        0 ? (
          <p className="text-gray-400">
            No active workers
          </p>
        ) : (
          <div className="space-y-4">
            {workers.map(
              (
                worker
              ) => (
                <div
                  key={
                    worker.id
                  }
                  className="bg-gray-800 p-5 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div>
                    <p className="font-bold text-lg">
                      {
                        worker.name
                      }
                    </p>

                    <p className="text-gray-400 text-sm">
                      Started:{" "}
                      {new Date(
                        worker.clock_in_time
                      ).toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="text-green-400 font-bold text-lg">
                    {getDuration(
                      worker.clock_in_time
                    )}
                  </div>

                  <button
                    onClick={() =>
                      manualClockOut(
                        worker
                      )
                    }
                    disabled={
                      savingId ===
                      worker.id
                    }
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50"
                  >
                    {savingId ===
                    worker.id
                      ? "Saving..."
                      : "Clock Out"}
                  </button>
                </div>
              )
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default ManagerDashboard;