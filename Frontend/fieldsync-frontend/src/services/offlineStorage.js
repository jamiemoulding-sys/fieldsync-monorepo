// Offline Storage Service for Workforce Management
class OfflineStorage {
  constructor() {
    this.dbName = 'WorkforceOfflineDB';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store for offline clock-in/out records
        if (!db.objectStoreNames.contains('clockRecords')) {
          const clockStore = db.createObjectStore('clockRecords', { keyPath: 'id', autoIncrement: true });
          clockStore.createIndex('timestamp', 'timestamp', { unique: false });
          clockStore.createIndex('synced', 'synced', { unique: false });
          clockStore.createIndex('employeeId', 'employeeId', { unique: false });
        }

        // Store for offline overtime alerts
        if (!db.objectStoreNames.contains('overtimeAlerts')) {
          const overtimeStore = db.createObjectStore('overtimeAlerts', { keyPath: 'id', autoIncrement: true });
          overtimeStore.createIndex('timestamp', 'timestamp', { unique: false });
          overtimeStore.createIndex('synced', 'synced', { unique: false });
          overtimeStore.createIndex('employeeId', 'employeeId', { unique: false });
        }

        // Store for offline schedules
        if (!db.objectStoreNames.contains('schedules')) {
          const scheduleStore = db.createObjectStore('schedules', { keyPath: 'id', autoIncrement: true });
          scheduleStore.createIndex('employeeId', 'employeeId', { unique: false });
          scheduleStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }

        // Store for offline user data
        if (!db.objectStoreNames.contains('userData')) {
          db.createObjectStore('userData', { keyPath: 'key' });
        }
      };
    });
  }

  // Clock Records
  async saveClockRecord(record) {
    const transaction = this.db.transaction(['clockRecords'], 'readwrite');
    const store = transaction.objectStore('clockRecords');
    
    const recordToSave = {
      ...record,
      timestamp: new Date().toISOString(),
      synced: false,
      deviceInfo: this.getDeviceInfo()
    };

    return new Promise((resolve, reject) => {
      const request = store.add(recordToSave);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedClockRecords() {
    const transaction = this.db.transaction(['clockRecords'], 'readonly');
    const store = transaction.objectStore('clockRecords');
    const index = store.index('synced');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(false);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async markClockRecordSynced(recordId) {
    const transaction = this.db.transaction(['clockRecords'], 'readwrite');
    const store = transaction.objectStore('clockRecords');
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(recordId);
      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (record) {
          record.synced = true;
          const updateRequest = store.put(record);
          updateRequest.onsuccess = () => resolve(updateRequest.result);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Record not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Overtime Alerts
  async saveOvertimeAlert(alert) {
    const transaction = this.db.transaction(['overtimeAlerts'], 'readwrite');
    const store = transaction.objectStore('overtimeAlerts');
    
    const alertToSave = {
      ...alert,
      timestamp: new Date().toISOString(),
      synced: false,
      deviceInfo: this.getDeviceInfo()
    };

    return new Promise((resolve, reject) => {
      const request = store.add(alertToSave);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedOvertimeAlerts() {
    const transaction = this.db.transaction(['overtimeAlerts'], 'readonly');
    const store = transaction.objectStore('overtimeAlerts');
    const index = store.index('synced');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(false);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async markOvertimeAlertSynced(alertId) {
    const transaction = this.db.transaction(['overtimeAlerts'], 'readwrite');
    const store = transaction.objectStore('overtimeAlerts');
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(alertId);
      getRequest.onsuccess = () => {
        const alert = getRequest.result;
        if (alert) {
          alert.synced = true;
          const updateRequest = store.put(alert);
          updateRequest.onsuccess = () => resolve(updateRequest.result);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Alert not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Schedules
  async saveSchedules(schedules) {
    const transaction = this.db.transaction(['schedules'], 'readwrite');
    const store = transaction.objectStore('schedules');
    
    // Clear existing schedules
    await new Promise((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });

    // Save new schedules
    for (const schedule of schedules) {
      await new Promise((resolve, reject) => {
        const scheduleToSave = {
          ...schedule,
          lastUpdated: new Date().toISOString()
        };
        const request = store.add(scheduleToSave);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getSchedules() {
    const transaction = this.db.transaction(['schedules'], 'readonly');
    const store = transaction.objectStore('schedules');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // User Data
  async saveUserData(key, data) {
    const transaction = this.db.transaction(['userData'], 'readwrite');
    const store = transaction.objectStore('userData');
    
    return new Promise((resolve, reject) => {
      const request = store.put({ key, data, timestamp: new Date().toISOString() });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUserData(key) {
    const transaction = this.db.transaction(['userData'], 'readonly');
    const store = transaction.objectStore('userData');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ? request.result.data : null);
      request.onerror = () => reject(request.error);
    });
  }

  // Utility methods
  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      timestamp: new Date().toISOString(),
      online: navigator.onLine
    };
  }

  async clearAllData() {
    const stores = ['clockRecords', 'overtimeAlerts', 'schedules', 'userData'];
    
    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  // Sync status
  async getSyncStatus() {
    const [clockRecords, overtimeAlerts] = await Promise.all([
      this.getUnsyncedClockRecords(),
      this.getUnsyncedOvertimeAlerts()
    ]);

    return {
      pendingClockRecords: clockRecords.length,
      pendingOvertimeAlerts: overtimeAlerts.length,
      lastSyncTime: await this.getUserData('lastSyncTime'),
      isOnline: navigator.onLine
    };
  }
}

// Overtime Calculator
class OvertimeCalculator {
  static calculateOvertime(clockInTime, clockOutTime, scheduledHours = 8) {
    const clockIn = new Date(clockInTime);
    const clockOut = new Date(clockOutTime);
    
    // Calculate total hours worked
    const totalHours = (clockOut - clockIn) / (1000 * 60 * 60);
    
    // Calculate overtime (anything beyond scheduled hours)
    const overtimeHours = Math.max(0, totalHours - scheduledHours);
    
    return {
      totalHours: Math.round(totalHours * 100) / 100,
      overtimeHours: Math.round(overtimeHours * 100) / 100,
      regularHours: Math.min(totalHours, scheduledHours),
      overtimePercentage: totalHours > 0 ? Math.round((overtimeHours / totalHours) * 100) : 0
    };
  }

  static checkOvertimeThreshold(clockInTime, clockOutTime, thresholdHours = 8) {
    const calculation = this.calculateOvertime(clockInTime, clockOutTime);
    
    return {
      isOvertime: calculation.overtimeHours > 0,
      thresholdExceeded: calculation.totalHours > thresholdHours,
      hoursOverThreshold: Math.max(0, calculation.totalHours - thresholdHours),
      ...calculation
    };
  }

  static generateOvertimeAlert(employeeData, overtimeData) {
    const alertLevel = overtimeData.overtimeHours >= 2 ? 'high' : 
                      overtimeData.overtimeHours >= 1 ? 'medium' : 'low';
    
    return {
      employeeId: employeeData.id,
      employeeName: employeeData.name,
      employeeEmail: employeeData.email,
      clockInTime: overtimeData.clockInTime,
      clockOutTime: overtimeData.clockOutTime,
      totalHours: overtimeData.totalHours,
      overtimeHours: overtimeData.overtimeHours,
      regularHours: overtimeData.regularHours,
      alertLevel,
      message: this.generateAlertMessage(overtimeData),
      timestamp: new Date().toISOString()
    };
  }

  static generateAlertMessage(overtimeData) {
    if (overtimeData.overtimeHours >= 2) {
      return `Significant overtime: ${overtimeData.overtimeHours} hours beyond scheduled time`;
    } else if (overtimeData.overtimeHours >= 1) {
      return `Overtime detected: ${overtimeData.overtimeHours} hours beyond scheduled time`;
    } else {
      return `Approaching overtime limit: ${overtimeData.totalHours} total hours worked`;
    }
  }
}

export { OfflineStorage, OvertimeCalculator };
