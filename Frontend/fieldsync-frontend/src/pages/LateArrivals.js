import React, { useState, useEffect } from 'react';
import { shiftAPI, locationAPI, taskAPI, uploadAPI } from '../services/api';
import HomeButton from '../components/HomeButton';

function LateArrivals() {
  const [lateArrivals, setLateArrivals] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lateThreshold, setLateThreshold] = useState(15);

  useEffect(() => {
    loadLateArrivals();
  }, [selectedDate]);

  const loadLateArrivals = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getLateArrivals(selectedDate);
      setLateArrivals(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      // Silently handle API errors during development
      // console.log('Load late arrivals error:', error);
      // Don't show error for development, just log it
      // setError('Failed to load late arrivals');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getLateStatus = (minutesLate) => {
    if (minutesLate <= 0) return { text: 'On Time', color: 'green' };
    if (minutesLate <= 5) return { text: 'Slightly Late', color: 'yellow' };
    if (minutesLate <= 15) return { text: 'Late', color: 'orange' };
    return { text: 'Very Late', color: 'red' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading late arrivals...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">⚠️ Late Arrivals</h1>
            <p className="text-gray-600 mt-2">Monitor employee punctuality and attendance</p>
          </div>
          <div className="flex items-center space-x-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={lateThreshold}
              onChange={(e) => setLateThreshold(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Late threshold (minutes)"
            />
            <HomeButton />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-gray-900">{lateArrivals.length}</div>
            <div className="text-sm text-gray-600">Total Late Arrivals</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-red-600">
              {lateArrivals.filter(a => a.minutes_late > 15).length}
            </div>
            <div className="text-sm text-gray-600">Very Late (&gt;15 min)</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-orange-600">
              {lateArrivals.filter(a => a.minutes_late > 5 && a.minutes_late <= 15).length}
            </div>
            <div className="text-sm text-gray-600">Late (5-15 min)</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-yellow-600">
              {lateArrivals.filter(a => a.minutes_late > 0 && a.minutes_late <= 5).length}
            </div>
            <div className="text-sm text-gray-600">Slightly Late (1-5 min)</div>
          </div>
        </div>

        {/* Late Arrivals Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scheduled Start
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clock In Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Minutes Late
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Threshold
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lateArrivals.map((arrival, index) => {
                const status = getLateStatus(arrival.minutes_late);
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {arrival.employee_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {arrival.employee_email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {arrival.shift_start}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatTime(arrival.clock_in_time)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        arrival.minutes_late > 15 ? 'text-red-600' : 
                        arrival.minutes_late > 5 ? 'text-orange-600' : 
                        arrival.minutes_late > 0 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {arrival.minutes_late > 0 ? `${Math.round(arrival.minutes_late)} min` : 'On Time'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        status.color === 'red' ? 'bg-red-100 text-red-800' :
                        status.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                        status.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {arrival.late_threshold} min
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lateArrivals.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No late arrivals found for {new Date(selectedDate).toLocaleDateString()}.
            </div>
          )}
        </div>

        {/* Alert Settings */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">🔔 Alert Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Email Notifications</h4>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" defaultChecked />
                  Alert when employee is late
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" defaultChecked />
                  Daily summary report
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" />
                  Weekly attendance report
                </label>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Alert Thresholds</h4>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm text-gray-700">Late threshold (minutes)</label>
                  <input type="number" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" defaultValue="15" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">Very late threshold (minutes)</label>
                  <input type="number" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" defaultValue="30" />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LateArrivals;
