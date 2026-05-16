/**
 * API Client Service
 * 
 * Simple API client with retry logic and error handling.
 * All validation happens on server side.
 */

class APIClient {
  constructor(config = {}) {
    this.baseURL = config.baseURL || 'https://api.fieldsync.com';
    this.timeout = config.timeout || 15000;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.token = null;
  }

  /**
   * Set authentication token
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * Make API request with retry logic
   */
  async request(endpoint, data = {}, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      ...options.headers
    };

    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(this.timeout),
          ...options
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        return { success: true, data: result };
      } catch (error) {
        lastError = error;
        
        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.warn(`API request failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`API request failed after ${this.maxRetries + 1} attempts:`, error.message);
        }
      }
    }

    return { success: false, error: lastError.message };
  }

  /**
   * Clock-in
   */
  async clockIn(userId, companyId, data) {
    return this.request('/attendance/clock-in', {
      userId,
      companyId,
      ...data
    });
  }

  /**
   * Clock-out
   */
  async clockOut(userId, companyId, data) {
    return this.request('/attendance/clock-out', {
      userId,
      companyId,
      ...data
    });
  }

  /**
   * Start break
   */
  async startBreak(userId, companyId, data) {
    return this.request('/attendance/break/start', {
      userId,
      companyId,
      ...data
    });
  }

  /**
   * End break
   */
  async endBreak(userId, companyId, data) {
    return this.request('/attendance/break/end', {
      userId,
      companyId,
      ...data
    });
  }

  /**
   * Get active shift
   */
  async getActiveShift(userId, companyId) {
    try {
      const response = await fetch(`${this.baseURL}/attendance/active-shift`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current server state
   */
  async getCurrentState(userId, companyId) {
    try {
      const response = await fetch(`${this.baseURL}/attendance/current-state`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    try {
      const response = await fetch(`${this.baseURL}/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get locations
   */
  async getLocations(companyId) {
    try {
      const response = await fetch(`${this.baseURL}/locations`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Check network status
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get API status
   */
  getStatus() {
    return {
      baseURL: this.baseURL,
      timeout: this.timeout,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay,
      hasToken: !!this.token,
      isOnline: navigator.onLine
    };
  }
}

// Create singleton instance
const apiClient = new APIClient();

export default apiClient;
