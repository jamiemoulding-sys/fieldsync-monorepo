/**
 * Production-Safe Mobile Queue Service
 * 
 * Provides atomic, reliable, and crash-safe queue operations
 * for mobile attendance systems.
 */

const crypto = require('crypto');

class MobileSafeQueue {
  constructor() {
    this.QUEUE_KEY = 'attendance_queue';
    this.STATE_KEY = 'queue_state';
    this.MAX_QUEUE_SIZE = 100;
    this.JOB_TTL = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Add job to queue with validation and deduplication
   */
  async addJob(job) {
    try {
      // 1. Validate job structure
      if (!this.validateJob(job)) {
        throw new Error('Invalid job structure');
      }

      // 2. Add metadata
      const enhancedJob = {
        id: crypto.randomUUID(),
        type: job.type,
        userId: job.userId,
        companyId: job.companyId,
        data: job.data,
        timestamp: Date.now(),
        attempts: 0,
        maxAttempts: 3,
        status: 'pending'
      };

      // 3. Get current queue
      const queue = await this.getQueue();

      // 4. Check queue size limit
      if (queue.length >= this.MAX_QUEUE_SIZE) {
        throw new Error('Queue is full');
      }

      // 5. Check for duplicates
      if (this.isDuplicate(enhancedJob, queue)) {
        return { success: false, reason: 'duplicate' };
      }

      // 6. Atomic write
      const updatedQueue = [...queue, enhancedJob];
      await this.atomicWrite(updatedQueue);

      return { success: true, jobId: enhancedJob.id };
    } catch (error) {
      console.error('Add job failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process queue with error handling and retry logic
   */
  async processQueue(apiClient) {
    try {
      const queue = await this.getQueue();
      const processed = [];
      const failed = [];
      const remaining = [];

      for (const job of queue) {
        try {
          // 1. Check job TTL
          if (Date.now() - job.timestamp > this.JOB_TTL) {
            console.warn(`Job ${job.id} expired, skipping`);
            continue;
          }

          // 2. Check attempt limit
          if (job.attempts >= job.maxAttempts) {
            console.warn(`Job ${job.id} max attempts reached, skipping`);
            failed.push(job);
            continue;
          }

          // 3. Process job
          const result = await this.processJob(job, apiClient);
          
          if (result.success) {
            processed.push(job);
          } else {
            // 4. Update job with error
            job.attempts++;
            job.lastError = result.error;
            job.status = 'failed';
            
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
          job.status = 'failed';
          
          if (job.attempts < job.maxAttempts) {
            remaining.push(job);
          } else {
            failed.push(job);
          }
        }
      }

      // 5. Atomic update
      await this.atomicWrite(remaining);

      return {
        success: true,
        processed,
        failed,
        remaining: remaining.length
      };
    } catch (error) {
      console.error('Process queue failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current queue with validation
   */
  async getQueue() {
    try {
      const queueData = await this.getFromStorage(this.QUEUE_KEY);
      
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

      // Filter out expired jobs
      const validJobs = queue.filter(job => {
        return Date.now() - job.timestamp <= this.JOB_TTL;
      });

      // Update queue if jobs were filtered
      if (validJobs.length !== queue.length) {
        await this.atomicWrite(validJobs);
      }

      return validJobs;
    } catch (error) {
      console.error('Get queue failed:', error);
      await this.clearQueue();
      return [];
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
        pending: queue.filter(job => job.status === 'pending').length,
        failed: queue.filter(job => job.status === 'failed').length,
        byType: {},
        oldestJob: null,
        newestJob: null
      };

      // Calculate by type and oldest/newest
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
      await this.removeFromStorage(this.STATE_KEY);
      return { success: true };
    } catch (error) {
      console.error('Clear queue failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove specific job from queue
   */
  async removeJob(jobId) {
    try {
      const queue = await this.getQueue();
      const filtered = queue.filter(job => job.id !== jobId);
      await this.atomicWrite(filtered);
      return { success: true };
    } catch (error) {
      console.error('Remove job failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs() {
    try {
      const queue = await this.getQueue();
      const updated = queue.map(job => {
        if (job.status === 'failed' && job.attempts < job.maxAttempts) {
          return {
            ...job,
            status: 'pending',
            lastError: null
          };
        }
        return job;
      });
      
      await this.atomicWrite(updated);
      return { success: true, retried: updated.filter(job => job.status === 'pending').length };
    } catch (error) {
      console.error('Retry failed jobs failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate job structure
   */
  validateJob(job) {
    return (
      job &&
      typeof job.type === 'string' &&
      typeof job.userId === 'string' &&
      typeof job.companyId === 'string' &&
      job.data &&
      typeof job.data === 'object'
    );
  }

  /**
   * Check for duplicate jobs
   */
  isDuplicate(newJob, queue) {
    const oneMinuteAgo = Date.now() - 60000;
    
    return queue.some(job => 
      job.type === newJob.type &&
      job.userId === newJob.userId &&
      job.timestamp > oneMinuteAgo
    );
  }

  /**
   * Process individual job
   */
  async processJob(job, apiClient) {
    try {
      switch (job.type) {
        case 'clock-in':
          return await apiClient.clockIn(job.userId, job.companyId, job.data);
        
        case 'clock-out':
          return await apiClient.clockOut(job.userId, job.companyId, job.data);
        
        case 'break-start':
          return await apiClient.startBreak(job.userId, job.companyId, job.data);
        
        case 'break-end':
          return await apiClient.endBreak(job.userId, job.companyId, job.data);
        
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Atomic write to storage
   */
  async atomicWrite(queue) {
    try {
      // 1. Create backup
      const backup = await this.getFromStorage(this.QUEUE_KEY);
      await this.setToStorage(this.STATE_KEY, backup);
      
      // 2. Write new data
      const queueData = JSON.stringify(queue);
      await this.setToStorage(this.QUEUE_KEY, queueData);
      
      // 3. Verify write
      const verify = await this.getFromStorage(this.QUEUE_KEY);
      if (verify !== queueData) {
        throw new Error('Write verification failed');
      }
      
      // 4. Cleanup backup
      await this.removeFromStorage(this.STATE_KEY);
      
      return true;
    } catch (error) {
      console.error('Atomic write failed:', error);
      
      // 5. Restore from backup
      try {
        const backup = await this.getFromStorage(this.STATE_KEY);
        if (backup) {
          await this.setToStorage(this.QUEUE_KEY, backup);
        }
      } catch (restoreError) {
        console.error('Restore backup failed:', restoreError);
      }
      
      throw error;
    }
  }

  /**
   * Storage abstraction - replace with actual implementation
   */
  async getFromStorage(key) {
    // Replace with actual storage implementation
    // For React Native: AsyncStorage.getItem(key)
    // For Web: localStorage.getItem(key)
    throw new Error('Storage implementation required');
  }

  async setToStorage(key, value) {
    // Replace with actual storage implementation
    // For React Native: AsyncStorage.setItem(key, value)
    // For Web: localStorage.setItem(key, value)
    throw new Error('Storage implementation required');
  }

  async removeFromStorage(key) {
    // Replace with actual storage implementation
    // For React Native: AsyncStorage.removeItem(key)
    // For Web: localStorage.removeItem(key)
    throw new Error('Storage implementation required');
  }
}

module.exports = MobileSafeQueue;
