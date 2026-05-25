/* src/pages/Employees.js */
/* FULL FIX FILE ONLY
✅ Cleaned broken pasted code
✅ Labels added to all fields
✅ Save works
✅ Numeric fields safe
✅ Delete restored (2 step confirm)
✅ Invite modal works
✅ Modal scroll works
✅ Table + Grid view
*/

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { userAPI, inviteAPI } from "../services/api";
import { motion } from "framer-motion";

import {
  Users,
  Search,
  Trash2,
  UserPlus,
  RefreshCw,
  X,
  LayoutGrid,
  Table,
  ArrowUpDown,
  Pencil,
  Save,
  PoundSterling,
  Clock3,
} from "lucide-react";

export default function Employees() {
  const { user } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [view, setView] = useState("table");
  const [sort, setSort] = useState("name");

  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState({});

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("employee");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await userAPI.getAll();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let data = [...rows];

    if (search.trim()) {
      const q = search.toLowerCase();

      data = data.filter(
        (x) =>
          x.name?.toLowerCase().includes(q) ||
          x.email?.toLowerCase().includes(q) ||
          x.department?.toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => {
      if (sort === "rate") {
        return Number(b.hourly_rate || 0) - Number(a.hourly_rate || 0);
      }

      return (a.name || "").localeCompare(b.name || "");
    });

    return data;
  }, [rows, search, sort]);

  function num(v) {
    if (v === "" || v === null || v === undefined) return null;
    return Number(v);
  }

  function openEditor(emp) {
    setEditor(emp);

    setForm({
      name: emp.name || "",
      phone: emp.phone || "",
      department: emp.department || "",
      job_title: emp.job_title || "",
      payroll_id: emp.payroll_id || "",
      emergency_contact: emp.emergency_contact || "",
      start_date: emp.start_date
  ? new Date(emp.start_date).toISOString().slice(0, 10)
  : "",
      hourly_rate: emp.hourly_rate ?? "",
      overtime_rate: emp.overtime_rate ?? "",
      night_rate: emp.night_rate ?? "",
      contracted_hours: emp.contracted_hours ?? "",
      holiday_allowance: emp.holiday_allowance ?? "",
      role: emp.role || "employee",
      status: emp.status || "active",
    });
  }

