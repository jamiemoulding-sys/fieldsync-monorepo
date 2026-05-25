import React, { useState, useEffect } from 'react';
import { shiftAPI, taskAPI } from '../services/api';
import HomeButton from '../components/HomeButton';

function OvertimeAlerts() {
  const [overtimeAlerts, setOvertimeAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [alertSettings, setAlertSettings] = useState({
    overtimeThreshold: 8,
    alertLevels: {
      low: 0.5,
      medium: 1,
      high: 2
    },
    emailNotifications: true,
    realTimeAlerts: true
  });

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedEmployee]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [alertsRes, usersRes] = await Promise.all([
        shiftAPI.getOvertimeAlerts
          ? shiftAPI.getOvertimeAlerts(selectedDate, selectedEmployee)
          : Promise.resolve({ data: [] }),

        taskAPI.getUsers
          ? taskAPI.getUsers()
          : Promise.resolve({ data: [] })
      ]);

      // ✅ ALWAYS force arrays
      setOvertimeAlerts(Array.isArray(alertsRes?.data) ? alertsRes.data : []);
      setEmployees(Array.isArray(usersRes?.data) ? usersRes.data : []);

    } catch (error) {
      console.error('Load overtime alerts error:', error);
      setOvertimeAlerts([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timeString) => {
    if (!timeString) return 'N/A';
    return new Date(timeString).toLocaleDateString();
  };

  const getAlertLevelColor = (level) => {
    switch (level) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-orange-100 text-orange-800';
      case 'low': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertLevelIcon = (level) => {
    switch (level) {
      case 'high': return 'HIGH';
      case 'medium': return 'MED';
      case 'low': return 'LOW';
      default: return 'NONE';
    }
  };

  // ✅ SAFE reducers
  const calculateTotalOvertime = () => {
    if (!Array.isArray(overtimeAlerts)) return 0;
    return overtimeAlerts.reduce((total, alert) => total + (alert.overtimeHours || 0), 0);
  };

  const calculateTotalRegularHours = () => {
    if (!Array.isArray(overtimeAlerts)) return 0;
    return overtimeAlerts.reduce((total, alert) => total + (alert.regularHours || 0), 0);
  };

  const calculateTotalHours = () => {
    if (!Array.isArray(overtimeAlerts)) return 0;
    return overtimeAlerts.reduce((total, alert) => total + (alert.totalHours || 0), 0);
  };

  const exportToCSV = () => {
    if (!Array.isArray(overtimeAlerts)) return;

    const headers = [
      'Employee Name', 'Employee Email', 'Date', 'Clock In', 'Clock Out',
      'Total Hours', 'Regular Hours', 'Overtime Hours', 'Alert Level', 'Message'
    ];

    const csvContent = [
      headers.join(','),
      ...overtimeAlerts.map(alert => [
        alert.employeeName || 'Unknown',
        alert.employeeEmail || 'N/A',
        formatDate(alert.timestamp),
        formatTime(alert.clockInTime),
        formatTime(alert.clockOutTime),
        alert.totalHours || 0,
        alert.regularHours || 0,
        alert.overtimeHours || 0,
        alert.alertLevel || 'unknown',
        `"${alert.message || 'No message'}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `overtime-alerts-${selectedDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const updateAlertSettings = async () => {
    try {
      if (shiftAPI.updateOvertimeSettings) {
        await shiftAPI.updateOvertimeSettings(alertSettings);
        setSuccess('Alert settings updated successfully');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      setError(error.message || 'Failed to update alert settings');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading overtime alerts...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">⏰ Overtime Alerts</h1>
            <p className="text-gray-600 mt-2">Monitor and manage employee overtime</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportToCSV}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              📊 Export CSV
            </button>
            <HomeButton />
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border rounded"
            />

            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="">All Employees</option>
              {employees
                .filter(emp => emp.role === 'employee')
                .map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
            </select>

          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded shadow">
            {overtimeAlerts.length} Alerts
          </div>
          <div className="bg-white p-4 rounded shadow text-red-600">
            {overtimeAlerts.filter(a => a.alertLevel === 'high').length} High
          </div>
          <div className="bg-white p-4 rounded shadow text-orange-600">
            {calculateTotalOvertime().toFixed(1)}h OT
          </div>
          <div className="bg-white p-4 rounded shadow text-blue-600">
            {calculateTotalHours().toFixed(1)}h Total
          </div>
        </div>

      </div>
    </div>
  );
}

export default OvertimeAlerts;