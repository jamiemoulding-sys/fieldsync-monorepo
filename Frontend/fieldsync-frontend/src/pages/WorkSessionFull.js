import React, { useState, useEffect } from 'react';
import { shiftAPI, locationAPI, taskAPI, uploadAPI } from '../services/api';

function WorkSession() {
  const [activeShift, setActiveShift] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [shiftsResponse, locationsResponse] = await Promise.all([
        ApiService.getActiveShift(),
        ApiService.getLocations()
      ]);

      setActiveShift(shiftsResponse.data);
      setLocations(locationsResponse.data);

      if (shiftsResponse.data) {
        setSelectedLocation(shiftsResponse.data.location_id);
      }

      // Get GPS location
      try {
        const location = await ApiService.getCurrentPosition();
        setGpsLocation(location);
      } catch (gpsError) {
        console.warn('GPS not available:', gpsError);
      }
    } catch (error) {
      setError('Failed to load work session data');
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    if (!selectedLocation) {
      setError('Please select a location');
      return;
    }

    if (!gpsLocation) {
      setError('GPS location is required for clock in');
      return;
    }

    try {
      setError('');
      setLoading(true);
      
      const response = await ApiService.clockIn(
        selectedLocation, 
        gpsLocation.lat, 
        gpsLocation.lng
      );

      setActiveShift(response.data.shift);
      setSuccess(`Successfully clocked in at ${new Date().toLocaleTimeString()}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.error || 'Failed to clock in');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!gpsLocation) {
      setError('GPS location is required for clock out');
      return;
    }

    try {
      setError('');
      setLoading(true);
      
      await ApiService.clockOut(gpsLocation.lat, gpsLocation.lng);
      
      setActiveShift(null);
      setSelectedLocation(null);
      setSuccess(`Successfully clocked out at ${new Date().toLocaleTimeString()}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.error || 'Failed to clock out');
    } finally {
      setLoading(false);
    }
  };

  const refreshGPS = async () => {
    try {
      setError('');
      const location = await ApiService.getCurrentPosition();
      setGpsLocation(location);
      setSuccess('GPS location updated');
      setTimeout(() => setSuccess(''), 2000);
    } catch (error) {
      setError('Failed to get GPS location');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading work session...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">⏰ Work Session</h1>
          <p className="text-gray-600 mt-2">Manage your clock in/out with GPS tracking</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        {!activeShift ? (
          // Clock In Form
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">📍 Clock In</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Location
                </label>
                <select
                  value={selectedLocation || ''}
                  onChange={(e) => setSelectedLocation(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a location...</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      📍 {location.name} - {location.address}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-blue-900 mb-1">📍 GPS Location</h3>
                    {gpsLocation ? (
                      <div className="text-sm text-blue-700">
                        <p>Latitude: {gpsLocation.lat.toFixed(6)}</p>
                        <p>Longitude: {gpsLocation.lng.toFixed(6)}</p>
                        <p>Accuracy: ±{gpsLocation.accuracy.toFixed(0)}m</p>
                      </div>
                    ) : (
                      <p className="text-sm text-blue-700">GPS not available</p>
                    )}
                  </div>
                  <button
                    onClick={refreshGPS}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>

              <button
                onClick={handleClockIn}
                disabled={!selectedLocation || !gpsLocation || loading}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <span>⏰</span>
                <span>{loading ? 'Processing...' : 'Clock In'}</span>
              </button>
            </div>
          </div>
        ) : (
          // Active Shift View
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">✅ Active Shift</h2>
                  <p className="text-gray-600">
                    📍 {locations.find(l => l.id === activeShift.location_id)?.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    Clocked in at {new Date(activeShift.clock_in_time).toLocaleTimeString()}
                  </p>
                  {gpsLocation && (
                    <p className="text-xs text-gray-500 mt-1">
                      Current GPS: {gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleClockOut}
                  disabled={loading}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <span>⏰</span>
                  <span>{loading ? 'Processing...' : 'Clock Out'}</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Shift Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="font-medium">{locations.find(l => l.id === activeShift.location_id)?.name}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Clock In Time</p>
                  <p className="font-medium">{new Date(activeShift.clock_in_time).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Clock In GPS</p>
                  <p className="font-medium text-xs">
                    {activeShift.gps_lat?.toFixed(4)}, {activeShift.gps_lng?.toFixed(4)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="font-medium">
                    {Math.floor((new Date() - new Date(activeShift.clock_in_time)) / (1000 * 60 * 60))}h 
                    {Math.floor(((new Date() - new Date(activeShift.clock_in_time)) % (1000 * 60 * 60)) / (1000 * 60))}m
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkSession;