async function saveEditor() {
  try {
    setSaving(true);

    await userAPI.update(editor.id, {
      ...form,

      start_date:
        form.start_date || null,

      hourly_rate: num(form.hourly_rate),
      overtime_rate: num(form.overtime_rate),
      night_rate: num(form.night_rate),
      contracted_hours: num(form.contracted_hours),
      holiday_allowance: num(form.holiday_allowance),
    });

    setEditor(null);
    await load();

  } finally {
    setSaving(false);
  }
}

  async function removeUser(id, name) {
    const first = window.confirm(`Delete ${name}?`);
    if (!first) return;

    const second = window.confirm(
      "FINAL WARNING:\nAll employee data will be permanently deleted."
    );

    if (!second) return;

    await userAPI.delete(id);
    load();
  }

  async function sendInvite() {
    try {
      setSaving(true);

      await inviteAPI.send({
        email: inviteEmail,
        role: inviteRole,
      });

      setInviteEmail("");
      setInviteOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between flex-wrap gap-4">

        <div>
          <h1 className="text-3xl font-bold flex gap-2 items-center">
            <Users size={24} />
            Employees
          </h1>

          <p className="text-gray-400 text-sm">
            Workforce control centre
          </p>
        </div>

        <div className="flex gap-2">

          <button
            onClick={load}
            className="px-4 py-2 rounded-xl bg-white/5"
          >
            <RefreshCw size={16} />
          </button>

          <button
            onClick={() => setInviteOpen(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600"
          >
            <UserPlus size={16} />
          </button>

        </div>
      </div>

      {/* KPI */}
      <div className="grid md:grid-cols-3 gap-4">

        <Card
          title="Total Staff"
          value={rows.length}
          icon={<Users size={16} />}
        />

        <Card
          title="Missing Rates"
          value={rows.filter((x) => !x.hourly_rate).length}
          icon={<PoundSterling size={16} />}
        />

        <Card
          title="Contracts Set"
          value={rows.filter((x) => x.contracted_hours).length}
          icon={<Clock3 size={16} />}
        />

      </div>

      {/* FILTERS */}
      <div className="grid md:grid-cols-3 gap-3">

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="px-4 py-3 rounded-xl bg-[#020617] border border-white/10"
        />

        <button
          onClick={() =>
            setSort(sort === "name" ? "rate" : "name")
          }
          className="rounded-xl bg-white/5"
        >
          <ArrowUpDown size={16} className="mx-auto" />
        </button>

        <button
          onClick={() =>
            setView(view === "table" ? "grid" : "table")
          }
          className="rounded-xl bg-white/5"
        >
          {view === "table" ? (
            <LayoutGrid size={16} className="mx-auto" />
          ) : (
            <Table size={16} className="mx-auto" />
          )}
        </button>

      </div>

      {/* TABLE */}
      {view === "table" && (
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#020617]">
          <table className="w-full text-sm">

            <thead className="bg-white/5 text-gray-400">
              <tr>
                <th className="p-4 text-left">Employee</th>
                <th className="p-4 text-left">Role</th>
                <th className="p-4 text-left">Rate</th>
                <th className="p-4 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((emp) => (
                <tr
                  key={emp.id}
                  className="border-t border-white/5"
                >
                  <td className="p-4">
                    <UserRow emp={emp} />
                  </td>

                  <td className="p-4 capitalize">
                    {emp.role}
                  </td>

                  <td className="p-4">
                    {emp.hourly_rate
                      ? `£${emp.hourly_rate}`
                      : "-"}
                  </td>

                  <td className="p-4 flex gap-3">

                    <button
                      onClick={() => openEditor(emp)}
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      onClick={() =>
                        removeUser(emp.id, emp.name)
                      }
                      className="text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>

                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      )}

      {/* GRID */}
      {view === "grid" && (
        <div className="grid md:grid-cols-3 gap-4">

          {filtered.map((emp) => (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-[#020617] p-5"
            >
              <UserRow emp={emp} />

              <p className="mt-3 text-sm text-gray-400">
                Role: {emp.role}
              </p>

              <p className="text-sm text-gray-400">
                Department: {emp.department || "-"}
              </p>

              <div className="grid grid-cols-2 gap-2 mt-4">

                <button
                  onClick={() => openEditor(emp)}
                  className="py-2 rounded-xl bg-indigo-600"
                >
                  Edit
                </button>

                <button
                  onClick={() =>
                    removeUser(emp.id, emp.name)
                  }
                  className="py-2 rounded-xl bg-red-600"
                >
                  Delete
                </button>

              </div>

            </motion.div>
          ))}

        </div>
      )}

      {/* EDITOR */}
      {editor && (
        <Modal
          title={`Edit ${editor.name}`}
          close={() => setEditor(null)}
        >

          <div className="space-y-6">

  {/* PERSONAL */}
  <div>
    <h3 className="text-sm font-semibold text-indigo-400 mb-3">
      Personal
    </h3>

    <div className="grid md:grid-cols-2 gap-4">
      <Field label="Full Name" value={form.name} onChange={(v)=>setForm({...form,name:v})} />
      <Field label="Phone Number" value={form.phone} onChange={(v)=>setForm({...form,phone:v})} />
      <Field label="Department" value={form.department} onChange={(v)=>setForm({...form,department:v})} />
      <Field label="Job Title" value={form.job_title} onChange={(v)=>setForm({...form,job_title:v})} />
      <Field label="Start Date" type="date" value={form.start_date} onChange={(v)=>setForm({...form,start_date:v})} />
      <Field label="Status" value={form.status} onChange={(v)=>setForm({...form,status:v})} />
    </div>
  </div>

  {/* PAY */}
  <div>
    <h3 className="text-sm font-semibold text-emerald-400 mb-3">
      Pay & Hours
    </h3>

    <div className="grid md:grid-cols-2 gap-4">
      <Field label="Hourly Rate (£)" value={form.hourly_rate} onChange={(v)=>setForm({...form,hourly_rate:v})} />
      <Field label="Overtime Rate (£)" value={form.overtime_rate} onChange={(v)=>setForm({...form,overtime_rate:v})} />
      <Field label="Night Rate (£)" value={form.night_rate} onChange={(v)=>setForm({...form,night_rate:v})} />
      <Field label="Contracted Hours" value={form.contracted_hours} onChange={(v)=>setForm({...form,contracted_hours:v})} />
    </div>
  </div>

  {/* LEAVE */}
  <div>
    <h3 className="text-sm font-semibold text-yellow-400 mb-3">
      Leave
    </h3>

    <div className="grid md:grid-cols-2 gap-4">
      <Field label="Holiday Allowance" value={form.holiday_allowance} onChange={(v)=>setForm({...form,holiday_allowance:v})} />
      <Field label="Role" value={form.role} onChange={(v)=>setForm({...form,role:v})} />
    </div>
  </div>

  {/* ADVANCED */}
  <div>
    <h3 className="text-sm font-semibold text-gray-400 mb-3">
      Advanced
    </h3>

    <div className="grid md:grid-cols-2 gap-4">
      <Field label="Payroll ID" value={form.payroll_id} onChange={(v)=>setForm({...form,payroll_id:v})} />
      <Field label="Emergency Contact" value={form.emergency_contact} onChange={(v)=>setForm({...form,emergency_contact:v})} />
    </div>
  </div>

</div>

    

<div 

className="sticky bottom-0 mt-6 pt-4 bg-[#020617]">

  <button
    onClick={saveEditor}
    disabled={saving}
    className="w-full py-3 rounded-xl bg-indigo-600 flex justify-center gap-2"
  >
    <Save size={16} />
    {saving ? "Saving..." : "Save Changes"}
  </button>
</div>

        </Modal>
      )}

      {/* INVITE */}
      {inviteOpen && (
        <Modal
          title="Invite Employee"
          close={() => setInviteOpen(false)}
        >

          <input
            value={inviteEmail}
            onChange={(e)=>setInviteEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10"
          />

          <select
            value={inviteRole}
            onChange={(e)=>setInviteRole(e.target.value)}
            className="w-full mt-3 px-4 py-3 rounded-xl bg-slate-900 border border-white/10"
          >
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>

          <button
            onClick={sendInvite}
            disabled={saving}
            className="w-full mt-4 py-3 rounded-xl bg-indigo-600"
          >
            Send Invite
          </button>

        </Modal>
      )}

    </div>
  );
}

/* COMPONENTS */

function UserRow({ emp }) {
  return (
    <div className="flex gap-3 items-center">
      <div className="w-11 h-11 rounded-full bg-indigo-600 flex items-center justify-center">
        {(emp.name || emp.email || "?").charAt(0).toUpperCase()}
      </div>

      <div>
        <p>{emp.name || "Unnamed"}</p>
        <p className="text-xs text-gray-400">{emp.email}</p>
      </div>
    </div>
  );
}

function Card({ title, value, icon }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#020617] p-5">
      <div className="flex justify-between">
        <p className="text-xs text-gray-400">{title}</p>
        <div className="text-indigo-400">{icon}</div>
      </div>

      <h2 className="text-2xl font-semibold mt-2">
        {value}
      </h2>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}) {
  function formatDate(v) {
    if (!v) return "";
    return new Date(v).toISOString().slice(0, 10);
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">
        {label}
      </p>

      <input
        type={type}
        value={
          type === "date"
            ? formatDate(value)
            : value || ""
        }
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10"
      />
    </div>
  );
}

function Modal({ title, close, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4 py-6">

      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#020617] border border-white/10 p-6">

        <div className="flex justify-between mb-4">
          <h2 className="font-semibold">{title}</h2>

          <button onClick={close}>
            <X size={18} />
          </button>
        </div>

        {children}

      </div>

    </div>
  );
}