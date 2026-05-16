/**
 * Attendance Context
 * 
 * Simple React context for attendance state management.
 * Server-authoritative with minimal local state.
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import attendanceService from './AttendanceService';
import apiClient from './APIClient';
import gpsCapture from './GPSCapture';

// Initial state
const initialState = {
  // Server state
  activeShift: null,
  userProfile: null,
  locations: [],
  
  // Local state
  queueStatus: {
    size: 0,
    processing: false,
    lastProcessed: null
  },
  gpsStatus: {
    available: false,
    hasCoordinates: false,
    accuracy: null,
    lastUpdate: null,
    error: null
  },
  networkStatus: {
    online: navigator.onLine,
    lastCheck: null
  },
  
  // UI state
  loading: false,
  error: null,
  lastAction: null
};

// Reducer
const attendanceReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };

    case 'SET_ACTIVE_SHIFT':
      return {
        ...state,
        activeShift: action.payload,
        lastAction: 'active_shift_updated'
      };

    case 'SET_USER_PROFILE':
      return {
        ...state,
        userProfile: action.payload,
        lastAction: 'profile_updated'
      };

    case 'SET_LOCATIONS':
      return {
        ...state,
        locations: action.payload,
        lastAction: 'locations_updated'
      };

    case 'SET_QUEUE_STATUS':
      return {
        ...state,
        queueStatus: {
          ...state.queueStatus,
          ...action.payload
        }
      };

    case 'SET_GPS_STATUS':
      return {
        ...state,
        gpsStatus: {
          ...state.gpsStatus,
          ...action.payload
        }
      };

    case 'SET_NETWORK_STATUS':
      return {
        ...state,
        networkStatus: {
          ...state.networkStatus,
          ...action.payload
        }
      };

    case 'SET_LAST_ACTION':
      return {
        ...state,
        lastAction: action.payload
      };

    default:
      return state;
  }
};

// Create context
const AttendanceContext = createContext();

// Provider component
export const AttendanceProvider = ({ children }) => {
  const [state, dispatch] = useReducer(attendanceReducer, initialState);

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Set up API client
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          apiClient.setToken(token);
        }

        // Set up attendance service
        attendanceService.setAPIClient(apiClient);

        // Set up event listeners
        setupEventListeners();

        // Load initial data
        await loadInitialData();

        console.log('Attendance context initialized');
      } catch (error) {
        console.error('Failed to initialize attendance context:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    };

    initializeServices();
  }, []);

  // Load initial data
  const loadInitialData = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // Load user profile
      const profileResult = await apiClient.getUserProfile();
      if (profileResult.success) {
        dispatch({ type: 'SET_USER_PROFILE', payload: profileResult.data });
      }

      // Load locations
      const locationsResult = await apiClient.getLocations();
      if (locationsResult.success) {
        dispatch({ type: 'SET_LOCATIONS', payload: locationsResult.data });
      }

      // Load active shift
      if (profileResult.success) {
        const shiftResult = await apiClient.getActiveShift(
          profileResult.data.id,
          profileResult.data.companyId
        );
        if (shiftResult.success) {
          dispatch({ type: 'SET_ACTIVE_SHIFT', payload: shiftResult.data });
        }
      }

      // Load queue status
      const queueStats = await attendanceService.getQueueStats();
      if (queueStats) {
        dispatch({ type: 'SET_QUEUE_STATUS', payload: queueStats });
      }

      // Load GPS status
      const gpsStatus = await gpsCapture.getStatus();
      dispatch({ type: 'SET_GPS_STATUS', payload: gpsStatus });

    } catch (error) {
      console.error('Failed to load initial data:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Setup event listeners
  const setupEventListeners = () => {
    // Network status
    const handleNetworkChange = () => {
      dispatch({
        type: 'SET_NETWORK_STATUS',
        payload: {
          online: navigator.onLine,
          lastCheck: Date.now()
        }
      });
    };

    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);

    // App state changes
    const handleAppStateChange = (nextState) => {
      if (nextState === 'active') {
        // Refresh data when app becomes active
        loadInitialData();
      }
    };

    if (typeof AppState !== 'undefined') {
      AppState.addEventListener('change', handleAppStateChange);
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      if (typeof AppState !== 'undefined') {
        AppState.removeEventListener('change', handleAppStateChange);
      }
    };
  };

  // Clock-in action
  const clockIn = async (locationId) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      const result = await attendanceService.clockIn(locationId, {
        userId: state.userProfile?.id,
        companyId: state.userProfile?.companyId
      });

      if (result.success) {
        dispatch({ type: 'SET_LAST_ACTION', payload: 'clock_in' });
        
        // Refresh active shift
        if (state.userProfile) {
          const shiftResult = await apiClient.getActiveShift(
            state.userProfile.id,
            state.userProfile.companyId
          );
          if (shiftResult.success) {
            dispatch({ type: 'SET_ACTIVE_SHIFT', payload: shiftResult.data });
          }
        }

        // Update queue status
        const queueStats = await attendanceService.getQueueStats();
        if (queueStats) {
          dispatch({ type: 'SET_QUEUE_STATUS', payload: queueStats });
        }

        return { success: true, queued: result.queued };
      } else {
        dispatch({ type: 'SET_ERROR', payload: result.error });
        return { success: false, error: result.error };
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      return { success: false, error: error.message };
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Clock-out action
  const clockOut = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      const result = await attendanceService.clockOut({
        userId: state.userProfile?.id,
        companyId: state.userProfile?.companyId
      });

      if (result.success) {
        dispatch({ type: 'SET_LAST_ACTION', payload: 'clock_out' });
        dispatch({ type: 'SET_ACTIVE_SHIFT', payload: null });

        // Update queue status
        const queueStats = await attendanceService.getQueueStats();
        if (queueStats) {
          dispatch({ type: 'SET_QUEUE_STATUS', payload: queueStats });
        }

        return { success: true, queued: result.queued };
      } else {
        dispatch({ type: 'SET_ERROR', payload: result.error });
        return { success: false, error: result.error };
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      return { success: false, error: error.message };
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Start break action
  const startBreak = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      const result = await attendanceService.startBreak(state.activeShift?.id, {
        userId: state.userProfile?.id,
        companyId: state.userProfile?.companyId
      });

      if (result.success) {
        dispatch({ type: 'SET_LAST_ACTION', payload: 'break_start' });

        // Update queue status
        const queueStats = await attendanceService.getQueueStats();
        if (queueStats) {
          dispatch({ type: 'SET_QUEUE_STATUS', payload: queueStats });
        }

        return { success: true, queued: result.queued };
      } else {
        dispatch({ type: 'SET_ERROR', payload: result.error });
        return { success: false, error: result.error };
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      return { success: false, error: error.message };
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // End break action
  const endBreak = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      const result = await attendanceService.endBreak(state.activeShift?.id, {
        userId: state.userProfile?.id,
        companyId: state.userProfile?.companyId
      });

      if (result.success) {
        dispatch({ type: 'SET_LAST_ACTION', payload: 'break_end' });

        // Update queue status
        const queueStats = await attendanceService.getQueueStats();
        if (queueStats) {
          dispatch({ type: 'SET_QUEUE_STATUS', payload: queueStats });
        }

        return { success: true, queued: result.queued };
      } else {
        dispatch({ type: 'SET_ERROR', payload: result.error });
        return { success: false, error: result.error };
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      return { success: false, error: error.message };
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Refresh data
  const refreshData = async () => {
    await loadInitialData();
  };

  // Clear queue
  const clearQueue = async () => {
    try {
      const result = await attendanceService.clearQueue();
      if (result.success) {
        dispatch({ type: 'SET_QUEUE_STATUS', payload: { size: 0, processing: false } });
      }
      return result;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      return { success: false, error: error.message };
    }
  };

  // Context value
  const value = {
    state,
    actions: {
      clockIn,
      clockOut,
      startBreak,
      endBreak,
      refreshData,
      clearQueue
    }
  };

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  );
};

// Hook for using context
export const useAttendance = () => {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
};

// Export context for testing
export default AttendanceContext;
