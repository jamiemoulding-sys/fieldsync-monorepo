import { useEffect, useMemo, useState } from "react";
import { reportAPI, userAPI } from "../services/api";
import jsPDF from "jspdf";
import moment from "moment";

/* ================= HELPERS ================= */

function hours(start, end, breakSec = 0) {
  if (!start || !end) return 0;
  return (new Date(end) - new Date(start)) / 3600000 - breakSec / 3600;
}

function money(v) {
  return `£${Number(v || 0).toFixed(2)}`;
}

/* ================= CALC ================= */

function calculate(user, shifts) {
  let gross = 0;
  let hoursWorked = 0;

  shifts.forEach((s) => {
    const h = hours(s.clock_in_time, s.clock_out_time, s.total_break_seconds);
    hoursWorked += h;
    gross += h * Number(user.hourly_rate || 0);
  });

  const tax = gross * 0.2;
  const ni = gross * 0.12;
  const pension = gross * 0.05;
  const net = gross - tax - ni - pension;

  return { gross, tax, ni, pension, net, hours_worked: hoursWorked };
}

/* ================= PDF ================= */

function generatePayslip(emp, company, fromDate, toDate, returnBlob = false) {
  const doc = new jsPDF();

  let y = 20;

  // HEADER
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 30, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("FieldSync", 20, 18);

  doc.setFontSize(12);
  doc.text(company?.name || "Company", 150, 18);

  doc.setTextColor(0, 0, 0);
  y = 40;

  doc.setFontSize(18);
  doc.text("Payslip", 20, y);

  y += 10;

  // INFO BOX
  doc.rect(20, y, 170, 35);

  doc.setFontSize(10);
  doc.text("Employee", 25, y + 8);
  doc.text(emp.name, 25, y + 15);

  doc.text("Pay Date", 110, y + 8);
  doc.text(moment().format("DD/MM/YYYY"), 110, y + 15);

  doc.text("Period", 110, y + 25);
  doc.text(`${fromDate} → ${toDate}`, 110, y + 32);

  y += 50;

  // EARNINGS
  doc.setFontSize(12);
  doc.text("Earnings", 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.text("Basic Pay", 20, y);
  doc.text(money(emp.gross), 150, y);

  y += 12;
  doc.setFontSize(11);
  doc.text("Total Earnings", 20, y);
  doc.text(money(emp.gross), 150, y);

  y += 20;

  // DEDUCTIONS
  doc.setFontSize(12);
  doc.text("Deductions", 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.text("Tax", 20, y);
  doc.text(`-${money(emp.tax)}`, 150, y);

  y += 6;
  doc.text("NI", 20, y);
  doc.text(`-${money(emp.ni)}`, 150, y);

  y += 6;
  doc.text("Pension", 20, y);
  doc.text(`-${money(emp.pension)}`, 150, y);

  y += 12;
  doc.setFontSize(11);
  doc.text("Total Deductions", 20, y);
  doc.text(`-${money(emp.tax + emp.ni + emp.pension)}`, 150, y);

  y += 20;

  // NET PAY
  doc.setFillColor(220, 252, 231);
  doc.rect(20, y, 170, 18, "F");

  doc.setFontSize(14);
  doc.text("Net Pay", 25, y + 12);
  doc.text(money(emp.net), 140, y + 12);

  if (returnBlob) return doc.output("blob");

  doc.save(`payslip_${emp.name}.pdf`);
}

/* ================= MAIN ================= */

export default function PayrollExport() {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [stored, setStored] = useState([]);
  const [company, setCompany] = useState(null);

  const [fromDate, setFromDate] = useState(
    new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]
  );
  const [toDate, setToDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    load();

    const storedCompany = localStorage.getItem("company");
    if (storedCompany) setCompany(JSON.parse(storedCompany));
  }, []);

  async function load() {
    const [timesheets, staff, storedDocs] = await Promise.all([
      reportAPI.getTimesheets(),
      userAPI.getAll(),
      reportAPI.getPayslips?.() || [],
    ]);

    setRows(timesheets || []);
    setUsers(staff || []);
    setStored(storedDocs || []);
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const d = r.clock_in_time?.split("T")[0];
      return d >= fromDate && d <= toDate;
    });
  }, [rows, fromDate, toDate]);

  const payroll = useMemo(() => {
    return users.map((u) => {
      const userRows = filtered.filter((r) => r.user_id === u.id);
      const calc = calculate(u, userRows);

      const saved = stored.find((s) => s.employee_id === u.id || s.user_id === u.id);

      return {
        ...u,
        ...calc,
        status: saved ? "Saved" : "Draft",
      };
    });
  }, [users, filtered, stored]);

  /* ================= ACTIONS ================= */

  async function download(emp) {
    generatePayslip(emp, company, fromDate, toDate);
  }

  async function save(emp) {
    const blob = generatePayslip(emp, company, fromDate, toDate, true);

    const formData = new FormData();
    formData.append("file", blob, `payslip_${emp.name}.pdf`);
    formData.append("employee_id", emp.id);
    formData.append("pay_period_start", fromDate);
    formData.append("pay_period_end", toDate);
    formData.append("gross_pay", String(emp.gross));
    formData.append("net_pay", String(emp.net));
    formData.append("hours_worked", String(emp.hours_worked || 0));
    formData.append("publish", "false");

    await reportAPI.savePayslip(formData);
    load();
  }

  async function send(emp) {
    const blob = generatePayslip(emp, company, fromDate, toDate, true);

    const formData = new FormData();
    formData.append("file", blob, `payslip_${emp.name}.pdf`);
    formData.append("employee_id", emp.id);
    formData.append("pay_period_start", fromDate);
    formData.append("pay_period_end", toDate);
    formData.append("gross_pay", String(emp.gross));
    formData.append("net_pay", String(emp.net));
    formData.append("hours_worked", String(emp.hours_worked || 0));
    formData.append("publish", "true");

    await reportAPI.savePayslip(formData);
    load();
  }

  async function resend(doc) {
    await reportAPI.publishPayslip(doc.id);
    load();
  }

  async function viewStored(doc) {
    const data = await reportAPI.getPayslipById(doc.id);
    if (data?.view_url) {
      window.open(data.view_url, "_blank", "noopener,noreferrer");
    }
  }

  /* ================= UI ================= */

  return (
    <div className="p-6 space-y-6">

      <h1 className="text-2xl font-bold">Payroll Dashboard</h1>

      {/* FILTER */}
      <div className="flex gap-4">
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
      </div>

      {/* PAYROLL TABLE */}
      <div className="border rounded-xl overflow-auto">
        <table className="w-full text-sm">

          <thead className="bg-white/5">
            <tr>
              <th className="p-3 text-left">Employee</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {payroll.map((r) => (
              <tr key={r.id} className="border-t hover:bg-white/5">

                <td className="p-3 font-medium">{r.name}</td>

                <td>{money(r.gross)}</td>
                <td className="font-semibold">{money(r.net)}</td>

                <td>
                  <span className={`px-2 py-1 rounded text-xs ${
                    r.status === "Saved"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {r.status}
                  </span>
                </td>

                <td className="flex gap-2 p-2">
                  <button onClick={() => download(r)} className="bg-indigo-600 px-2 py-1 rounded">Download</button>
                  <button onClick={() => save(r)} className="bg-blue-600 px-2 py-1 rounded">Save</button>
                  <button onClick={() => send(r)} className="bg-green-600 px-2 py-1 rounded">Send</button>
                </td>

              </tr>
            ))}
          </tbody>

        </table>
      </div>

      {/* STORED */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Stored Payslips</h2>

        <div className="border rounded-xl overflow-auto">
          <table className="w-full text-sm">

            <tbody>
              {stored.map((doc) => (
                <tr key={doc.id} className="border-t">

                  <td className="p-3">{doc.employee_name || doc.user_name}</td>
                  <td>{doc.sent_at || doc.created_at}</td>

                  <td className="flex gap-2">
                    <button onClick={() => viewStored(doc)} className="bg-indigo-600 px-2 py-1 rounded">
                      View
                    </button>

                    <button onClick={() => resend(doc)} className="bg-green-600 px-2 py-1 rounded">
                      Resend
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        </div>
      </div>

    </div>
  );
}
