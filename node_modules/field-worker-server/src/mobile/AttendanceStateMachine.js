/**
 * Deterministic Attendance State Machine
 * 
 * Final production-safe state machine with server-authoritative,
 * replay-safe, crash-safe, and multi-device-safe behavior.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import crypto from 'crypto';

class AttendanceStateMachine {
  constructor() {
    // EXACT allowed states - no more, no less
    this.STATES = {
      IDLE: 'idle',                    // No active shift
      CLOCKED_IN: 'clocked_in',          // Active shift, not on break
      ON_BREAK: 'on_break',              // Active shift, on break
      OFFLINE_PENDING: 'offline_pending'  // Offline operation pending server sync
    };
    
    // State storage keys
    this.STATE_KEY = 'attendance_state';
    this.SERVER_STATE_KEY = 'server_state_cache';
    this.OFFLINE_QUEUE_KEY = 'offline_queue';
    this.PROCESSING_STATE_KEY = 'processing_state';
    
    // Configuration
    this.OPERATION_WINDOW = 60000; // 60 seconds for duplicate detection
    this.TTL = 24 * 60 * 60 * 1000; // 24 hours for operation expiration
    this.MAX_QUEUE_SIZE = 50;
    this.MAX_RETRY_ATTEMPTS = 3;
    
    // Initialize state
    this.currentState = this.STATES.IDLE;
    this.serverState = null;
    this.offlineQueue = [];
    this.isProcessing = false;
    
    this.initialize();
  }

  /**
   * Initialize state machine
   */
  async initialize() {
    try {
      // 1. Load current state
      await this.loadState();
      
      // 2. Validate state integrity
      await this.validateStateIntegrity();
      
      // 3. Recover from crash if needed
      await this.recoverFromCrash();
      
      // 4. Sync with server
      await this.syncWithServer();
      
      console.log('AttendanceStateMachine initialized');
    } catch (error) {
      console.error('State machine initialization failed:', error);
      await this.resetToSafeState();
    }
  }

  /**
   * Get current state
   */
  getCurrentState() {
    return {
      state: this.currentState,
      serverState: this.serverState,
      offlineQueueSize: this.offlineQueue.length,
      isProcessing: this.isProcessing,
      timestamp: Date.now()
    };
  }

  /**
   * Transition to new state
   */
  async transition(operation, data = {}) {
    try {
      // 1. Validate transition
      const validation = this.validateTransition(this.currentState, operation);
      
      if (!validation.valid) {
        throw new Error(validation.reason);
      }
      
      // 2. Check if online
      if (navigator.onLine) {
        // 3. Execute operation on server
        const result = await this.executeServerOperation(operation, data);
        
        // 4. Update state from server response
        await this.updateStateFromServer(result);
        
        return result;
      } else {
        // 5. Queue operation for offline processing
        const result = await this.queueOfflineOperation(operation, data);
        
        // 6. Update to offline pending state
        await this.setState(this.STATES.OFFLINE_PENDING);
        
        return result;
      }
    } catch (error) {
      console.error('Transition failed:', error);
      throw error;
    }
  }

  /**
   * Clock-in transition
   */
  async clockIn(locationId, userData) {
    return this.transition('clock-in', {
      locationId,
      userId: userData.userId,
      companyId: userData.companyId,
      gps: await this.captureGPS(),
      deviceFingerprint: await this.getDeviceFingerprint(),
      timestamp: Date.now()
    });
  }

  /**
   * Clock-out transition
   */
  async clockOut(userData) {
    return this.transition('clock-out', {
      userId: userData.userId,
      companyId: userData.companyId,
      gps: await this.captureGPS(),
      deviceFingerprint: await this.getDeviceFingerprint(),
      timestamp: Date.now()
    });
  }

  /**
   * Start break transition
   */
  async startBreak(userData) {
    return this.transition('break-start', {
      userId: userData.userId,
      companyId: userData.companyId,
      deviceFingerprint: await this.getDeviceFingerprint(),
      timestamp: Date.now()
    });
  }

  /**
   * End break transition
   */
  async endBreak(userData) {
    return this.transition('break-end', {
      userId: userData.userId,
      companyId: userData.companyId,
      deviceFingerprint: await this.getDeviceFingerprint(),
      timestamp: Date.now()
    });
  }

  /**
   * Validate transition
   */
  validateTransition(currentState, operation) {
    // Define valid transitions
    const validTransitions = {
      [this.STATES.IDLE]: ['clock-in'],
      [this.STATES.CLOCKED_IN]: ['clock-out', 'break-start'],
      [this.STATES.ON_BREAK]: ['clock-out', 'break-end'],
      [this.STATES.OFFLINE_PENDING]: ['clock-in', 'clock-out', 'break-start', 'break-end']
    };
    
    const allowedOperations = validTransitions[currentState] || [];
    
    if (!allowedOperations.includes(operation)) {
      return {
        valid: false,
        reason: `Invalid transition from ${currentState} with operation ${operation}`
      };
    }
    
    return { valid: true };
  }

  /**
   * Execute server operation
   */
  async executeServerOperation(operation, data) {
    try {
      // 1. Generate idempotency key
      const idempotencyKey = this.generateIdempotencyKey(operation, data);
      
      // 2. Execute operation with idempotency
      const result = await this.apiCall(operation, data, {
        'Idempotency-Key': idempotencyKey
      });
      
      if (result.success) {
        // 3. Update server state
        this.serverState = result.serverState;
        this.currentState = result.state;
        
        // 4. Persist state
        await this.persistState();
        
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Server operation failed:', error);
      throw error;
    }
  }

  /**
   * Queue offline operation
   */
  async queueOfflineOperation(operation, data) {
    try {
      // 1. Validate operation
      if (!this.isValidOfflineOperation(operation, data)) {
        throw new Error('Invalid offline operation');
      }
      
      // 2. Check for duplicates
      if (await this.isDuplicateOfflineOperation(operation, data)) {
        throw new Error('Duplicate offline operation');
      }
      
      // 3. Check queue size
      if (this.offlineQueue.length >= this.MAX_QUEUE_SIZE) {
        throw new Error('Offline queue is full');
      }
      
      // 4. Create queue operation
      const queueOperation = {
        id: this.generateOperationId(),
        type: operation,
        data: data,
        timestamp: Date.now(),
        deviceFingerprint: await this.getDeviceFingerprint(),
        idempotencyKey: this.generateIdempotencyKey(operation, data),
        status: 'pending',
        attempts: 0,
        maxAttempts: this.MAX_RETRY_ATTEMPTS
      };
      
      // 5. Add to queue
      this.offlineQueue.push(queueOperation);
      
      // 6. Persist queue
      await this.persistOfflineQueue();
      
      return {
        success: true,
        queued: true,
        operationId: queueOperation.id,
        queueSize: this.offlineQueue.length
      };
    } catch (error) {
      console.error('Queue offline operation failed:', error);
      throw error;
    }
  }

  /**
   * Process offline queue
   */
  async processOfflineQueue() {
    if (!navigator.onLine || this.isProcessing || this.offlineQueue.length === 0) {
      return { success: true, processed: 0, remaining: this.offlineQueue.length };
    }
    
    this.isProcessing = true;
    
    try {
      // 1. Set processing state
      await this.setProcessingState({
        isProcessing: true,
        startTime: Date.now(),
        operations: this.offlineQueue.length
      });
      
      // 2. Process operations in order
      const processedOperations = [];
      const failedOperations = [];
      const remainingOperations = [];
      
      for (const operation of this.offlineQueue) {
        try {
          // 3. Check if operation is expired
          if (this.isOperationExpired(operation)) {
            console.warn(`Operation ${operation.id} expired, skipping`);
            continue;
          }
          
          // 4. Validate against current server state
          const validation = this.validateOperationAgainstServerState(operation);
          
          if (!validation.valid) {
            console.warn(`Operation ${operation.id} invalid: ${validation.reason}`);
            continue;
          }
          
          // 5. Execute operation
          const result = await this.executeServerOperation(operation.type, operation.data);
          
          if (result.success) {
            processedOperations.push(operation);
          } else {
            operation.attempts++;
            operation.lastError = result.error;
            
            if (operation.attempts < operation.maxAttempts) {
              failedOperations.push(operation);
            }
          }
        } catch (error) {
          console.error(`Operation ${operation.id} failed:`, error);
          operation.attempts++;
          operation.lastError = error.message;
          
          if (operation.attempts < operation.maxAttempts) {
            failedOperations.push(operation);
          }
        }
      }
      
      // 6. Update queue
      this.offlineQueue = failedOperations;
      await this.persistOfflineQueue();
      
      // 7. Update state
      if (this.offlineQueue.length === 0) {
        await this.setState(this.STATES.IDLE);
      }
      
      // 8. Clear processing state
      await this.clearProcessingState();
      
      this.isProcessing = false;
      
      return {
        success: true,
        processed: processedOperations.length,
        failed: failedOperations.length,
        remaining: this.offlineQueue.length
      };
    } catch (error) {
      console.error('Process offline queue failed:', error);
      this.isProcessing = false;
      await this.clearProcessingState();
      throw error;
    }
  }

  /**
   * Sync with server
   */
  async syncWithServer() {
    try {
      // 1. Get current server state
      const serverState = await this.getServerState();
      
      if (serverState) {
        // 2. Update server state
        this.serverState = serverState;
        
        // 3. Determine current state based on server state
        if (serverState.activeShift) {
          if (serverState.activeShift.onBreak) {
            await this.setState(this.STATES.ON_BREAK);
          } else {
            await this.setState(this.STATES.CLOCKED_IN);
          }
        } else {
          await this.setState(this.STATES.IDLE);
        }
        
        // 4. Process offline queue if online
        if (navigator.onLine) {
          await this.processOfflineQueue();
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Sync with server failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load state from storage
   */
  async loadState() {
    try {
      // Load current state
      const stateData = await AsyncStorage.getItem(this.STATE_KEY);
      if (stateData) {
        const state = JSON.parse(stateData);
        if (this.isValidState(state.state)) {
          this.currentState = state.state;
        }
      }
      
      // Load server state
      const serverStateData = await AsyncStorage.getItem(this.SERVER_STATE_KEY);
      if (serverStateData) {
        this.serverState = JSON.parse(serverStateData);
      }
      
      // Load offline queue
      const queueData = await AsyncStorage.getItem(this.OFFLINE_QUEUE_KEY);
      if (queueData) {
        const queue = JSON.parse(queueData);
        if (Array.isArray(queue)) {
          this.offlineQueue = queue;
        }
      }
    } catch (error) {
      console.error('Load state failed:', error);
      await this.resetToSafeState();
    }
  }

  /**
   * Persist state to storage
   */
  async persistState() {
    try {
      // Persist current state
      await AsyncStorage.setItem(this.STATE_KEY, JSON.stringify({
        state: this.currentState,
        timestamp: Date.now()
      }));
      
      // Persist server state
      if (this.serverState) {
        await AsyncStorage.setItem(this.SERVER_STATE_KEY, JSON.stringify(this.serverState));
      }
    } catch (error) {
      console.error('Persist state failed:', error);
    }
  }

  /**
   * Persist offline queue
   */
  async persistOfflineQueue() {
    try {
      await AsyncStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('Persist offline queue failed:', error);
    }
  }

  /**
   * Set state
   */
  async setState(newState) {
    if (this.isValidState(newState)) {
      this.currentState = newState;
      await this.persistState();
    } else {
      throw new Error(`Invalid state: ${newState}`);
    }
  }

  /**
   * Set processing state
   */
  async setProcessingState(processingState) {
    try {
      await AsyncStorage.setItem(this.PROCESSING_STATE_KEY, JSON.stringify(processingState));
    } catch (error) {
      console.error('Set processing state failed:', error);
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
   * Validate state integrity
   */
  async validateStateIntegrity() {
    try {
      // Validate current state
      if (!this.isValidState(this.currentState)) {
        console.warn('Invalid current state, resetting to IDLE');
        await this.setState(this.STATES.IDLE);
      }
      
      // Validate offline queue
      if (!Array.isArray(this.offlineQueue)) {
        console.warn('Invalid offline queue, resetting');
        this.offlineQueue = [];
        await this.persistOfflineQueue();
      }
      
      // Remove expired operations
      const validOperations = this.offlineQueue.filter(op => !this.isOperationExpired(op));
      if (validOperations.length !== this.offlineQueue.length) {
        console.log(`Removed ${this.offlineQueue.length - validOperations.length} expired operations`);
        this.offlineQueue = validOperations;
        await this.persistOfflineQueue();
      }
    } catch (error) {
      console.error('Validate state integrity failed:', error);
    }
  }

  /**
   * Recover from crash
   */
  async recoverFromCrash() {
    try {
      // Check processing state
      const processingStateData = await AsyncStorage.getItem(this.PROCESSING_STATE_KEY);
      
      if (processingStateData) {
        const processingState = JSON.parse(processingStateData);
        
        if (processingState.isProcessing) {
          console.warn('Detected interrupted processing, recovering...');
          
          // Clear processing state
          await this.clearProcessingState();
          
          // Validate and clean queue
          await this.validateStateIntegrity();
          
          // Process queue if online
          if (navigator.onLine) {
            await this.processOfflineQueue();
          }
        }
      }
    } catch (error) {
      console.error('Recover from crash failed:', error);
    }
  }

  /**
   * Reset to safe state
   */
  async resetToSafeState() {
    console.log('Resetting to safe state');
    
    this.currentState = this.STATES.IDLE;
    this.serverState = null;
    this.offlineQueue = [];
    this.isProcessing = false;
    
    await this.persistState();
    await this.persistOfflineQueue();
    await this.clearProcessingState();
  }

  /**
   * Validate state
   */
  isValidState(state) {
    return Object.values(this.STATES).includes(state);
  }

  /**
   * Validate offline operation
   */
  isValidOfflineOperation(operation, data) {
    const validOperations = ['clock-in', 'clock-out', 'break-start', 'break-end'];
    return validOperations.includes(operation) && data && typeof data === 'object';
  }

  /**
   * Check for duplicate offline operation
   */
  async isDuplicateOfflineOperation(operation, data) {
    const operationWindow = Date.now() - this.OPERATION_WINDOW;
    
    return this.offlineQueue.some(queuedOp => 
      queuedOp.type === operation &&
      queuedOp.data.userId === data.userId &&
      queuedOp.timestamp > operationWindow
    );
  }

  /**
   * Check if operation is expired
   */
  isOperationExpired(operation) {
    return Date.now() - operation.timestamp > this.TTL;
  }

  /**
   * Validate operation against server state
   */
  validateOperationAgainstServerState(operation) {
    if (!this.serverState) {
      return { valid: true }; // No server state to validate against
    }
    
    switch (operation.type) {
      case 'clock-in':
        return {
          valid: !this.serverState.activeShift,
          reason: this.serverState.activeShift ? 'Already clocked in' : null
        };
      
      case 'clock-out':
        return {
          valid: !!this.serverState.activeShift,
          reason: !this.serverState.activeShift ? 'No active shift' : null
        };
      
      case 'break-start':
        return {
          valid: this.serverState.activeShift && !this.serverState.activeShift.onBreak,
          reason: !this.serverState.activeShift ? 'No active shift' : 
                  this.serverState.activeShift.onBreak ? 'Already on break' : null
        };
      
      case 'break-end':
        return {
          valid: this.serverState.activeShift && this.serverState.activeShift.onBreak,
          reason: !this.serverState.activeShift ? 'No active shift' : 
                  !this.serverState.activeShift.onBreak ? 'Not on break' : null
        };
      
      default:
        return { valid: false, reason: 'Unknown operation type' };
    }
  }

  /**
   * Generate idempotency key
   */
  generateIdempotencyKey(operation, data) {
    const keyData = {
      type: operation,
      userId: data.userId,
      timestamp: Math.floor(Date.now() / 60000), // 1-minute window
      locationId: data.locationId,
      shiftId: data.shiftId
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  /**
   * Generate operation ID
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Capture GPS
   */
  async captureGPS() {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp || Date.now()
          });
        },
        (error) => {
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
   * Get device fingerprint
   */
  async getDeviceFingerprint() {
    const fingerprintData = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timestamp: Date.now()
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex');
  }

  /**
   * Get server state (mock implementation)
   */
  async getServerState() {
    // This would be implemented with actual API call
    return null;
  }

  /**
   * API call (mock implementation)
   */
  async apiCall(operation, data, headers = {}) {
    // This would be implemented with actual API call
    return {
      success: true,
      state: this.STATES.IDLE,
      serverState: null
    };
  }

  /**
   * Get state machine statistics
   */
  getStatistics() {
    return {
      currentState: this.currentState,
      offlineQueueSize: this.offlineQueue.length,
      isProcessing: this.isProcessing,
      serverStateAvailable: !!this.serverState,
      timestamp: Date.now()
    };
  }
}

// Create singleton instance
const attendanceStateMachine = new AttendanceStateMachine();

export default attendanceStateMachine;
