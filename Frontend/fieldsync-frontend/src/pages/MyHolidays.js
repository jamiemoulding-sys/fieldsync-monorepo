import { useEffect, useState } from "react";
import { holidayAPI } from "../services/api";
import { Send } from "lucide-react";

export default function MyHolidays() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      const data =
        await holidayAPI.getMine();

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

  async function submit(e) {
    e.preventDefault();

    if (
      !form.start_date ||
      !form.end_date
    ) {
      return alert(
        "Select dates"
      );
    }

    if (
      form.end_date <
      form.start_date
    ) {
      return alert(
        "End date cannot be before start date"
      );
    }

    try {
      setSaving(true);

      await holidayAPI.create({
        start_date: form.start_date,
        end_date: form.end_date,
      });

      setForm({
        start_date: "",
        end_date: "",
      });

      await load();

      alert(
        "Holiday request sent"
      );
    } catch (err) {
      console.error(err);

      alert(
        "Failed to submit request"
      );
    } finally {
      setSaving(false);
    }
  }

  function badge(status) {
    if (
      status ===
      "approved"
    ) {
      return "bg-green-500/20 text-green-400";
    }

    if (
      status ===
      "rejected"
    ) {
      return "bg-red-500/20 text-red-400";
    }

    return "bg-yellow-500/20 text-yellow-400";
  }

  if (loading) {
    return (
      <div className="text-gray-400">
        Loading holidays...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          My Holidays
        </h1>

        <p className="text-sm text-gray-400">
          Request time off
        </p>
      </div>

      <form
        onSubmit={submit}
        className="rounded-2xl border border-white/10 p-6 bg-[#020617] space-y-4"
      >
        <div className="grid md:grid-cols-2 gap-4">
          <input
            type="date"
            value={
              form.start_date
            }
            onChange={(e) =>
              setForm({
                ...form,
                start_date:
                  e.target.value,
              })
            }
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3"
            required
          />

          <input
            type="date"
            value={
              form.end_date
            }
            onChange={(e) =>
              setForm({
                ...form,
                end_date:
                  e.target.value,
              })
            }
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3"
            required
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Send size={16} />

          {saving
            ? "Sending..."
            : "Submit Request"}
        </button>
      </form>

      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-gray-400 text-sm">
            <tr>
              <th className="p-4">
                Dates
              </th>

              <th className="p-4">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan="2"
                  className="p-4 text-gray-500"
                >
                  No requests yet
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-white/5"
                >
                  <td className="p-4">
                    {row.start_date} →{" "}
                    {row.end_date}
                  </td>

                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs capitalize ${badge(
                        row.status
                      )}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}