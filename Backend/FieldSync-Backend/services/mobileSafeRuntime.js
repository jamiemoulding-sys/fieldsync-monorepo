/**
 * Production-Safe Mobile Runtime Service
 * 
 * Provides safe mobile runtime behavior with proper lifecycle handling,
 * GPS validation, network retry, and server-authoritative state.
 */

const MobileSafeQueue = require('./mobileSafeQueue');

class MobileSafeRuntime {
  constructor() {
    this.queue = new MobileSafeQueue();
    this.apiClient = null;
    this.isOnline = navigator.onLine;
    this.currentLocation = null;
    this.locationWatchId = null;
    this.syncInterval = null;
    this.appState = 'active';
    
    // GPS settings
    this.GPS_TIMEOUT = 10000;
    this.GPS_MAX_AGE = 30000; // 30 seconds
    this.GPS_MIN_ACCURACY = 100; // 100 meters
    
    // Network settings
    this.NETWORK_TIMEOUT = 10000;
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 1000;
    
    this.initialize();
  }

  /**
   * Initialize runtime
   */
  async initialize() {
    try {
      // 1. Setup network monitoring
      this.setupNetworkMonitoring();
      
      // 2. Setup app lifecycle monitoring
      this.setupLifecycleMonitoring();
      
      // 3. Setup GPS monitoring
      this.setupGPSMonitoring();
      
      // 4. Setup sync interval
      this.setupSyncInterval();
      
      // 5. Process existing queue
      await this.processQueue();
      
      console.log('MobileSafeRuntime initialized');
    } catch (error) {
      console.error('Runtime initialization failed:', error);
    }
  }

