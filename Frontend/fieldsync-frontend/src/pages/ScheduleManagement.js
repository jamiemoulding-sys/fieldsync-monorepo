import React, { useState, useEffect } from 'react';
import { shiftAPI, locationAPI, taskAPI, uploadAPI } from '../services/api';
import HomeButton from '../components/HomeButton';

function ScheduleManagement() {
  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [formData, setFormData] = useState({
    employee_id: '',
    shift_start: '',
    shift_end: '',
    days_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    location_id: '',
    late_threshold: 15 // minutes
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [employeesData, schedulesData] = await Promise.all([
        ApiService.getUsers(),
        ApiService.getSchedules()
      ]);
      setEmployees(Array.isArray(employeesData) ? employeesData : employeesData.data || []);
      setSchedules(Array.isArray(schedulesData) ? schedulesData : schedulesData.data || []);
    } catch (error) {
      // Silently handle API errors during development
      // console.log('Load data error:', error);
      // Don't show error for development, just log it
      // setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const scheduleData = {
        ...formData,
        employee_id: selectedEmployee
      };

      if (editingSchedule) {
        await ApiService.updateSchedule(editingSchedule.id, scheduleData);
        setSuccess('Schedule updated successfully');
      } else {
        await ApiService.createSchedule(scheduleData);
        setSuccess('Schedule created successfully');
      }

      setShowModal(false);
      setEditingSchedule(null);
      setSelectedEmployee('');
      setFormData({
        employee_id: '',
        shift_start: '',
        shift_end: '',
        days_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        location_id: '',
        late_threshold: 15
      });
      
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message || 'Failed to save schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (schedule) => {
    setEditingSchedule(schedule);
    setSelectedEmployee(schedule.employee_id);
    setFormData({
      employee_id: schedule.employee_id,
      shift_start: schedule.shift_start,
      shift_end: schedule.shift_end,
      days_of_week: schedule.days_of_week || [],
      location_id: schedule.location_id || '',
      late_threshold: schedule.late_threshold || 15
    });
    setShowModal(true);
  };

  const handleDelete = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    
    try {
      await ApiService.deleteSchedule(scheduleId);
      setSuccess('Schedule deleted successfully');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message || 'Failed to delete schedule');
    }
  };

  const handleDayToggle = (day) => {
    const currentDays = formData.days_of_week;
    if (currentDays.includes(day)) {
      setFormData({
        ...formData,
        days_of_week: currentDays.filter(d => d !== day)
      });
    } else {
      setFormData({
        ...formData,
        days_of_week: [...currentDays, day]
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading schedules...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📅 Schedule Management</h1>
            <p className="text-gray-600 mt-2">Manage employee schedules and late arrival alerts</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setEditingSchedule(null);
                setSelectedEmployee('');
                setFormData({
                  employee_id: '',
                  shift_start: '',
                  shift_end: '',
                  days_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                  location_id: '',
                  late_threshold: 15
                });
                setShowModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <span>➕</span>
              <span>Add Schedule</span>
            </button>
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

        {/* Schedules Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shift Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Late Threshold
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {schedules.map((schedule) => {
                const employee = employees.find(emp => emp.id === schedule.employee_id);
                return (
                  <tr key={schedule.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {employee ? employee.name : 'Unknown Employee'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {schedule.shift_start} - {schedule.shift_end}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {(schedule.days_of_week || []).join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {schedule.late_threshold || 15} minutes
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(schedule)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {schedules.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No schedules found. Add your first schedule above.
            </div>
          )}
        </div>

        {/* Schedule Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                {editingSchedule ? 'Edit Schedule' : 'Add Schedule'}
              </h3>
              
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee
                  </label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.filter(emp => emp.role === 'employee').map(employee => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shift Start
                  </label>
                  <input
                    type="time"
                    value={formData.shift_start}
                    onChange={(e) => setFormData({...formData, shift_start: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shift End
                  </label>
                  <input
                    type="time"
                    value={formData.shift_end}
                    onChange={(e) => setFormData({...formData, shift_end: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Days of Week
                  </label>
                  <div className="space-y-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                      <label key={day} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.days_of_week.includes(day)}
                          onChange={() => handleDayToggle(day)}
                          className="mr-2"
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Late Threshold (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.late_threshold}
                    onChange={(e) => setFormData({...formData, late_threshold: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Schedule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScheduleManagement;
