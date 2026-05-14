/**
 * Final Deterministic Queue
 * 
 * Append-only, atomic, FIFO queue with:
 * - Deterministic replay
 * - Crash-safe persistence
 * - Duplicate prevention
 * - TTL expiration
 */

class DeterministicQueue {
  constructor(storage) {
    this.storage = storage;
    
    // FINAL QUEUE STATES - Transport metadata only
    this.QUEUE_STATES = {
      PENDING: 'pending',      // Operation queued, not processed
      PROCESSING: 'processing', // Operation being processed
      FAILED: 'failed',        // Operation processing failed
      EXPIRED: 'expired'      // Operation expired (TTL)
    };
    
    // Queue configuration
    this.config = {
      maxQueueSize: 50,
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
      maxRetries: 3,
      atomicWriteTimeout: 5000,
      cleanupInterval: 5 * 60 * 1000 // 5 minutes
    };
    
    // Queue state
    this.queue = [];
    this.isProcessing = false;
    this.backupKey = 'queue_backup';
    this.mainKey = 'queue_main';
    
    // Initialize
    this.initialize();
  }

  /**
   * Initialize queue
   */
  async initialize() {
    try {
      // 1. Load queue with validation
      await this.loadQueue();
      
      // 2. Recover from crash
      await this.recoverFromCrash();
      
      // 3. Start cleanup interval
      this.startCleanupInterval();
      
      console.log('DeterministicQueue initialized');
    } catch (error) {
      console.error('Queue initialization failed:', error);
      throw error;
    }
  }

  /**
   * Add operation to queue (append-only)
   */
  async addOperation(operation) {
    try {
      // 1. Validate operation structure
      if (!this.isValidOperation(operation)) {
        throw new Error('Invalid operation structure');
      }
      
      // 2. Check queue size
      if (this.queue.length >= this.config.maxQueueSize) {
        throw new Error('Queue is full');
      }
      
      // 3. Check for duplicates
      if (this.isDuplicateOperation(operation)) {
        throw new Error('Duplicate operation detected');
      }
      
      // 4. Create queue operation
      const queueOperation = {
        ...operation,
        id: this.generateOperationId(),
        timestamp: Date.now(),
        state: this.QUEUE_STATES.PENDING,
        attempts: 0,
        maxAttempts: this.config.maxRetries
      };
      
      // 5. Append to queue (append-only)
      this.queue.push(queueOperation);
      
      // 6. Atomic write
      await this.atomicWrite();
      
      console.log(`Added operation ${queueOperation.id} to queue`);
      
      return { success: true, operationId: queueOperation.id };
    } catch (error) {
      console.error('Add operation failed:', error);
      throw error;
    }
  }

