/**
 * Crash-Safe Persistence Layer
 * 
 * Minimum viable crash-safe persistence with atomic operations,
 * backup/restore mechanisms, and corruption detection.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

class CrashSafePersistence {
  constructor() {
    this.BACKUP_SUFFIX = '_backup';
    this.TEMP_SUFFIX = '_temp';
    this.CORRUPTION_SUFFIX = '_corruption_detected';
    this.MAX_BACKUPS = 3;
    this.WRITE_TIMEOUT = 5000;
  }

  /**
   * Atomic write with backup and verification
   */
  async atomicWrite(key, data) {
    const startTime = Date.now();
    
    try {
      // 1. Validate data
      if (!this.isValidData(data)) {
        throw new Error('Invalid data structure');
      }

      // 2. Create backup
      await this.createBackup(key);
      
      // 3. Write to temp file first
      const tempKey = `${key}${this.TEMP_SUFFIX}`;
      const serialized = JSON.stringify(data);
      
      await AsyncStorage.setItem(tempKey, serialized);
      
      // 4. Verify temp write
      const tempData = await AsyncStorage.getItem(tempKey);
      if (tempData !== serialized) {
        throw new Error('Temp write verification failed');
      }
      
      // 5. Atomic rename (write to actual key)
      await AsyncStorage.setItem(key, serialized);
      
      // 6. Verify final write
      const finalData = await AsyncStorage.getItem(key);
      if (finalData !== serialized) {
        throw new Error('Final write verification failed');
      }
      
      // 7. Cleanup temp file
      await AsyncStorage.removeItem(tempKey);
      
      // 8. Cleanup old backups
      await this.cleanupBackups(key);
      
      // 9. Clear corruption flag
      await this.clearCorruptionFlag(key);
      
      const duration = Date.now() - startTime;
      console.log(`Atomic write successful for ${key} in ${duration}ms`);
      
      return { success: true, duration };
    } catch (error) {
      console.error(`Atomic write failed for ${key}:`, error);
      
      // 10. Restore from backup
      await this.restoreFromBackup(key);
      
      // 11. Set corruption flag if needed
      if (this.isCorruptionError(error)) {
        await this.setCorruptionFlag(key, error.message);
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Safe read with corruption detection
   */
  async safeRead(key) {
    try {
      // 1. Check corruption flag
      const corruptionFlag = await this.getCorruptionFlag(key);
      if (corruptionFlag) {
        console.warn(`Corruption detected for ${key}: ${corruptionFlag.message}`);
        await this.restoreFromBackup(key);
      }

      // 2. Read data
      const data = await AsyncStorage.getItem(key);
      
      if (!data) {
        return null;
      }

      // 3. Parse and validate
      const parsed = JSON.parse(data);
      
      if (!this.isValidData(parsed)) {
        throw new Error('Invalid data structure detected');
      }

      return parsed;
    } catch (error) {
      console.error(`Safe read failed for ${key}:`, error);
      
      // 4. Try to restore from backup
      const backupData = await this.getBackupData(key);
      if (backupData) {
        console.log(`Restored ${key} from backup`);
        return backupData;
      }
      
      // 5. Return null if all else fails
      return null;
    }
  }

  /**
   * Create backup of current data
   */
  async createBackup(key) {
    try {
      const currentData = await AsyncStorage.getItem(key);
      if (currentData) {
        const backupKey = `${key}${this.BACKUP_SUFFIX}_${Date.now()}`;
        await AsyncStorage.setItem(backupKey, currentData);
        
        // Maintain only recent backups
        await this.cleanupBackups(key);
      }
    } catch (error) {
      console.error(`Create backup failed for ${key}:`, error);
    }
  }

  /**
   * Restore from most recent backup
   */
  async restoreFromBackup(key) {
    try {
      const backupData = await this.getBackupData(key);
      if (backupData) {
        await AsyncStorage.setItem(key, JSON.stringify(backupData));
        console.log(`Restored ${key} from backup`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Restore from backup failed for ${key}:`, error);
      return false;
    }
  }

  /**
   * Get most recent backup data
   */
  async getBackupData(key) {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const backupKeys = allKeys
        .filter(k => k.startsWith(`${key}${this.BACKUP_SUFFIX}`))
        .sort((a, b) => {
          const timeA = parseInt(a.split('_').pop());
          const timeB = parseInt(b.split('_').pop());
          return timeB - timeA;
        });

      if (backupKeys.length === 0) {
        return null;
      }

      const mostRecentBackup = backupKeys[0];
      const backupData = await AsyncStorage.getItem(mostRecentBackup);
      
      if (!backupData) {
        return null;
      }

      return JSON.parse(backupData);
    } catch (error) {
      console.error(`Get backup data failed for ${key}:`, error);
      return null;
    }
  }

  /**
   * Cleanup old backups
   */
  async cleanupBackups(key) {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const backupKeys = allKeys
        .filter(k => k.startsWith(`${key}${this.BACKUP_SUFFIX}`))
        .sort((a, b) => {
          const timeA = parseInt(a.split('_').pop());
          const timeB = parseInt(b.split('_').pop());
          return timeB - timeA;
        });

      // Keep only the most recent backups
      const keysToRemove = backupKeys.slice(this.MAX_BACKUPS);
      
      for (const backupKey of keysToRemove) {
        await AsyncStorage.removeItem(backupKey);
      }
    } catch (error) {
      console.error(`Cleanup backups failed for ${key}:`, error);
    }
  }

  /**
   * Validate data structure
   */
  isValidData(data) {
    // Basic validation - override in specific implementations
    return data !== null && data !== undefined;
  }

  /**
   * Check if error is corruption-related
   */
  isCorruptionError(error) {
    const corruptionKeywords = [
      'JSON.parse',
      'Unexpected token',
      'Invalid data structure',
      'Write verification failed'
    ];
    
    return corruptionKeywords.some(keyword => 
      error.message && error.message.includes(keyword)
    );
  }

  /**
   * Set corruption flag
   */
  async setCorruptionFlag(key, message) {
    try {
      const flag = {
        message,
        timestamp: Date.now(),
        key
      };
      
      await AsyncStorage.setItem(
        `${key}${this.CORRUPTION_SUFFIX}`,
        JSON.stringify(flag)
      );
    } catch (error) {
      console.error(`Set corruption flag failed for ${key}:`, error);
    }
  }

  /**
   * Get corruption flag
   */
  async getCorruptionFlag(key) {
    try {
      const flagData = await AsyncStorage.getItem(`${key}${this.CORRUPTION_SUFFIX}`);
      return flagData ? JSON.parse(flagData) : null;
    } catch (error) {
      console.error(`Get corruption flag failed for ${key}:`, error);
      return null;
    }
  }

  /**
   * Clear corruption flag
   */
  async clearCorruptionFlag(key) {
    try {
      await AsyncStorage.removeItem(`${key}${this.CORRUPTION_SUFFIX}`);
    } catch (error) {
      console.error(`Clear corruption flag failed for ${key}:`, error);
    }
  }

  /**
   * Get persistence statistics
   */
  async getStats(key) {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const backupKeys = allKeys.filter(k => k.startsWith(`${key}${this.BACKUP_SUFFIX}`));
      const corruptionFlag = await this.getCorruptionFlag(key);
      
      return {
        backupCount: backupKeys.length,
        hasCorruptionFlag: !!corruptionFlag,
        corruptionTimestamp: corruptionFlag ? corruptionFlag.timestamp : null,
        lastBackupTime: backupKeys.length > 0 ? 
          parseInt(backupKeys[0].split('_').pop()) : null
      };
    } catch (error) {
      console.error(`Get persistence stats failed for ${key}:`, error);
      return null;
    }
  }

  /**
   * Health check for persistence layer
   */
  async healthCheck() {
    try {
      // Test write/read cycle
      const testKey = 'health_check_test';
      const testData = { test: true, timestamp: Date.now() };
      
      const writeResult = await this.atomicWrite(testKey, testData);
      if (!writeResult.success) {
        throw new Error('Health check write failed');
      }
      
      const readData = await this.safeRead(testKey);
      if (!readData || readData.test !== true) {
        throw new Error('Health check read failed');
      }
      
      // Cleanup
      await AsyncStorage.removeItem(testKey);
      await AsyncStorage.removeItem(`${testKey}${this.BACKUP_SUFFIX}_*`);
      
      return {
        status: 'healthy',
        writeDuration: writeResult.duration,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Repair corrupted data
   */
  async repairCorruptedData(key, defaultValue = null) {
    try {
      console.log(`Attempting to repair corrupted data for ${key}`);
      
      // 1. Try to restore from backup
      const restored = await this.restoreFromBackup(key);
      if (restored) {
        await this.clearCorruptionFlag(key);
        return { repaired: true, method: 'backup_restore' };
      }
      
      // 2. Use default value if provided
      if (defaultValue !== null) {
        await this.atomicWrite(key, defaultValue);
        await this.clearCorruptionFlag(key);
        return { repaired: true, method: 'default_value' };
      }
      
      // 3. Clear corrupted data
      await AsyncStorage.removeItem(key);
      await this.clearCorruptionFlag(key);
      
      return { repaired: true, method: 'clear_data' };
    } catch (error) {
      console.error(`Repair corrupted data failed for ${key}:`, error);
      return { repaired: false, error: error.message };
    }
  }
}

// Create singleton instance
const crashSafePersistence = new CrashSafePersistence();

export default crashSafePersistence;
