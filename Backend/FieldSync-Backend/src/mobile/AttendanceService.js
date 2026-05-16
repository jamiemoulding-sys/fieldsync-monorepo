/**
 * TestFlight-Safe Attendance Service
 * 
 * The single source of truth for mobile attendance operations.
 * Prioritizes operational reliability and payroll integrity.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class AttendanceService {
  constructor() {
    this.STORAGE_KEY = 'attendance_queue';
    this.BACKUP_KEY = 'attendance_queue_backup';
    this.MAX_QUEUE_SIZE = 50;
    this.TTL = 24 * 60 * 60 * 1000; // 24 hours
    this.DEDUPLICATION_WINDOW = 60 * 1000; // 60 seconds
    
    this.apiClient = null;
    this.isProcessing = false;
    this.recentJobs = new Map();
    
    this.initialize();
  }

  /**
   * Initialize service
   */
  async initialize() {
    try {
      // Clean up expired jobs
      await this.cleanupExpired();
      
      // Restore from backup if needed
      await this.restoreFromBackup();
      
      // Start queue processor
      this.startQueueProcessor();
      
      console.log('AttendanceService initialized');
    } catch (error) {
      console.error('AttendanceService initialization failed:', error);
    }
  }

  /**
   * Set API client
   */
  setAPIClient(client) {
    this.apiClient = client;
  }

  /**
   * Clock-in with GPS capture
   */
  async clockIn(locationId, userData = {}) {
    try {
      // 1. Capture GPS
      const gps = await this.captureGPS();
      
      // 2. Create job
      const job = {
        id: this.generateId(),
        type: 'clock-in',
        userId: userData.userId,
        companyId: userData.companyId,
        locationId,
        gps,
        timestamp: Date.now(),
        deviceInfo: this.getDeviceInfo(),
        attempts: 0,
        maxAttempts: 3
      };

      // 3. Add to queue
      const result = await this.addToQueue(job);
      
      // 4. Try immediate processing
      if (result.success) {
        this.processQueue();
      }
      
      return result;
    } catch (error) {
      console.error('Clock-in failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clock-out with GPS capture
   */
  async clockOut(userData = {}) {
    try {
      // 1. Capture GPS
      const gps = await this.captureGPS();
      
      // 2. Create job
      const job = {
        id: this.generateId(),
        type: 'clock-out',
        userId: userData.userId,
        companyId: userData.companyId,
        gps,
        timestamp: Date.now(),
        deviceInfo: this.getDeviceInfo(),
        attempts: 0,
        maxAttempts: 3
      };

      // 3. Add to queue
      const result = await this.addToQueue(job);
      
      // 4. Try immediate processing
      if (result.success) {
        this.processQueue();
      }
      
      return result;
    } catch (error) {
      console.error('Clock-out failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start break
   */
  async startBreak(shiftId, userData = {}) {
    try {
      // 1. Create job
      const job = {
        id: this.generateId(),
        type: 'break-start',
        userId: userData.userId,
        companyId: userData.companyId,
        shiftId,
        timestamp: Date.now(),
        deviceInfo: this.getDeviceInfo(),
        attempts: 0,
        maxAttempts: 3
      };

      // 2. Add to queue
      const result = await this.addToQueue(job);
      
      // 3. Try immediate processing
      if (result.success) {
        this.processQueue();
      }
      
      return result;
    } catch (error) {
      console.error('Start break failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * End break
   */
  async endBreak(shiftId, userData = {}) {
    try {
      // 1. Create job
      const job = {
        id: this.generateId(),
        type: 'break-end',
        userId: userData.userId,
        companyId: userData.companyId,
        shiftId,
        timestamp: Date.now(),
        deviceInfo: this.getDeviceInfo(),
        attempts: 0,
        maxAttempts: 3
      };

      // 2. Add to queue
      const result = await this.addToQueue(job);
      
      // 3. Try immediate processing
      if (result.success) {
        this.processQueue();
      }
      
      return result;
    } catch (error) {
      console.error('End break failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get active shift from server
   */
  async getActiveShift(userId, companyId) {
    try {
      if (!this.apiClient) {
        throw new Error('API client not configured');
      }

      const response = await this.apiClient.getActiveShift(userId, companyId);
      return response.data;
    } catch (error) {
      console.error('Get active shift failed:', error);
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const queue = await this.getQueue();
      
      const stats = {
        total: queue.length,
        pending: queue.filter(job => job.attempts === 0).length,
        failed: queue.filter(job => job.attempts > 0).length,
        byType: {},
        oldestJob: null,
        newestJob: null
      };

      queue.forEach(job => {
        stats.byType[job.type] = (stats.byType[job.type] || 0) + 1;
        
        if (!stats.oldestJob || job.timestamp < stats.oldestJob.timestamp) {
          stats.oldestJob = job;
        }
        
        if (!stats.newestJob || job.timestamp > stats.newestJob.timestamp) {
          stats.newestJob = job;
        }
      });

      return stats;
    } catch (error) {
      console.error('Get queue stats failed:', error);
      return null;
    }
  }

  /**
   * Clear queue
   */
  async clearQueue() {
    try {
      await this.atomicWrite([]);
      return { success: true };
    } catch (error) {
      console.error('Clear queue failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Capture GPS coordinates
   */
  async captureGPS() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp || Date.now()
          });
        },
        (error) => {
          // GPS failure doesn't block operation
          console.warn('GPS capture failed:', error);
          resolve({
            latitude: null,
            longitude: null,
            accuracy: null,
            error: error.message,
            timestamp: Date.now()
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );
    });
  }

  /**
   * Get device information
   */
  getDeviceInfo() {
    return {
      platform: Platform.OS,
      version: Platform.Version,
      model: Platform.select({
        ios: 'iOS',
        android: 'Android',
        default: 'Unknown'
      }),
      timestamp: Date.now()
    };
  }

  /**
   * Add job to queue with validation
   */
  async addToQueue(job) {
    try {
      // 1. Validate job
      if (!this.isValidJob(job)) {
        throw new Error('Invalid job structure');
      }

      // 2. Check for duplicates
      if (this.isDuplicate(job)) {
        return { success: false, reason: 'duplicate' };
      }

      // 3. Get current queue
      const queue = await this.getQueue();

      // 4. Check queue size
      if (queue.length >= this.MAX_QUEUE_SIZE) {
        throw new Error('Queue is full');
      }

      // 5. Atomic write
      const updatedQueue = [...queue, job];
      await this.atomicWrite(updatedQueue);

      return { success: true, id: job.id };
    } catch (error) {
      console.error('Add to queue failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process queue
   */
  async processQueue() {
    if (this.isProcessing || !this.apiClient || !navigator.onLine) {
      return;
    }

    this.isProcessing = true;

    try {
      const queue = await this.getQueue();
      const processed = [];
      const failed = [];
      const remaining = [];

      for (const job of queue) {
        try {
          // Check TTL
          if (Date.now() - job.timestamp > this.TTL) {
            console.warn(`Job ${job.id} expired, skipping`);
            continue;
          }

          // Check attempts
          if (job.attempts >= job.maxAttempts) {
            console.warn(`Job ${job.id} max attempts reached, skipping`);
            failed.push(job);
            continue;
          }

          // Process job
          const result = await this.processJob(job);
          
          if (result.success) {
            processed.push(job);
          } else {
            // Update job with error
            job.attempts++;
            job.lastError = result.error;
            job.lastAttempt = Date.now();
            
            if (job.attempts < job.maxAttempts) {
              remaining.push(job);
            } else {
              failed.push(job);
            }
          }
        } catch (error) {
          console.error(`Job ${job.id} processing failed:`, error);
          
          job.attempts++;
          job.lastError = error.message;
          job.lastAttempt = Date.now();
          
          if (job.attempts < job.maxAttempts) {
            remaining.push(job);
          } else {
            failed.push(job);
          }
        }
      }

      // Atomic update
      await this.atomicWrite(remaining);

      console.log(`Queue processed: ${processed.length} processed, ${failed.length} failed, ${remaining.length} remaining`);
      
      return { success: true, processed, failed, remaining: remaining.length };
    } catch (error) {
      console.error('Process queue failed:', error);
      return { success: false, error: error.message };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual job
   */
  async processJob(job) {
    try {
      switch (job.type) {
        case 'clock-in':
          return await this.apiClient.clockIn(job.userId, job.companyId, {
            locationId: job.locationId,
            latitude: job.gps?.latitude,
            longitude: job.gps?.longitude,
            accuracy: job.gps?.accuracy,
            deviceInfo: job.deviceInfo
          });
        
        case 'clock-out':
          return await this.apiClient.clockOut(job.userId, job.companyId, {
            latitude: job.gps?.latitude,
            longitude: job.gps?.longitude,
            accuracy: job.gps?.accuracy,
            deviceInfo: job.deviceInfo
          });
        
        case 'break-start':
          return await this.apiClient.startBreak(job.userId, job.companyId, {
            shiftId: job.shiftId,
            deviceInfo: job.deviceInfo
          });
        
        case 'break-end':
          return await this.apiClient.endBreak(job.userId, job.companyId, {
            shiftId: job.shiftId,
            deviceInfo: job.deviceInfo
          });
        
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get queue from storage
   */
  async getQueue() {
    try {
      const queueData = await AsyncStorage.getItem(this.STORAGE_KEY);
      
      if (!queueData) {
        return [];
      }

      const queue = JSON.parse(queueData);
      
      // Validate queue structure
      if (!Array.isArray(queue)) {
        console.warn('Invalid queue structure, resetting');
        await this.clearQueue();
        return [];
      }

      return queue;
    } catch (error) {
      console.error('Get queue failed:', error);
      await this.clearQueue();
      return [];
    }
  }

  /**
   * Atomic write to storage
   */
  async atomicWrite(queue) {
    try {
      // 1. Create backup
      const current = await AsyncStorage.getItem(this.STORAGE_KEY);
      await AsyncStorage.setItem(this.BACKUP_KEY, current);
      
      // 2. Write new data
      const queueData = JSON.stringify(queue);
      await AsyncStorage.setItem(this.STORAGE_KEY, queueData);
      
      // 3. Verify write
      const verify = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (verify !== queueData) {
        throw new Error('Write verification failed');
      }
      
      // 4. Cleanup backup
      await AsyncStorage.removeItem(this.BACKUP_KEY);
      
      return true;
    } catch (error) {
      console.error('Atomic write failed:', error);
      
      // 5. Restore from backup
      try {
        const backup = await AsyncStorage.getItem(this.BACKUP_KEY);
        if (backup) {
          await AsyncStorage.setItem(this.STORAGE_KEY, backup);
        }
      } catch (restoreError) {
        console.error('Restore backup failed:', restoreError);
      }
      
      throw error;
    }
  }

  /**
   * Validate job structure
   */
  isValidJob(job) {
    return (
      job &&
      typeof job.id === 'string' &&
      typeof job.type === 'string' &&
      typeof job.userId === 'string' &&
      typeof job.companyId === 'string' &&
      typeof job.timestamp === 'number' &&
      job.type !== null
    );
  }

  /**
   * Check for duplicate job
   */
  isDuplicate(job) {
    const key = `${job.type}_${job.userId}`;
    const lastTime = this.recentJobs.get(key);
    const now = Date.now();
    
    if (lastTime && (now - lastTime) < this.DEDUPLICATION_WINDOW) {
      return true;
    }
    
    this.recentJobs.set(key, now);
    return false;
  }

  /**
   * Clean up expired jobs
   */
  async cleanupExpired() {
    try {
      const queue = await this.getQueue();
      const validJobs = queue.filter(job => 
        Date.now() - job.timestamp <= this.TTL
      );
      
      if (validJobs.length !== queue.length) {
        await this.atomicWrite(validJobs);
        console.log(`Cleaned up ${queue.length - validJobs.length} expired jobs`);
      }
      
      return validJobs.length;
    } catch (error) {
      console.error('Cleanup expired failed:', error);
      return 0;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup() {
    try {
      const current = await AsyncStorage.getItem(this.STORAGE_KEY);
      const backup = await AsyncStorage.getItem(this.BACKUP_KEY);
      
      // If current is invalid and backup exists, restore
      if (!current && backup) {
        await AsyncStorage.setItem(this.STORAGE_KEY, backup);
        await AsyncStorage.removeItem(this.BACKUP_KEY);
        console.log('Restored queue from backup');
      }
    } catch (error) {
      console.error('Restore from backup failed:', error);
    }
  }

  /**
   * Start queue processor
   */
  startQueueProcessor() {
    // Process queue every 30 seconds
    setInterval(() => {
      if (navigator.onLine && !this.isProcessing) {
        this.processQueue();
      }
    }, 30000);

    // Process queue when app becomes active
    this.setupAppStateHandler();
  }

  /**
   * Setup app state handler
   */
  setupAppStateHandler() {
    if (typeof AppState !== 'undefined') {
      AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          // Process queue when app becomes active
          setTimeout(() => {
            if (navigator.onLine && !this.isProcessing) {
              this.processQueue();
            }
          }, 1000);
        }
      });
    }
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create singleton instance
const attendanceService = new AttendanceService();

export default attendanceService;
