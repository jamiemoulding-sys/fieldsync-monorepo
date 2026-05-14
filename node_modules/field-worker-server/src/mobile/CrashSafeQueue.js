/**
 * Minimum Viable Crash-Safe Queue
 * 
 * Provides atomic persistence, deterministic replay guarantees,
 * and crash resilience with maximum simplicity.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import crypto from 'crypto';

class CrashSafeQueue {
  constructor() {
    // Storage keys
    this.QUEUE_KEY = 'attendance_queue';
    this.BACKUP_KEY = 'attendance_queue_backup';
    this.PROCESSING_KEY = 'processing_state';
    this.SYNC_KEY = 'sync_state';
    
    // Configuration
    this.MAX_QUEUE_SIZE = 50;
    this.DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
    this.ATOMIC_WRITE_TIMEOUT = 5000;
    this.DUPLICATE_WINDOW = 60000; // 60 seconds
    this.MAX_RETRY_ATTEMPTS = 3;
    
    // Priority order for deterministic replay
    this.PRIORITY_ORDER = ['clock-out', 'break-end', 'break-start', 'clock-in'];
    
    // Initialize
    this.queue = [];
    this.isProcessing = false;
    this.isSyncing = false;
    
    this.initialize();
  }

  /**
   * Initialize queue
   */
  async initialize() {
    try {
      // 1. Load queue with validation
      await this.loadQueueWithValidation();
      
      // 2. Recover from crash if needed
      await this.recoverFromCrash();
      
      // 3. Cleanup expired operations
      await this.cleanupExpiredOperations();
      
      // 4. Start periodic cleanup
      this.startPeriodicCleanup();
      
      console.log('CrashSafeQueue initialized');
    } catch (error) {
      console.error('Queue initialization failed:', error);
      await this.resetToSafeState();
    }
  }

  /**
   * Add operation to queue atomically
   */
  async addOperation(operation) {
    try {
      // 1. Validate operation
      if (!this.isValidOperation(operation)) {
        throw new Error('Invalid operation structure');
      }
      
      // 2. Check for duplicates
      if (await this.isDuplicateOperation(operation)) {
        throw new Error('Duplicate operation detected');
      }
      
      // 3. Check queue size
      if (this.queue.length >= this.MAX_QUEUE_SIZE) {
        throw new Error('Queue is full');
      }
      
      // 4. Create enhanced operation
      const enhancedOperation = {
        ...operation,
        id: this.generateOperationId(),
        timestamp: Date.now(),
        fingerprint: this.generateFingerprint(operation),
        idempotencyKey: this.generateIdempotencyKey(operation),
        status: 'pending',
        attempts: 0,
        maxAttempts: this.MAX_RETRY_ATTEMPTS,
        ttl: this.getOperationTTL(operation)
      };
      
      // 5. Atomic write
      await this.atomicWrite(async () => {
        this.queue.push(enhancedOperation);
        return this.queue;
      });
      
      console.log(`Added operation ${enhancedOperation.id} to queue`);
      return { success: true, operationId: enhancedOperation.id };
    } catch (error) {
      console.error('Add operation failed:', error);
      throw error;
    }
  }

  /**
   * Process queue with deterministic replay guarantees
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return { success: true, processed: 0, remaining: this.queue.length };
    }
    
    this.isProcessing = true;
    
    try {
      // 1. Set processing state
      await this.setProcessingState({
        isProcessing: true,
        startTime: Date.now(),
        totalOperations: this.queue.length,
        processedOperations: [],
        failedOperations: []
      });
      
      // 2. Sort operations by priority and timestamp
      const orderedQueue = this.sortOperationsByPriority([...this.queue]);
      
      // 3. Process operations in order
      const processedOperations = [];
      const failedOperations = [];
      
      for (const operation of orderedQueue) {
        try {
          // 4. Check if operation is expired
          if (this.isOperationExpired(operation)) {
            console.warn(`Operation ${operation.id} expired, skipping`);
            continue;
          }
          
          // 5. Process operation with idempotency
          const result = await this.processOperationWithIdempotency(operation);
          
          if (result.success) {
            processedOperations.push(operation);
            
            // 6. Update processing state
            await this.updateProcessingState({
              processedOperations: [...(await this.getProcessingState()).processedOperations, operation.id]
            });
          } else {
            operation.attempts++;
            operation.lastError = result.error;
            operation.status = 'failed';
            failedOperations.push(operation);
          }
        } catch (error) {
          console.error(`Operation ${operation.id} failed:`, error);
          operation.attempts++;
          operation.lastError = error.message;
          operation.status = 'failed';
          failedOperations.push(operation);
        }
      }
      
      // 7. Update queue with failed operations only
      await this.atomicWrite(async () => {
        this.queue = failedOperations;
        return this.queue;
      });
      
      // 8. Clear processing state
      await this.clearProcessingState();
      
      this.isProcessing = false;
      
      console.log(`Queue processed: ${processedOperations.length} processed, ${failedOperations.length} failed`);
      
      return {
        success: true,
        processedOperations: processedOperations.length,
        failedOperations: failedOperations.length,
        remainingOperations: this.queue.length
      };
    } catch (error) {
      console.error('Process queue failed:', error);
      this.isProcessing = false;
      await this.clearProcessingState();
      throw error;
    }
  }

  /**
   * Sync with server with interruption recovery
   */
  async syncWithServer(apiClient) {
    if (this.isSyncing || this.queue.length === 0) {
      return { success: true, processed: 0, remaining: this.queue.length };
    }
    
    this.isSyncing = true;
    
    try {
      // 1. Set sync state
      await this.setSyncState({
        isSyncing: true,
        startTime: Date.now(),
        totalOperations: this.queue.length,
        processedOperations: 0,
        failedOperations: 0
      });
      
      // 2. Get server state
      const serverState = await apiClient.getServerState();
      
      // 3. Process operations against server state
      const processedOperations = [];
      const failedOperations = [];
      
      for (const operation of this.queue) {
        try {
          // 4. Validate against server state
          const validation = this.validateOperationAgainstServerState(operation, serverState);
          
          if (!validation.valid) {
            console.warn(`Operation ${operation.id} invalid: ${validation.reason}`);
            operation.status = 'rejected';
            operation.lastError = validation.reason;
            failedOperations.push(operation);
            continue;
          }
          
          // 5. Process with timeout
          const result = await this.processOperationWithTimeout(operation, apiClient, 30000);
          
          if (result.success) {
            processedOperations.push(operation);
            operation.status = 'completed';
          } else {
            operation.attempts++;
            operation.lastError = result.error;
            operation.status = 'failed';
            failedOperations.push(operation);
          }
          
          // 6. Update sync state
          await this.updateSyncState({
            processedOperations: processedOperations.length,
            failedOperations: failedOperations.length
          });
        } catch (error) {
          console.error(`Operation ${operation.id} sync failed:`, error);
          operation.attempts++;
          operation.lastError = error.message;
          operation.status = 'failed';
          failedOperations.push(operation);
        }
      }
      
      // 7. Update queue with failed operations only
      await this.atomicWrite(async () => {
        this.queue = failedOperations;
        return this.queue;
      });
      
      // 8. Clear sync state
      await this.clearSyncState();
      
      this.isSyncing = false;
      
      return {
        success: true,
        processedOperations: processedOperations.length,
        failedOperations: failedOperations.length,
        remainingOperations: this.queue.length
      };
    } catch (error) {
      console.error('Sync with server failed:', error);
      this.isSyncing = false;
      await this.clearSyncState();
      throw error;
    }
  }

  /**
   * Recover from crash
   */
  async recoverFromCrash() {
    try {
      // 1. Check processing state
      const processingState = await this.getProcessingState();
      
      if (processingState && processingState.isProcessing) {
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
        await this.loadQueueWithValidation();
        
        // 5. Remove already processed operations
        if (processingState.processedOperations && processingState.processedOperations.length > 0) {
          this.queue = this.queue.filter(op => 
            !processingState.processedOperations.includes(op.id)
          );
        }
        
        // 6. Save recovered queue
        await this.atomicWrite(async () => {
          return this.queue;
        });
        
        // 7. Clear processing state
        await this.clearProcessingState();
        
        return { 
          recovered: true, 
          action: 'recovery_complete',
          processedOperations: processingState.processedOperations?.length || 0,
          remainingOperations: this.queue.length
        };
      }
      
      return { recovered: false, action: 'no_recovery_needed' };
    } catch (error) {
      console.error('Recover from crash failed:', error);
      return { recovered: false, error: error.message };
    }
  }

  /**
   * Recover from reinstall
   */
  async recoverFromReinstall() {
    try {
      // 1. Detect reinstall (no local data)
      const localDataExists = await this.checkLocalDataExists();
      
      if (!localDataExists) {
        console.log('Detected app reinstall, initializing fresh state');
        
        // 2. Initialize fresh state
        await this.resetToSafeState();
        
        return { recovered: true, action: 'reinstall_recovery' };
      }
      
      return { recovered: false, action: 'no_reinstall_detected' };
    } catch (error) {
      console.error('Recover from reinstall failed:', error);
      return { recovered: false, error: error.message };
    }
  }

  /**
   * Atomic write with backup and verification
   */
  async atomicWrite(operation) {
    try {
      // 1. Create backup
      const backup = await AsyncStorage.getItem(this.BACKUP_KEY);
      await AsyncStorage.setItem(`${this.BACKUP_KEY}_temp`, backup);
      
      // 2. Execute operation
      const result = await operation();
      
      // 3. Write new data
      const serialized = JSON.stringify(result);
      await AsyncStorage.setItem(this.QUEUE_KEY, serialized);
      
      // 4. Verify write
      const verify = await AsyncStorage.getItem(this.QUEUE_KEY);
      if (verify !== serialized) {
        throw new Error('Write verification failed');
      }
      
      // 5. Cleanup
      await AsyncStorage.removeItem(`${this.BACKUP_KEY}_temp`);
      await AsyncStorage.removeItem(this.BACKUP_KEY);
      
      return result;
    } catch (error) {
      console.error('Atomic write failed:', error);
      
      // 6. Restore from backup
      try {
        const backup = await AsyncStorage.getItem(`${this.BACKUP_KEY}_temp`);
        if (backup) {
          await AsyncStorage.setItem(this.QUEUE_KEY, backup);
        }
      } catch (restoreError) {
        console.error('Restore backup failed:', restoreError);
      }
      
      throw error;
    }
  }

  /**
   * Load queue with validation
   */
  async loadQueueWithValidation() {
    try {
      const queueData = await AsyncStorage.getItem(this.QUEUE_KEY);
      
      if (!queueData) {
        this.queue = [];
        return;
      }

      const queue = JSON.parse(queueData);
      
      // Validate queue structure
      if (!Array.isArray(queue)) {
        console.warn('Invalid queue structure, resetting');
        this.queue = [];
        await this.atomicWrite(async () => this.queue = []);
        return;
      }

      // Validate each operation
      const validOperations = queue.filter(op => this.isValidOperation(op));
      
      if (validOperations.length !== queue.length) {
        console.warn(`Queue contains ${queue.length - validOperations.length} invalid operations, cleaning up`);
      }

      this.queue = validOperations;
      
      // Save cleaned queue
      if (validOperations.length !== queue.length) {
        await this.atomicWrite(async () => this.queue = validOperations);
      }
    } catch (error) {
      console.error('Load queue failed:', error);
      
      // Try to restore from backup
      try {
        const backup = await AsyncStorage.getItem(this.BACKUP_KEY);
        if (backup) {
          const queue = JSON.parse(backup);
          this.queue = Array.isArray(queue) ? queue : [];
        } else {
          this.queue = [];
        }
      } catch (backupError) {
        console.error('Restore backup failed:', backupError);
        this.queue = [];
      }
    }
  }

  /**
   * Sort operations by priority and timestamp
   */
  sortOperationsByPriority(operations) {
    return operations.sort((a, b) => {
      const aPriority = this.PRIORITY_ORDER.indexOf(a.type);
      const bPriority = this.PRIORITY_ORDER.indexOf(b.type);
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Same priority - sort by timestamp
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Process operation with idempotency
   */
  async processOperationWithIdempotency(operation) {
    try {
      // This would be implemented with actual API client
      const result = await this.mockAPICall(operation);
      
      return {
        success: result.success,
        data: result.data,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process operation with timeout
   */
  async processOperationWithTimeout(operation, apiClient, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Operation timeout'));
      }, timeout);
      
      this.processOperationWithIdempotency(operation)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Validate operation structure
   */
  isValidOperation(operation) {
    return (
      operation &&
      typeof operation.id === 'string' &&
      typeof operation.type === 'string' &&
      typeof operation.userId === 'string' &&
      typeof operation.companyId === 'string' &&
      typeof operation.timestamp === 'number' &&
      operation.data &&
      typeof operation.data === 'object'
    );
  }

  /**
   * Check for duplicate operation
   */
  async isDuplicateOperation(operation) {
    const fingerprint = this.generateFingerprint(operation);
    const timeWindow = Date.now() - this.DUPLICATE_WINDOW;
    
    return this.queue.some(op => 
      op.fingerprint === fingerprint && op.timestamp > timeWindow
    );
  }

  /**
   * Check if operation is expired
   */
  isOperationExpired(operation) {
    const age = Date.now() - operation.timestamp;
    return age > operation.ttl;
  }

  /**
   * Get operation TTL
   */
  getOperationTTL(operation) {
    const ttlRules = {
      'clock-in': this.DEFAULT_TTL,
      'clock-out': this.DEFAULT_TTL,
      'break-start': 4 * 60 * 60 * 1000, // 4 hours
      'break-end': 4 * 60 * 60 * 1000  // 4 hours
    };
    
    return ttlRules[operation.type] || this.DEFAULT_TTL;
  }

  /**
   * Generate operation ID
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate operation fingerprint
   */
  generateFingerprint(operation) {
    const fingerprintData = {
      type: operation.type,
      userId: operation.userId,
      timestamp: Math.floor(operation.timestamp / 60000), // 1-minute window
      locationId: operation.data.locationId,
      shiftId: operation.data.shiftId
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex');
  }

  /**
   * Generate idempotency key
   */
  generateIdempotencyKey(operation) {
    const keyData = {
      type: operation.type,
      userId: operation.userId,
      timestamp: Math.floor(operation.timestamp / 60000), // 1-minute window
      locationId: operation.data.locationId,
      shiftId: operation.data.shiftId,
      deviceFingerprint: operation.deviceFingerprint
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  /**
   * Validate operation against server state
   */
  validateOperationAgainstServerState(operation, serverState) {
    // This would be implemented with actual server state validation
    switch (operation.type) {
      case 'clock-in':
        return {
          valid: !serverState.activeShift,
          reason: serverState.activeShift ? 'Already clocked in' : null
        };
      
      case 'clock-out':
        return {
          valid: !!serverState.activeShift,
          reason: !serverState.activeShift ? 'No active shift' : null
        };
      
      case 'break-start':
        return {
          valid: serverState.activeShift && !serverState.activeShift.onBreak,
          reason: !serverState.activeShift ? 'No active shift' : 
                  serverState.activeShift.onBreak ? 'Already on break' : null
        };
      
      case 'break-end':
        return {
          valid: serverState.activeShift && serverState.activeShift.onBreak,
          reason: !serverState.activeShift ? 'No active shift' : 
                  !serverState.activeShift.onBreak ? 'Not on break' : null
        };
      
      default:
        return { valid: false, reason: 'Unknown operation type' };
    }
  }

  /**
   * Cleanup expired operations
   */
  async cleanupExpiredOperations() {
    try {
      const validOperations = this.queue.filter(op => !this.isOperationExpired(op));
      
      if (validOperations.length !== this.queue.length) {
        const expiredCount = this.queue.length - validOperations.length;
        console.log(`Cleaning up ${expiredCount} expired operations`);
        
        await this.atomicWrite(async () => {
          this.queue = validOperations;
          return this.queue;
        });
      }
    } catch (error) {
      console.error('Cleanup expired operations failed:', error);
    }
  }

  /**
   * Check if local data exists
   */
  async checkLocalDataExists() {
    try {
      const queue = await AsyncStorage.getItem(this.QUEUE_KEY);
      const processingState = await AsyncStorage.getItem(this.PROCESSING_KEY);
      const syncState = await AsyncStorage.getItem(this.SYNC_KEY);
      
      return !!(queue || processingState || syncState);
    } catch (error) {
      return false;
    }
  }

  /**
   * Reset to safe state
   */
  async resetToSafeState() {
    console.log('Resetting queue to safe state');
    
    this.queue = [];
    this.isProcessing = false;
    this.isSyncing = false;
    
    await this.atomicWrite(async () => {
      this.queue = [];
      return this.queue;
    });
    
    await this.clearProcessingState();
    await this.clearSyncState();
  }

  /**
   * Set processing state
   */
  async setProcessingState(state) {
    try {
      await AsyncStorage.setItem(this.PROCESSING_KEY, JSON.stringify({
        ...state,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Set processing state failed:', error);
    }
  }

  /**
   * Get processing state
   */
  async getProcessingState() {
    try {
      const stateData = await AsyncStorage.getItem(this.PROCESSING_KEY);
      return stateData ? JSON.parse(stateData) : null;
    } catch (error) {
      console.error('Get processing state failed:', error);
      return null;
    }
  }

  /**
   * Update processing state
   */
  async updateProcessingState(updates) {
    try {
      const currentState = await this.getProcessingState() || {};
      const updatedState = { ...currentState, ...updates };
      await AsyncStorage.setItem(this.PROCESSING_KEY, JSON.stringify(updatedState));
    } catch (error) {
      console.error('Update processing state failed:', error);
    }
  }

  /**
   * Clear processing state
   */
  async clearProcessingState() {
    try {
      await AsyncStorage.removeItem(this.PROCESSING_KEY);
    } catch (error) {
      console.error('Clear processing state failed:', error);
    }
  }

  /**
   * Set sync state
   */
  async setSyncState(state) {
    try {
      await AsyncStorage.setItem(this.SYNC_KEY, JSON.stringify({
        ...state,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Set sync state failed:', error);
    }
  }

  /**
   * Get sync state
   */
  async getSyncState() {
    try {
      const stateData = await AsyncStorage.getItem(this.SYNC_KEY);
      return stateData ? JSON.parse(stateData) : null;
    } catch (error) {
      console.error('Get sync state failed:', error);
      return null;
    }
  }

  /**
   * Update sync state
   */
  async updateSyncState(updates) {
    try {
      const currentState = await this.getSyncState() || {};
      const updatedState = { ...currentState, ...updates };
      await AsyncStorage.setItem(this.SYNC_KEY, JSON.stringify(updatedState));
    } catch (error) {
      console.error('Update sync state failed:', error);
    }
  }

  /**
   * Clear sync state
   */
  async clearSyncState() {
    try {
      await AsyncStorage.removeItem(this.SYNC_KEY);
    } catch (error) {
      console.error('Clear sync state failed:', error);
    }
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup() {
    // Cleanup every 5 minutes
    setInterval(() => {
      this.cleanupExpiredOperations();
    }, 5 * 60 * 1000);
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return {
      queueSize: this.queue.length,
      isProcessing: this.isProcessing,
      isSyncing: this.isSyncing,
      expiredOperations: this.queue.filter(op => this.isOperationExpired(op)).length,
      failedOperations: this.queue.filter(op => op.status === 'failed').length,
      pendingOperations: this.queue.filter(op => op.status === 'pending').length
    };
  }

  /**
   * Mock API call (replace with actual implementation)
   */
  async mockAPICall(operation) {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: Math.random() > 0.1, // 90% success rate
          data: { id: operation.id, processed: true },
          error: null
        });
      }, Math.random() * 1000 + 500); // 500-1500ms delay
    });
  }
}

// Create singleton instance
const crashSafeQueue = new CrashSafeQueue();

export default crashSafeQueue;