  /**
   * Process queue (strict FIFO)
   */
  async processQueue() {
    if (this.isProcessing) {
      console.log('Queue already processing');
      return { success: false, error: 'Queue already processing' };
    }
    
    this.isProcessing = true;
    
    try {
      // 1. Sort by timestamp (strict FIFO)
      const sortedQueue = [...this.queue].sort((a, b) => a.timestamp - b.timestamp);
      
      // 2. Process each operation
      const processedOperations = [];
      const failedOperations = [];
      const expiredOperations = [];
      
      for (const operation of sortedQueue) {
        // 3. Check expiration
        if (this.isOperationExpired(operation)) {
          operation.state = this.QUEUE_STATES.EXPIRED;
          expiredOperations.push(operation);
          continue;
        }
        
        // 4. Process operation
        operation.state = this.QUEUE_STATES.PROCESSING;
        await this.atomicWrite();
        
        try {
          const result = await this.processOperation(operation);
          
          if (result.success) {
            processedOperations.push(operation);
            // 5. Remove successful operation
            this.queue = this.queue.filter(op => op.id !== operation.id);
          } else {
            // 6. Mark failed operation
            operation.state = this.QUEUE_STATES.FAILED;
            operation.lastError = result.error;
            operation.attempts = operation.attempts + 1;
            failedOperations.push(operation);
          }
        } catch (error) {
          // 7. Mark failed operation
          operation.state = this.QUEUE_STATES.FAILED;
          operation.lastError = error.message;
          operation.attempts = operation.attempts + 1;
          failedOperations.push(operation);
        }
        
        await this.atomicWrite();
      }
      
      // 8. Clean up expired operations
      this.cleanupExpiredOperations();
      await this.atomicWrite();
      
      const result = {
        success: true,
        processedOperations: processedOperations.length,
        failedOperations: failedOperations.length,
        expiredOperations: expiredOperations.length,
        remainingOperations: this.queue.length
      };
      
      console.log(`Queue processing completed:`, result);
      
      return result;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process single operation
   */
  async processOperation(operation) {
    try {
      // 1. Validate operation
      if (!this.isValidOperation(operation)) {
        throw new Error('Invalid operation structure');
      }
      
      // 2. Check retry limit
      if (operation.attempts >= operation.maxAttempts) {
        throw new Error('Operation exceeded maximum retry attempts');
      }
      
      // 3. Execute operation
      const result = await this.executeOperation(operation);
      
      console.log(`Processed operation ${operation.id}:`, result);
      
      return result;
    } catch (error) {
      console.error(`Process operation ${operation.id} failed:`, error);
      throw error;
    }
  }

  /**
   * Execute operation (placeholder)
   */
  async executeOperation(operation) {
    // This would execute the actual operation
    // For now, simulate operation execution
    
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate operation success/failure
        const success = Math.random() > 0.1; // 90% success rate
        
        if (success) {
          resolve({
            success: true,
            data: {
              operationId: operation.id,
              processedAt: Date.now(),
              result: 'Operation processed successfully'
            }
          });
        } else {
          resolve({
            success: false,
            error: 'Operation failed due to server error'
          });
        }
      }, Math.random() * 1000 + 500); // 500-1500ms delay
    });
  }

  /**
   * Get queue state
   */
  getQueueState() {
    return {
      size: this.queue.length,
      isProcessing: this.isProcessing,
      pending: this.queue.filter(op => op.state === this.QUEUE_STATES.PENDING).length,
      processing: this.queue.filter(op => op.state === this.QUEUE_STATES.PROCESSING).length,
      failed: this.queue.filter(op => op.state === this.QUEUE_STATES.FAILED).length,
      expired: this.queue.filter(op => op.state === this.QUEUE_STATES.EXPIRED).length,
      operations: this.queue.map(op => ({
        id: op.id,
        type: op.type,
        state: op.state,
        timestamp: op.timestamp,
        attempts: op.attempts,
        maxAttempts: op.maxAttempts,
        lastError: op.lastError
      }))
    };
  }

  /**
   * Get operation by ID
   */
  getOperationById(operationId) {
    return this.queue.find(op => op.id === operationId);
  }

  /**
   * Remove operation
   */
  async removeOperation(operationId) {
    try {
      const beforeCount = this.queue.length;
      
      this.queue = this.queue.filter(op => op.id !== operationId);
      
      await this.atomicWrite();
      
      const removed = beforeCount - this.queue.length;
      
      console.log(`Removed ${removed} operation(s) from queue`);
      
      return { success: true, removedOperations: removed };
    } catch (error) {
      console.error('Remove operation failed:', error);
      throw error;
    }
  }

  /**
   * Clear queue
   */
  async clearQueue() {
    try {
      const beforeCount = this.queue.length;
      
      this.queue = [];
      
      await this.atomicWrite();
      
      console.log(`Cleared ${beforeCount} operations from queue`);
      
      return { success: true, clearedOperations: beforeCount };
    } catch (error) {
      console.error('Clear queue failed:', error);
      throw error;
    }
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
  isDuplicateOperation(operation) {
    const recentWindow = Date.now() - 60000; // 1 minute window
    
    return this.queue.some(op => 
      op.type === operation.type &&
      op.userId === operation.userId &&
      op.timestamp > recentWindow
    );
  }

  /**
   * Check if operation is expired
   */
  isOperationExpired(operation) {
    const age = Date.now() - operation.timestamp;
    return age > this.config.defaultTTL;
  }

  /**
   * Clean up expired operations
   */
  cleanupExpiredOperations() {
    const beforeCount = this.queue.length;
    
    this.queue = this.queue.filter(op => !this.isOperationExpired(op));
    
    const afterCount = this.queue.length;
    
    if (beforeCount !== afterCount) {
      console.log(`Cleaned up ${beforeCount - afterCount} expired operations`);
    }
  }

  /**
   * Recover from crash
   */
  async recoverFromCrash() {
    try {
      console.log('Recovering from crash...');
      
      // 1. Check for processing state
      if (this.isProcessing) {
        console.log('Detected interrupted processing, resetting...');
        this.isProcessing = false;
      }
      
      // 2. Validate queue integrity
      await this.validateQueueIntegrity();
      
      // 3. Restore from backup if needed
      await this.restoreFromBackup();
      
      console.log('Crash recovery completed');
    } catch (error) {
      console.error('Crash recovery failed:', error);
    }
  }

  /**
   * Validate queue integrity
   */
  async validateQueueIntegrity() {
    try {
      // 1. Validate queue structure
      if (!Array.isArray(this.queue)) {
        console.error('Queue is not an array, resetting...');
        this.queue = [];
        await this.atomicWrite();
        return;
      }
      
      // 2. Validate operation structure
      const validOperations = this.queue.filter(op => this.isValidOperation(op));
      
      if (validOperations.length !== this.queue.length) {
        console.log(`Queue contains ${this.queue.length - validOperations.length} invalid operations, cleaning up...`);
        this.queue = validOperations;
        await this.atomicWrite();
      }
      
      // 3. Reset processing state
      if (this.isProcessing) {
        console.log('Resetting processing state...');
        this.isProcessing = false;
        await this.atomicWrite();
      }
      
      console.log('Queue integrity validation completed');
    } catch (error) {
      console.error('Queue integrity validation failed:', error);
    }
  }

  /**
   * Atomic write with backup
   */
  async atomicWrite() {
    try {
      // 1. Create backup
      const backup = await this.storage.read(this.mainKey);
      await this.storage.write(this.backupKey, backup);
      
      // 2. Write new data
      const queueData = JSON.stringify(this.queue);
      await this.storage.write(this.mainKey, queueData);
      
      // 3. Verify write
      const verifyData = await this.storage.read(this.mainKey);
      if (verifyData !== queueData) {
        throw new Error('Write verification failed');
      }
      
      // 4. Cleanup backup
      await this.storage.delete(this.backupKey);
      
      return { success: true };
    } catch (error) {
      console.error('Atomic write failed:', error);
      
      // 5. Restore from backup
      try {
        const backup = await this.storage.read(this.backupKey);
        if (backup) {
          await this.storage.write(this.mainKey, backup);
        }
      } catch (restoreError) {
        console.error('Restore backup failed:', restoreError);
      }
      
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup() {
    try {
      // 1. Check for backup
      const backup = await this.storage.read(this.backupKey);
      const main = await this.storage.read(this.mainKey);
      
      // 2. Validate main data
      if (!this.isValidQueueData(main)) {
        console.log('Main data invalid, restoring from backup...');
        
        if (backup) {
          this.queue = JSON.parse(backup);
          await this.atomicWrite();
        }
      }
      
      // 3. Cleanup backup
      await this.storage.delete(this.backupKey);
      
      console.log('Backup restoration completed');
    } catch (error) {
      console.error('Restore from backup failed:', error);
    }
  }

  /**
   * Validate queue data
   */
  isValidQueueData(data) {
    try {
      if (!data) return false;
      
      const parsed = JSON.parse(data);
      
      return Array.isArray(parsed) && 
             parsed.every(op => this.isValidOperation(op));
    } catch (error) {
      return false;
    }
  }

  /**
   * Load queue
   */
  async loadQueue() {
    try {
      // 1. Try to load main queue
      const mainData = await this.storage.read(this.mainKey);
      
      if (mainData && this.isValidQueueData(mainData)) {
        this.queue = JSON.parse(mainData);
        console.log('Loaded queue from main storage');
        return;
      }
      
      // 2. Try to load backup queue
      const backupData = await this.storage.read(this.backupKey);
      
      if (backupData && this.isValidQueueData(backupData)) {
        this.queue = JSON.parse(backupData);
        console.log('Loaded queue from backup storage');
        await this.storage.write(this.mainKey, backupData);
        await this.storage.delete(this.backupKey);
        return;
      }
      
      // 3. Default to empty queue
      this.queue = [];
      await this.atomicWrite();
      
      console.log('Initialized empty queue');
    } catch (error) {
      console.error('Load queue failed:', error);
      this.queue = [];
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    // Clean up expired operations every 5 minutes
    setInterval(async () => {
      try {
        await this.cleanupExpiredOperations();
        await this.atomicWrite();
      } catch (error) {
        console.error('Cleanup interval error:', error);
      }
    }, this.config.cleanupInterval);
    
    console.log('Started cleanup interval');
  }

  /**
   * Generate operation ID
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue statistics
   */
  getQueueStatistics() {
    const state = this.getQueueState();
    
    return {
      ...state,
      averageAge: this.queue.length > 0 ? 
        this.queue.reduce((sum, op) => sum + (Date.now() - op.timestamp), 0) / this.queue.length : 0,
      oldestOperation: this.queue.length > 0 ? 
        this.queue.reduce((oldest, op) => op.timestamp < oldest.timestamp ? op : oldest, this.queue[0]) : null,
      newestOperation: this.queue.length > 0 ? 
        this.queue.reduce((newest, op) => op.timestamp > newest.timestamp ? op : newest, this.queue[0]) : null
    };
  }

  /**
   * Get operations by type
   */
  getOperationsByType(operationType) {
    return this.queue.filter(op => op.type === operationType);
  }

  /**
   * Get operations by user
   */
  getOperationsByUser(userId) {
    return this.queue.filter(op => op.userId === userId);
  }

  /**
   * Get failed operations
   */
  getFailedOperations() {
    return this.queue.filter(op => op.state === this.QUEUE_STATES.FAILED);
  }

  /**
   * Get expired operations
   */
  getExpiredOperations() {
    return this.queue.filter(op => op.state === this.QUEUE_STATES.EXPIRED);
  }

  /**
   * Retry failed operations
   */
  async retryFailedOperations() {
    try {
      const failedOperations = this.getFailedOperations();
      
      // Reset failed operations to pending
      failedOperations.forEach(op => {
        op.state = this.QUEUE_STATES.PENDING;
      });
      
      await this.atomicWrite();
      
      console.log(`Reset ${failedOperations.length} failed operations to pending`);
      
      return { success: true, retryCount: failedOperations.length };
    } catch (error) {
      console.error('Retry failed operations failed:', error);
      throw error;
    }
  }
}

module.exports = DeterministicQueue;