  /**
   * Clock-in with GPS validation and queue support
   */
  async clockIn(locationId, data = {}) {
    try {
      // 1. Get validated GPS coordinates
      const location = await this.getValidatedLocation();
      
      // 2. Create job data
      const jobData = {
        type: 'clock-in',
        userId: data.userId,
        companyId: data.companyId,
        data: {
          locationId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.timestamp,
          deviceFingerprint: await this.getDeviceFingerprint(),
          sessionId: await this.getSessionId(),
          metadata: data.metadata || {}
        }
      };

      // 3. Try to process immediately if online
      if (this.isOnline && this.apiClient) {
        try {
          const result = await this.apiClient.clockIn(
            jobData.userId,
            jobData.companyId,
            jobData.data
          );
          
          if (result.success) {
            return { success: true, shift: result.shift };
          }
        } catch (error) {
          console.warn('Immediate clock-in failed, queuing:', error);
        }
      }

      // 4. Add to queue if immediate processing failed
      const queueResult = await this.queue.addJob(jobData);
      
      if (queueResult.success) {
        return { 
          success: true, 
          queued: true, 
          jobId: queueResult.jobId,
          message: 'Clock-in queued for processing'
        };
      } else {
        throw new Error(queueResult.error || 'Failed to queue clock-in');
      }
    } catch (error) {
      console.error('Clock-in failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clock-out with GPS validation and queue support
   */
  async clockOut(shiftId, data = {}) {
    try {
      // 1. Get validated GPS coordinates
      const location = await this.getValidatedLocation();
      
      // 2. Create job data
      const jobData = {
        type: 'clock-out',
        userId: data.userId,
        companyId: data.companyId,
        data: {
          shiftId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.timestamp,
          deviceFingerprint: await this.getDeviceFingerprint(),
          sessionId: await this.getSessionId(),
          metadata: data.metadata || {}
        }
      };

      // 3. Try to process immediately if online
      if (this.isOnline && this.apiClient) {
        try {
          const result = await this.apiClient.clockOut(
            jobData.userId,
            jobData.companyId,
            jobData.data
          );
          
          if (result.success) {
            return { success: true, shift: result.shift };
          }
        } catch (error) {
          console.warn('Immediate clock-out failed, queuing:', error);
        }
      }

      // 4. Add to queue if immediate processing failed
      const queueResult = await this.queue.addJob(jobData);
      
      if (queueResult.success) {
        return { 
          success: true, 
          queued: true, 
          jobId: queueResult.jobId,
          message: 'Clock-out queued for processing'
        };
      } else {
        throw new Error(queueResult.error || 'Failed to queue clock-out');
      }
    } catch (error) {
      console.error('Clock-out failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start break with queue support
   */
  async startBreak(shiftId, data = {}) {
    try {
      // 1. Create job data
      const jobData = {
        type: 'break-start',
        userId: data.userId,
        companyId: data.companyId,
        data: {
          shiftId,
          timestamp: Date.now(),
          deviceFingerprint: await this.getDeviceFingerprint(),
          sessionId: await this.getSessionId(),
          metadata: data.metadata || {}
        }
      };

      // 2. Try to process immediately if online
      if (this.isOnline && this.apiClient) {
        try {
          const result = await this.apiClient.startBreak(
            jobData.userId,
            jobData.companyId,
            jobData.data
          );
          
          if (result.success) {
            return { success: true, shift: result.shift };
          }
        } catch (error) {
          console.warn('Immediate break start failed, queuing:', error);
        }
      }

      // 3. Add to queue if immediate processing failed
      const queueResult = await this.queue.addJob(jobData);
      
      if (queueResult.success) {
        return { 
          success: true, 
          queued: true, 
          jobId: queueResult.jobId,
          message: 'Break start queued for processing'
        };
      } else {
        throw new Error(queueResult.error || 'Failed to queue break start');
      }
    } catch (error) {
      console.error('Break start failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * End break with queue support
   */
  async endBreak(shiftId, data = {}) {
    try {
      // 1. Create job data
      const jobData = {
        type: 'break-end',
        userId: data.userId,
        companyId: data.companyId,
        data: {
          shiftId,
          timestamp: Date.now(),
          deviceFingerprint: await this.getDeviceFingerprint(),
          sessionId: await this.getSessionId(),
          metadata: data.metadata || {}
        }
      };

      // 2. Try to process immediately if online
      if (this.isOnline && this.apiClient) {
        try {
          const result = await this.apiClient.endBreak(
            jobData.userId,
            jobData.companyId,
            jobData.data
          );
          
          if (result.success) {
            return { success: true, shift: result.shift };
          }
        } catch (error) {
          console.warn('Immediate break end failed, queuing:', error);
        }
      }

      // 3. Add to queue if immediate processing failed
      const queueResult = await this.queue.addJob(jobData);
      
      if (queueResult.success) {
        return { 
          success: true, 
          queued: true, 
          jobId: queueResult.jobId,
          message: 'Break end queued for processing'
        };
      } else {
        throw new Error(queueResult.error || 'Failed to queue break end');
      }
    } catch (error) {
      console.error('Break end failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get active shift from server (server-authoritative)
   */
  async getActiveShift(userId, companyId) {
    try {
      if (!this.apiClient) {
        throw new Error('API client not configured');
      }

      const response = await this.apiClient.getActiveShift(userId, companyId);
      return response;
    } catch (error) {
      console.error('Get active shift failed:', error);
      return null;
    }
  }

  /**
   * Get validated GPS coordinates
   */
  async getValidatedLocation() {
    return new Promise((resolve, reject) => {
      // 1. Check if we have recent valid location
      if (this.currentLocation && 
          this.isLocationValid(this.currentLocation)) {
        resolve(this.currentLocation);
        return;
      }

      // 2. Get fresh location
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp || Date.now()
          };

          // 3. Validate location
          if (this.isLocationValid(location)) {
            this.currentLocation = location;
            resolve(location);
          } else {
            reject(new Error('GPS accuracy too low'));
          }
        },
        (error) => {
          reject(new Error(`GPS error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: this.GPS_TIMEOUT,
          maximumAge: this.GPS_MAX_AGE
        }
      );
    });
  }

  /**
   * Validate GPS location
   */
  isLocationValid(location) {
    const now = Date.now();
    const age = now - location.timestamp;
    
    return (
      location &&
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number' &&
      typeof location.accuracy === 'number' &&
      location.accuracy <= this.GPS_MIN_ACCURACY &&
      age <= this.GPS_MAX_AGE
    );
  }

  /**
   * Setup network monitoring
   */
  setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('Network online');
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('Network offline');
    });
  }

  /**
   * Setup app lifecycle monitoring
   */
  setupLifecycleMonitoring() {
    // Handle app visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.appState = 'background';
        console.log('App went to background');
        this.handleAppStateChange('background');
      } else {
        this.appState = 'active';
        console.log('App became active');
        this.handleAppStateChange('active');
      }
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      console.log('App unloading');
      this.handleAppStateChange('unloading');
    });

    // Handle page focus
    window.addEventListener('focus', () => {
      this.appState = 'active';
      console.log('App focused');
      this.handleAppStateChange('active');
    });
  }

  /**
   * Setup GPS monitoring
   */
  setupGPSMonitoring() {
    // Watch location changes
    this.locationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp || Date.now()
        };

        if (this.isLocationValid(location)) {
          this.currentLocation = location;
        }
      },
      (error) => {
        console.warn('GPS watch error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: this.GPS_TIMEOUT,
        maximumAge: this.GPS_MAX_AGE
      }
    );
  }

  /**
   * Setup sync interval
   */
  setupSyncInterval() {
    // Process queue every 30 seconds
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.processQueue();
      }
    }, 30000);
  }

  /**
   * Handle app state changes
   */
  async handleAppStateChange(newState) {
    try {
      switch (newState) {
        case 'active':
          // Refresh GPS location
          await this.getValidatedLocation();
          
          // Process queue if online
          if (this.isOnline) {
            await this.processQueue();
          }
          break;
          
        case 'background':
          // Save current state
          await this.saveRuntimeState();
          break;
          
        case 'unloading':
          // Save state and cleanup
          await this.saveRuntimeState();
          this.cleanup();
          break;
      }
    } catch (error) {
      console.error('Handle app state change failed:', error);
    }
  }

  /**
   * Process queue with retry logic
   */
  async processQueue() {
    if (!this.apiClient || !this.isOnline) {
      return;
    }

    try {
      const result = await this.queue.processQueue(this.apiClient);
      
      if (result.success) {
        console.log(`Queue processed: ${result.processed} processed, ${result.failed} failed, ${result.remaining} remaining`);
        
        // Emit event for UI updates
        this.emit('queueProcessed', result);
      }
    } catch (error) {
      console.error('Process queue failed:', error);
    }
  }

  /**
   * Get device fingerprint
   */
  async getDeviceFingerprint() {
    const fingerprintData = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: Date.now()
    };

    // Simple hash for demo - use proper crypto in production
    const fingerprintString = JSON.stringify(fingerprintData);
    return btoa(fingerprintString).substring(0, 32);
  }

  /**
   * Get session ID
   */
  async getSessionId() {
    let sessionId = localStorage.getItem('sessionId');
    
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('sessionId', sessionId);
    }
    
    return sessionId;
  }

  /**
   * Save runtime state
   */
  async saveRuntimeState() {
    try {
      const state = {
        currentLocation: this.currentLocation,
        lastSync: Date.now(),
        appState: this.appState
      };
      
      localStorage.setItem('runtimeState', JSON.stringify(state));
    } catch (error) {
      console.error('Save runtime state failed:', error);
    }
  }

  /**
   * Load runtime state
   */
  async loadRuntimeState() {
    try {
      const stateData = localStorage.getItem('runtimeState');
      
      if (stateData) {
        const state = JSON.parse(stateData);
        
        // Restore location if still valid
        if (state.currentLocation && this.isLocationValid(state.currentLocation)) {
          this.currentLocation = state.currentLocation;
        }
      }
    } catch (error) {
      console.error('Load runtime state failed:', error);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    return await this.queue.getQueueStats();
  }

  /**
   * Clear queue
   */
  async clearQueue() {
    return await this.queue.clearQueue();
  }

  /**
   * Set API client
   */
  setAPIClient(apiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.locationWatchId) {
      navigator.geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Simple event emitter
   */
  emit(event, data) {
    if (this.listeners && this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  on(event, callback) {
    if (!this.listeners) {
      this.listeners = {};
    }
    
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    
    this.listeners[event].push(callback);
  }
}

module.exports = MobileSafeRuntime;
