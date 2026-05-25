import React, { useState, useEffect } from 'react';
import { shiftAPI, taskAPI, locationAPI, uploadAPI } from '../services/api';
import { shiftAPI, locationAPI, taskAPI, uploadAPI } from '../services/api';
import { OfflineStorage, OvertimeCalculator } from '../services/offlineStorage';
import HomeButton from '../components/HomeButton';
import { 
  Clock, MapPin, Camera, CheckCircle, 
  AlertCircle, List, Wifi, WifiOff 
} from 'lucide-react';

function WorkSession() {
  const [activeShift, setActiveShift] = useState(null);
  const [locations, setLocations] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location] = useState({ lat: 40.7128, lng: -74.0060 }); // Mock location
  const [geofenceInfo, setGeofenceInfo] = useState(null);
  const [distanceToLocation, setDistanceToLocation] = useState(null);
  const [mySchedule, setMySchedule] = useState([]);
  const [lateAlert, setLateAlert] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineStorage, setOfflineStorage] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ pendingClockRecords: 0, pendingOvertimeAlerts: 0 });
  const [overtimeAlert, setOvertimeAlert] = useState(null);
  const [workSessionStartTime, setWorkSessionStartTime] = useState(null);

  useEffect(() => {
    initializeOfflineStorage();
    loadData();
    
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineData();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Check for overtime every minute
    const interval = setInterval(() => {
      if (activeShift && workSessionStartTime) {
        checkOvertime();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [activeShift, workSessionStartTime]);

  const initializeOfflineStorage = async () => {
    try {
      const storage = new OfflineStorage();
      await storage.init();
      setOfflineStorage(storage);
      
      // Load sync status
      const status = await storage.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to initialize offline storage:', error);
    }
  };

  const syncOfflineData = async () => {
    if (!offlineStorage || !isOnline) return;

    try {
      setError('');
      
      // Sync clock records
      const clockRecords = await offlineStorage.getUnsyncedClockRecords();
      for (const record of clockRecords) {
        try {
          if (record.type === 'clock_in') {
            await shiftAPI.clockIn({
              location_id: record.locationId,
              gps_lat: record.gpsLat,
              gps_lng: record.gpsLng
            });
          } else if (record.type === 'clock_out') {
            await shiftAPI.clockOut({
              gps_lat: record.gpsLat,
              gps_lng: record.gpsLng
            });
          }
          
          await offlineStorage.markClockRecordSynced(record.id);
        } catch (error) {
          console.error('Failed to sync clock record:', error);
        }
      }

      // Sync overtime alerts
      const overtimeAlerts = await offlineStorage.getUnsyncedOvertimeAlerts();
      for (const alert of overtimeAlerts) {
        try {
          await ApiService.createOvertimeAlert(alert);
          await offlineStorage.markOvertimeAlertSynced(alert.id);
        } catch (error) {
          console.error('Failed to sync overtime alert:', error);
        }
      }

      // Update sync status
      const status = await offlineStorage.getSyncStatus();
      setSyncStatus(status);
      
      // Save last sync time
      await offlineStorage.saveUserData('lastSyncTime', new Date().toISOString());
      
    } catch (error) {
      console.error('Sync failed:', error);
      setError('Failed to sync offline data');
    }
  };

  const checkOvertime = async () => {
    if (!activeShift || !workSessionStartTime) return;

    const now = new Date();
    const overtimeData = OvertimeCalculator.checkOvertimeThreshold(
      workSessionStartTime, 
      now.toISOString(), 
      8 // Standard 8-hour workday
    );

    if (overtimeData.isOvertime) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const alert = OvertimeCalculator.generateOvertimeAlert(user, {
        ...overtimeData,
        clockInTime: workSessionStartTime,
        clockOutTime: now.toISOString()
      });

      setOvertimeAlert(alert);

      // Save alert to offline storage
      if (offlineStorage) {
        await offlineStorage.saveOvertimeAlert(alert);
      }

      // Send to server if online
      if (isOnline) {
        try {
          await ApiService.createOvertimeAlert(alert);
        } catch (error) {
          console.error('Failed to send overtime alert:', error);
        }
      }
    }
  };

  const loadData = async () => {
    try {
      let shiftsResponse, locationsResponse, scheduleResponse;

      if (isOnline) {
        // Load from server
        [shiftsResponse, locationsResponse, scheduleResponse] = await Promise.all([
          shiftAPI.getActive(),
          locationAPI.getLocations(),
          ApiService.getMySchedule()
        ]);
        
        // Cache data for offline use
        if (offlineStorage) {
          await offlineStorage.saveUserData('cachedShifts', shiftsResponse);
          await offlineStorage.saveUserData('cachedLocations', locationsResponse);
          await offlineStorage.saveSchedules(Array.isArray(scheduleResponse) ? scheduleResponse : scheduleResponse.data || []);
        }
      } else {
        // Load from offline storage
        if (offlineStorage) {
          shiftsResponse = await offlineStorage.getUserData('cachedShifts');
          locationsResponse = await offlineStorage.getUserData('cachedLocations');
          scheduleResponse = await offlineStorage.getSchedules();
        }
      }
      
      setActiveShift(shiftsResponse?.data || shiftsResponse);
      setLocations(locationsResponse?.data || locationsResponse);
      setMySchedule(Array.isArray(scheduleResponse) ? scheduleResponse : scheduleResponse?.data || []);
      
      // Check for late arrival alerts
      checkLateArrival(scheduleResponse);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const checkLateArrival = (schedules) => {
    const now = new Date();
    const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    
    const scheduleList = Array.isArray(schedules) ? schedules : schedules?.data || [];
    
    for (const schedule of scheduleList) {
      if (schedule.days_of_week && schedule.days_of_week.includes(currentDay)) {
        const scheduledStart = schedule.shift_start;
        const threshold = schedule.late_threshold || 15;
        
        // Convert times to minutes for comparison
        const currentMinutes = parseInt(currentTime.split(':')[0]) * 60 + parseInt(currentTime.split(':')[1]);
        const scheduledMinutes = parseInt(scheduledStart.split(':')[0]) * 60 + parseInt(scheduledStart.split(':')[1]);
        
        if (currentMinutes > scheduledMinutes + threshold) {
          setLateAlert({
            message: `You are ${Math.round((currentMinutes - scheduledMinutes))} minutes late!`,
            severity: currentMinutes > scheduledMinutes + 30 ? 'high' : 'medium',
            scheduledTime: scheduledStart,
            actualTime: currentTime
          });
          break;
        }
      }
    }
  };

  const handleClockIn = async () => {
    if (!selectedLocation) {
      setError('Please select a location');
      return;
    }

    try {
      setError('');
      const clockInData = {
        type: 'clock_in',
        locationId: selectedLocation,
        gpsLat: location.lat,
        gpsLng: location.lng,
        timestamp: new Date().toISOString()
      };

      if (isOnline) {
        // Try to sync with server first
        try {
          const response = await shiftAPI.clockIn({
            location_id: selectedLocation,
            gps_lat: location.lat,
            gps_lng: location.lng
          });
          setActiveShift(response.data.shift);
          setWorkSessionStartTime(new Date().toISOString());
        } catch (serverError) {
          // If server fails, save to offline storage
          if (offlineStorage) {
            await offlineStorage.saveClockRecord(clockInData);
            setActiveShift({ id: 'offline-' + Date.now(), clock_in_time: clockInData.timestamp });
            setWorkSessionStartTime(clockInData.timestamp);
          }
          throw serverError;
        }
      } else {
        // Save to offline storage
        if (offlineStorage) {
          await offlineStorage.saveClockRecord(clockInData);
          setActiveShift({ id: 'offline-' + Date.now(), clock_in_time: clockInData.timestamp });
          setWorkSessionStartTime(clockInData.timestamp);
        }
      }
    } catch (error) {
      console.error('Clock in error:', error);
      if (!isOnline && offlineStorage) {
        // Expected behavior for offline mode
        return;
      }
      setError(error.response?.data?.error || 'Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    if (!activeShift) {
      setError('No active shift found');
      return;
    }

    try {
      setError('');
      const clockOutTime = new Date().toISOString();
      
      // Check for overtime before clocking out
      if (workSessionStartTime) {
        const overtimeData = OvertimeCalculator.checkOvertimeThreshold(
          workSessionStartTime, 
          clockOutTime, 
          8
        );

        if (overtimeData.isOvertime) {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          const alert = OvertimeCalculator.generateOvertimeAlert(user, {
            ...overtimeData,
            clockInTime: workSessionStartTime,
            clockOutTime: clockOutTime
          });

          setOvertimeAlert(alert);

          // Save alert to offline storage
          if (offlineStorage) {
            await offlineStorage.saveOvertimeAlert(alert);
          }

          // Send to server if online
          if (isOnline) {
            try {
              await ApiService.createOvertimeAlert(alert);
            } catch (error) {
              console.error('Failed to send overtime alert:', error);
            }
          }
        }
      }

      const clockOutData = {
        type: 'clock_out',
        gpsLat: location.lat,
        gpsLng: location.lng,
        timestamp: clockOutTime
      };

      if (isOnline) {
        // Try to sync with server first
        try {
          await shiftAPI.clockOut({
            gps_lat: location.lat,
            gps_lng: location.lng
          });
          setActiveShift(null);
          setWorkSessionStartTime(null);
          setTasks([]);
        } catch (serverError) {
          // If server fails, save to offline storage
          if (offlineStorage) {
            await offlineStorage.saveClockRecord(clockOutData);
            setActiveShift(null);
            setWorkSessionStartTime(null);
            setTasks([]);
          }
          throw serverError;
        }
      } else {
        // Save to offline storage
        if (offlineStorage) {
          await offlineStorage.saveClockRecord(clockOutData);
          setActiveShift(null);
          setWorkSessionStartTime(null);
          setTasks([]);
        }
      }
    } catch (error) {
      console.error('Clock out error:', error);
      if (!isOnline && offlineStorage) {
        // Expected behavior for offline mode
        return;
      }
      setError(error.response?.data?.error || 'Failed to clock out');
    }
  };

  const loadTasks = async (locationId) => {
    try {
      if (isOnline) {
        const response = await taskAPI.getTasks({ location_id: locationId });
        setTasks(response.data);
      } else {
        // Load cached tasks or return empty array
        setTasks([]);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    }
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Loading work session...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">⏰ Work Session</h1>
              <p className="text-gray-600 mt-2">Clock in/out and track work time</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center px-3 py-1 rounded-lg ${
                isOnline ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {isOnline ? <Wifi className="h-4 w-4 mr-1" /> : <WifiOff className="h-4 w-4 mr-1" />}
                <span className="text-sm font-medium">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              {syncStatus.pendingClockRecords > 0 && (
                <div className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg">
                  <span className="text-sm font-medium">
                    {syncStatus.pendingClockRecords} pending sync
                  </span>
                </div>
              )}
              <HomeButton />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center mb-4">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

          {lateAlert && (
            <div className={`border px-4 py-3 rounded-lg flex items-center mb-4 ${
              lateAlert.severity === 'high' 
                ? 'bg-red-50 border-red-200 text-red-700' 
                : 'bg-orange-50 border-orange-200 text-orange-700'
            }`}>
              <AlertCircle className="h-5 w-5 mr-2" />
              <div>
                <p className="font-medium">{lateAlert.message}</p>
                <p className="text-sm">
                  Scheduled: {lateAlert.scheduledTime} | Current: {lateAlert.actualTime}
                </p>
              </div>
            </div>
          )}

          {overtimeAlert && (
            <div className={`border px-4 py-3 rounded-lg flex items-center mb-4 ${
              overtimeAlert.alertLevel === 'high' 
                ? 'bg-red-50 border-red-200 text-red-700' 
                : overtimeAlert.alertLevel === 'medium'
                ? 'bg-orange-50 border-orange-200 text-orange-700'
                : 'bg-yellow-50 border-yellow-200 text-yellow-700'
            }`}>
              <AlertCircle className="h-5 w-5 mr-2" />
              <div>
                <p className="font-medium">⏰ Overtime Alert</p>
                <p className="text-sm">{overtimeAlert.message}</p>
                <p className="text-xs mt-1">
                  Total: {overtimeAlert.totalHours}h | Regular: {overtimeAlert.regularHours}h | Overtime: {overtimeAlert.overtimeHours}h
                </p>
              </div>
            </div>
          )}

          {!activeShift ? (
            // Clock In Form
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Clock In</h2>
              
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
                        {location.name} - {location.address}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleClockIn}
                  disabled={!selectedLocation}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <Clock className="h-5 w-5" />
                  <span>Clock In</span>
                </button>
              </div>
            </div>
          ) : (
            // Active Shift Display
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Active Shift</h2>
              
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    <div>
                      <p className="font-medium">Shift Active</p>
                      <p className="text-sm">
                        Started: {workSessionStartTime ? new Date(workSessionStartTime).toLocaleString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleClockOut}
                  className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <Clock className="h-5 w-5" />
                  <span>Clock Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default WorkSession;
