
import React, { useEffect, useState } from 'react';
import { reportAPI } from '../services/api';
import HomeButton from '../components/HomeButton';

function Admin() {
  const [data, setData] = useState([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await reportAPI.getTimesheets();
      setData(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to load timesheets');
    }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Clock In', 'Clock Out', 'Hours'];

    const rows = data.map(d => [
      d.name,
      d.email,
      new Date(d.clock_in_time).toLocaleString(),
      new Date(d.clock_out_time).toLocaleString(),
      Number(d.hours).toFixed(2)
    ]);

    let csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers, ...rows].map(e => e.join(',')).join('\n');

    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = 'timesheets.csv';
    link.click();
  };

  return (
    <div className="space-y-8">

      <div className="flex justify-between items-center">
        <h1 className="heading-1">⚙️ Admin</h1>

        <div className="flex gap-3">
          <HomeButton />
          <button onClick={exportCSV} className="btn-primary">
            📤 Export Timesheet
          </button>
        </div>
      </div>

      <div className="card">
        {data.length === 0 ? (
          <p className="text-gray-400">No data yet</p>
        ) : (
          data.map((row, i) => (
            <div key={i} className="border-b border-gray-700 py-2">
              {row.name} — {Number(row.hours).toFixed(2)} hrs
            </div>
          ))
        )}
      </div>

    </div>
  );
}


export default Admin;