/**
 * Production-Safe Convergence Service
 * 
 * Provides deterministic synchronization convergence with
 * server-authoritative reconciliation and crash-safe persistence.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import crypto from 'crypto';

class ConvergenceService {
  constructor() {
    this.QUEUE_KEY = 'attendance_queue';
    this.QUEUE_BACKUP_KEY = 'attendance_queue_backup';
    this.PROCESSING_STATE_KEY = 'processing_state';
    this.SERVER_STATE_KEY = 'server_state_cache';
    this.IDEMPOTENCY_CACHE_KEY = 'idempotency_cache';
    
    this.TTL = 24 * 60 * 60 * 1000; // 24 hours
    this.DEDUPLICATION_WINDOW = 60 * 1000; // 60 seconds
    this.MAX_RETRY_ATTEMPTS = 3;
  }

  /**
   * Reconcile local queue with server state
   */
  async reconcileWithServer(localQueue, serverState) {
    try {
      const validJobs = [];
      const rejectedJobs = [];
      
      for (const job of localQueue) {
        // 1. Check job age
        if (this.isJobExpired(job)) {
          console.warn(`Job ${job.id} expired, skipping`);
          rejectedJobs.push({ job, reason: 'expired' });
          continue;
        }
        
        // 2. Check against server state
        const validationResult = this.validateJobAgainstServerState(job, serverState);
        
        if (validationResult.valid) {
          validJobs.push(job);
        } else {
          console.warn(`Job ${job.id} conflicts with server state: ${validationResult.reason}`);
          rejectedJobs.push({ job, reason: validationResult.reason });
        }
      }
      
      // 3. Update queue with valid jobs only
      await this.atomicWriteQueue(validJobs);
      
      return {
        success: true,
        validJobs,
        rejectedJobs,
        converged: true
      };
    } catch (error) {
      console.error('Reconciliation failed:', error);
      return {
        success: false,
        error: error.message,
        converged: false
      };
    }
  }

  /**
   * Validate job against server state
   */
  validateJobAgainstServerState(job, serverState) {
    switch (job.type) {
      case 'clock-in':
        // Can't clock in if already clocked in
        if (serverState.activeShift) {
          return { valid: false, reason: 'already_clocked_in' };
        }
        break;
        
      case 'clock-out':
        // Can't clock out if not clocked in
        if (!serverState.activeShift) {
          return { valid: false, reason: 'no_active_shift' };
        }
        
        // Can't clock out different shift
        if (serverState.activeShift.id !== job.shiftId) {
          return { valid: false, reason: 'shift_mismatch' };
        }
        break;
        
      case 'break-start':
        // Can't start break if not on break
        if (!serverState.activeShift || !serverState.activeShift.onBreak) {
          return { valid: false, reason: 'not_on_break' };
        }
        break;
        
      case 'break-end':
        // Can't end break if on break
        if (!serverState.activeShift || serverState.activeShift.onBreak) {
          return { valid: false, reason: 'already_on_break' };
        }
        break;
        
      default:
        return { valid: false, reason: 'unknown_job_type' };
    }
    
    return { valid: true };
  }

  /**
   * Check if job is expired
   */
  isJobExpired(job) {
    return Date.now() - job.timestamp > this.TTL;
  }

  /**
   * Generate job fingerprint for deduplication
   */
  generateJobFingerprint(job) {
    const fingerprintData = {
      type: job.type,
      userId: job.userId,
      timestamp: Math.floor(job.timestamp / this.DEDUPLICATION_WINDOW),
      locationId: job.locationId,
      shiftId: job.shiftId
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex');
  }

  /**
   * Check for duplicate job
   */
  isDuplicateJob(newJob, existingJobs) {
    const newFingerprint = this.generateJobFingerprint(newJob);
    
    return existingJobs.some(job => 
      this.generateJobFingerprint(job) === newFingerprint
    );
  }

  /**
   * Generate idempotency key for server requests
   */
  generateIdempotencyKey(job) {
    const keyData = {
      type: job.type,
      userId: job.userId,
      timestamp: Math.floor(job.timestamp / 60000), // 1-minute window
      locationId: job.locationId,
      shiftId: job.shiftId,
      deviceFingerprint: job.deviceFingerprint
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  /**
   * Process queue with convergence guarantees
   */
  async processQueueWithConvergence(apiClient, serverState) {
    try {
      // 1. Set processing state
      await this.setProcessingState({
        isProcessing: true,
        startTime: Date.now(),
        processedJobs: [],
        failedJobs: []
      });
      
      // 2. Get and reconcile queue
      const localQueue = await this.getQueueWithValidation();
      const reconciliation = await this.reconcileWithServer(localQueue, serverState);
      
      if (!reconciliation.success) {
        throw new Error('Reconciliation failed');
      }
      
      const validJobs = reconciliation.validJobs;
      const processedJobs = [];
      const failedJobs = [];
      
      // 3. Process each job with idempotency
      for (const job of validJobs) {
        try {
          // 4. Check idempotency cache
          const idempotencyKey = this.generateIdempotencyKey(job);
          
          if (await this.isIdempotentRequestProcessed(idempotencyKey)) {
            console.log(`Job ${job.id} already processed, skipping`);
            processedJobs.push(job);
            continue;
          }
          
          // 5. Process job
          const result = await this.processJobWithIdempotency(job, apiClient);
          
          if (result.success) {
            // 6. Mark as processed
            await this.markIdempotentRequestProcessed(idempotencyKey, result.data);
            processedJobs.push(job);
            
            // 7. Update processing state
            await this.updateProcessingState({
              processedJobs: [...(await this.getProcessingState()).processedJobs, job.id]
            });
          } else {
            job.attempts = (job.attempts || 0) + 1;
            job.lastError = result.error;
            failedJobs.push(job);
          }
        } catch (error) {
          console.error(`Job ${job.id} processing failed:`, error);
          job.attempts = (job.attempts || 0) + 1;
          job.lastError = error.message;
          failedJobs.push(job);
        }
      }
      
      // 8. Update queue with failed jobs
      const retryableJobs = failedJobs.filter(job => job.attempts < this.MAX_RETRY_ATTEMPTS);
      await this.atomicWriteQueue(retryableJobs);
      
      // 9. Clear processing state
      await this.clearProcessingState();
      
      return {
        success: true,
        processedJobs,
        failedJobs,
        remainingJobs: retryableJobs.length,
        converged: true
      };
    } catch (error) {
      console.error('Queue processing failed:', error);
      
      // 10. Clear processing state on error
      await this.clearProcessingState();
      
      return {
        success: false,
        error: error.message,
        converged: false
      };
    }
  }

  /**
   * Process job with idempotency
   */
  async processJobWithIdempotency(job, apiClient) {
    const idempotencyKey = this.generateIdempotencyKey(job);
    
    switch (job.type) {
      case 'clock-in':
        return await apiClient.clockIn(job.userId, job.companyId, job.data, {
          'Idempotency-Key': idempotencyKey
        });
        
      case 'clock-out':
        return await apiClient.clockOut(job.userId, job.companyId, job.data, {
          'Idempotency-Key': idempotencyKey
        });
        
      case 'break-start':
        return await apiClient.startBreak(job.userId, job.companyId, job.data, {
          'Idempotency-Key': idempotencyKey
        });
        
      case 'break-end':
        return await apiClient.endBreak(job.userId, job.companyId, job.data, {
          'Idempotency-Key': idempotencyKey
        });
        
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  /**
   * Check if idempotent request was already processed
   */
  async isIdempotentRequestProcessed(idempotencyKey) {
    try {
      const cache = await this.getIdempotencyCache();
      return cache.hasOwnProperty(idempotencyKey);
    } catch (error) {
      console.error('Idempotency check failed:', error);
      return false;
    }
  }

  /**
   * Mark idempotent request as processed
   */
  async markIdempotentRequestProcessed(idempotencyKey, result) {
    try {
      const cache = await this.getIdempotencyCache();
      cache[idempotencyKey] = {
        result,
        timestamp: Date.now()
      };
      
      await this.setIdempotencyCache(cache);
      
      // Cleanup old entries
      await this.cleanupIdempotencyCache();
    } catch (error) {
      console.error('Mark idempotent request failed:', error);
    }
  }

  /**
   * Get idempotency cache
   */
  async getIdempotencyCache() {
    try {
      const cacheData = await AsyncStorage.getItem(this.IDEMPOTENCY_CACHE_KEY);
      return cacheData ? JSON.parse(cacheData) : {};
    } catch (error) {
      console.error('Get idempotency cache failed:', error);
      return {};
    }
  }

  /**
   * Set idempotency cache
   */
  async setIdempotencyCache(cache) {
    try {
      await AsyncStorage.setItem(this.IDEMPOTENCY_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Set idempotency cache failed:', error);
    }
  }

  /**
   * Cleanup old idempotency cache entries
   */
  async cleanupIdempotencyCache() {
    try {
      const cache = await this.getIdempotencyCache();
      const now = Date.now();
      const cleaned = {};
      
      for (const [key, value] of Object.entries(cache)) {
        // Keep entries for 24 hours
        if (now - value.timestamp < this.TTL) {
          cleaned[key] = value;
        }
      }
      
      await this.setIdempotencyCache(cleaned);
    } catch (error) {
      console.error('Cleanup idempotency cache failed:', error);
    }
  }

  /**
   * Atomic queue write with backup
   */
  async atomicWriteQueue(queue) {
    return this.atomicWrite(this.QUEUE_KEY, queue);
  }

  /**
   * Atomic write with backup and verification
   */
  async atomicWrite(key, data) {
    try {
      // 1. Create backup
      const current = await AsyncStorage.getItem(key);
      await AsyncStorage.setItem(`${key}_backup`, current);
      
      // 2. Write new data
      const serialized = JSON.stringify(data);
      await AsyncStorage.setItem(key, serialized);
      
      // 3. Verify write
      const verify = await AsyncStorage.getItem(key);
      if (verify !== serialized) {
        throw new Error('Write verification failed');
      }
      
      // 4. Cleanup backup
      await AsyncStorage.removeItem(`${key}_backup`);
      
      return true;
    } catch (error) {
      console.error('Atomic write failed:', error);
      
      // 5. Restore from backup
      try {
        const backup = await AsyncStorage.getItem(`${key}_backup`);
        if (backup) {
          await AsyncStorage.setItem(key, backup);
        }
      } catch (restoreError) {
        console.error('Restore backup failed:', restoreError);
      }
      
      throw error;
    }
  }

  /**
   * Get queue with validation
   */
  async getQueueWithValidation() {
    try {
      const queueData = await AsyncStorage.getItem(this.QUEUE_KEY);
      
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

      // Validate each job
      const validJobs = queue.filter(job => this.isValidJobStructure(job));
      
      if (validJobs.length !== queue.length) {
        console.warn('Queue contains invalid jobs, cleaning up');
        await this.atomicWriteQueue(validJobs);
      }

      return validJobs;
    } catch (error) {
      console.error('Get queue failed:', error);
      
      // Try to restore from backup
      try {
        const backup = await AsyncStorage.getItem(this.QUEUE_BACKUP_KEY);
        if (backup) {
          const queue = JSON.parse(backup);
          await this.atomicWriteQueue(queue);
          return queue;
        }
      } catch (backupError) {
        console.error('Restore backup failed:', backupError);
      }
      
      // Reset queue if all else fails
      await this.clearQueue();
      return [];
    }
  }

  /**
   * Validate job structure
   */
  isValidJobStructure(job) {
    return (
      job &&
      typeof job.id === 'string' &&
      typeof job.type === 'string' &&
      typeof job.userId === 'string' &&
      typeof job.companyId === 'string' &&
      typeof job.timestamp === 'number' &&
      job.data &&
      typeof job.data === 'object'
    );
  }

  /**
   * Set processing state
   */
  async setProcessingState(state) {
    try {
      const processingState = {
        isProcessing: state.isProcessing || false,
        startTime: state.startTime || Date.now(),
        currentJobId: state.currentJobId || null,
        processedJobs: state.processedJobs || [],
        failedJobs: state.failedJobs || [],
        timestamp: Date.now()
      };
      
      await this.atomicWrite(this.PROCESSING_STATE_KEY, processingState);
    } catch (error) {
      console.error('Set processing state failed:', error);
    }
  }

  /**
   * Get processing state
   */
  async getProcessingState() {
    try {
      const stateData = await AsyncStorage.getItem(this.PROCESSING_STATE_KEY);
      return stateData ? JSON.parse(stateData) : {
        isProcessing: false,
        processedJobs: [],
        failedJobs: []
      };
    } catch (error) {
      console.error('Get processing state failed:', error);
      return {
        isProcessing: false,
        processedJobs: [],
        failedJobs: []
      };
    }
  }

  /**
   * Update processing state
   */
  async updateProcessingState(updates) {
    try {
      const currentState = await this.getProcessingState();
      const updatedState = { ...currentState, ...updates };
      await this.setProcessingState(updatedState);
    } catch (error) {
      console.error('Update processing state failed:', error);
    }
  }

  /**
   * Clear processing state
   */
  async clearProcessingState() {
    try {
      await AsyncStorage.removeItem(this.PROCESSING_STATE_KEY);
    } catch (error) {
      console.error('Clear processing state failed:', error);
    }
  }

  /**
   * Recover from app restart
   */
  async recoverFromRestart() {
    try {
      // 1. Check processing state
      const processingState = await this.getProcessingState();
      
      if (processingState.isProcessing) {
        console.warn('Detected interrupted processing, recovering...');
        
        // 2. Calculate processing duration
        const processingDuration = Date.now() - processingState.startTime;
        
        // 3. If processing was too long, assume failure
        if (processingDuration > 5 * 60 * 1000) { // 5 minutes
          console.warn('Processing timeout, resetting state');
          await this.clearProcessingState();
          return { recovered: true, action: 'timeout_reset' };
        }
        
        // 4. Validate and repair queue
        const queue = await this.getQueueWithValidation();
        
        // 5. Remove already processed jobs
        const remainingJobs = queue.filter(job => 
          !processingState.processedJobs.includes(job.id)
        );
        
        // 6. Update queue
        await this.atomicWriteQueue(remainingJobs);
        
        // 7. Clear processing state
        await this.clearProcessingState();
        
        return { 
          recovered: true, 
          action: 'recovery_complete',
          processedJobs: processingState.processedJobs.length,
          remainingJobs: remainingJobs.length
        };
      }
      
      return { recovered: false, action: 'no_recovery_needed' };
    } catch (error) {
      console.error('Recovery from restart failed:', error);
      return { recovered: false, error: error.message };
    }
  }

  /**
   * Recover from app reinstall
   */
  async recoverFromReinstall() {
    try {
      // 1. Detect reinstall (no local data)
      const queueData = await AsyncStorage.getItem(this.QUEUE_KEY);
      const isReinstall = !queueData;
      
      if (isReinstall) {
        console.log('Detected app reinstall, initializing fresh state');
        
        // 2. Clear all local data
        await this.clearAllLocalData();
        
        // 3. Initialize fresh state
        await this.initializeFreshState();
        
        return { recovered: true, action: 'reinstall_recovery' };
      }
      
      return { recovered: false, action: 'no_reinstall_detected' };
    } catch (error) {
      console.error('Recover from reinstall failed:', error);
      return { recovered: false, error: error.message };
    }
  }

  /**
   * Clear all local data
   */
  async clearAllLocalData() {
    try {
      const keys = [
        this.QUEUE_KEY,
        this.QUEUE_BACKUP_KEY,
        this.PROCESSING_STATE_KEY,
        this.SERVER_STATE_KEY,
        this.IDEMPOTENCY_CACHE_KEY
      ];
      
      for (const key of keys) {
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Clear all local data failed:', error);
    }
  }

  /**
   * Initialize fresh state
   */
  async initializeFreshState() {
    try {
      // Initialize empty queue
      await this.atomicWriteQueue([]);
      
      // Initialize empty processing state
      await this.setProcessingState({
        isProcessing: false,
        processedJobs: [],
        failedJobs: []
      });
      
      // Initialize empty idempotency cache
      await this.setIdempotencyCache({});
      
      console.log('Fresh state initialized');
    } catch (error) {
      console.error('Initialize fresh state failed:', error);
    }
  }

  /**
   * Clear queue
   */
  async clearQueue() {
    try {
      await this.atomicWriteQueue([]);
      return { success: true };
    } catch (error) {
      console.error('Clear queue failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get convergence statistics
   */
  async getConvergenceStats() {
    try {
      const queue = await this.getQueueWithValidation();
      const processingState = await this.getProcessingState();
      const idempotencyCache = await this.getIdempotencyCache();
      
      return {
        queueSize: queue.length,
        isProcessing: processingState.isProcessing,
        processedJobsCount: processingState.processedJobs.length,
        failedJobsCount: processingState.failedJobs.length,
        idempotencyCacheSize: Object.keys(idempotencyCache).length,
        lastProcessingTime: processingState.startTime,
        converged: !processingState.isProcessing && queue.length === 0
      };
    } catch (error) {
      console.error('Get convergence stats failed:', error);
      return null;
    }
  }
}

// Create singleton instance
const convergenceService = new ConvergenceService();

export default convergenceService;
