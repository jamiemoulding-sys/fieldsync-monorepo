/**
 * Payroll Corruption Detection Service
 * 
 * Detects and prevents hidden payroll corruption scenarios including
 * duplicate shifts, partial break states, stale sessions, and concurrent device actions.
 */

const { query } = require('../database/connection');
const { AttendanceLogger, LogLevel, EventCategory } = require('./attendanceLogger');

/**
 * Corruption Types
 */
const CorruptionType = {
  DUPLICATE_SHIFTS: 'DUPLICATE_SHIFTS',
  PARTIAL_BREAK_STATE: 'PARTIAL_BREAK_STATE',
  STALE_SESSION: 'STALE_SESSION',
  CONCURRENT_DEVICE_ACTIONS: 'CONCURRENT_DEVICE_ACTIONS',
  PAYROLL_ANOMALY: 'PAYROLL_ANOMALY',
  DATA_MANIPULATION: 'DATA_MANIPULATION',
  SESSION_HIJACKING: 'SESSION_HIJACKING'
};

/**
 * Severity Levels
 */
const Severity = {
  CRITICAL: 'CRITICAL',     // Immediate payroll impact
  HIGH: 'HIGH',             // Significant payroll risk
  MEDIUM: 'MEDIUM',           // Moderate payroll concern
  LOW: 'LOW'                 // Minor payroll issue
};

/**
 * Payroll Corruption Detector
 */
class PayrollCorruptionDetector {
  constructor() {
    this.logger = new AttendanceLogger();
    this.activeSessions = new Map(); // Track active user sessions
    this.deviceFingerprints = new Map(); // Track device fingerprints
  }

  /**
   * Detect duplicate shifts for user
   */
  async detectDuplicateShifts(userId, companyId, timeWindowMinutes = 5) {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as active_shifts,
          ARRAY_AGG(id) as shift_ids,
          ARRAY_AGG(clock_in_time) as clock_in_times,
          MIN(clock_in_time) as earliest_clock_in,
          MAX(clock_in_time) as latest_clock_in
        FROM shifts
        WHERE user_id = $1
        AND company_id = $2
        AND clock_out_time IS NULL
        AND created_at > NOW() - INTERVAL '${timeWindowMinutes} minutes'
        GROUP BY user_id
      `, [userId, companyId]);

      const activeShifts = result.rows[0];
      if (activeShifts.active_shifts > 1) {
        const corruption = {
          type: CorruptionType.DUPLICATE_SHIFTS,
          severity: Severity.CRITICAL,
          userId,
          companyId,
          detectedAt: new Date().toISOString(),
          details: {
            activeShifts: activeShifts.active_shifts,
            shiftIds: activeShifts.shift_ids,
            clockInTimes: activeShifts.clock_in_times,
            timeWindowMinutes,
            potentialPayrollImpact: this.calculateDuplicateShiftImpact(activeShifts)
          }
        };

        await this.logCorruption(corruption);
        return corruption;
      }

      return null;
    } catch (error) {
      console.error('Duplicate shift detection error:', error);
      return null;
    }
  }

  /**
   * Detect partial break states
   */
  async detectPartialBreakStates(userId, companyId) {
    try {
      const result = await query(`
        SELECT 
          id,
          break_started_at,
          total_break_seconds,
          clock_in_time,
          clock_out_time
        FROM shifts
        WHERE user_id = $1
        AND company_id = $2
        AND clock_out_time IS NULL
      `, [userId, companyId]);

      const activeShift = result.rows[0];
      if (!activeShift) return null;

      const issues = [];

      // Check for inconsistent break state
      if (activeShift.break_started_at && activeShift.total_break_seconds > 0) {
        issues.push('Break started but total_break_seconds already > 0');
      }

      // Check for negative break duration
      if (activeShift.break_started_at) {
        const breakDuration = Date.now() - new Date(activeShift.break_started_at).getTime();
        if (breakDuration < 0) {
          issues.push('Negative break duration detected');
        }
      }

      // Check for impossible break sequences
      if (!activeShift.break_started_at && activeShift.total_break_seconds === 0) {
        // Valid state
      } else if (!activeShift.break_started_at && activeShift.total_break_seconds > 0) {
        issues.push('Break ended but break_started_at is NULL');
      }

      if (issues.length > 0) {
        const corruption = {
          type: CorruptionType.PARTIAL_BREAK_STATE,
          severity: Severity.HIGH,
          userId,
          companyId,
          shiftId: activeShift.id,
          detectedAt: new Date().toISOString(),
          details: {
            issues,
            breakStarted: activeShift.break_started_at,
            totalBreakSeconds: activeShift.total_break_seconds,
            clockInTime: activeShift.clock_in_time,
            potentialPayrollImpact: this.calculateBreakStateImpact(activeShift, issues)
          }
        };

        await this.logCorruption(corruption);
        return corruption;
      }

      return null;
    } catch (error) {
      console.error('Partial break state detection error:', error);
      return null;
    }
  }

  /**
   * Detect stale sessions
   */
  async detectStaleSessions(userId, companyId, maxHours = 12) {
    try {
      const result = await query(`
        SELECT 
          id,
          clock_in_time,
          created_at,
          EXTRACT(EPOCH FROM (NOW() - clock_in_time)) / 3600 as hours_active
        FROM shifts
        WHERE user_id = $1
        AND company_id = $2
        AND clock_out_time IS NULL
        ORDER BY clock_in_time DESC
      `, [userId, companyId]);

      const activeShifts = result.rows;
      const staleShifts = activeShifts.filter(shift => 
        shift.hours_active > maxHours
      );

      if (staleShifts.length > 0) {
        const corruption = {
          type: CorruptionType.STALE_SESSION,
          severity: Severity.MEDIUM,
          userId,
          companyId,
          detectedAt: new Date().toISOString(),
          details: {
            staleShifts: staleShifts.map(shift => ({
              shiftId: shift.id,
              clockInTime: shift.clock_in_time,
              hoursActive: shift.hours_active,
              maxAllowedHours: maxHours
            })),
            totalStale: staleShifts.length,
            potentialPayrollImpact: this.calculateStaleSessionImpact(staleShifts)
          }
        };

        await this.logCorruption(corruption);
        return corruption;
      }

      return null;
    } catch (error) {
      console.error('Stale session detection error:', error);
      return null;
    }
  }

  /**
   * Detect concurrent device actions
   */
  async detectConcurrentDeviceActions(userId, companyId, deviceFingerprint) {
    try {
      // Register current device
      this.deviceFingerprints.set(userId, {
        fingerprint: deviceFingerprint,
        lastSeen: Date.now(),
        userAgent: deviceFingerprint
      });

      // Check for other active devices
      const result = await query(`
        SELECT 
          COUNT(DISTINCT device_fingerprint) as active_devices,
          ARRAY_AGG(DISTINCT device_fingerprint) as device_fingerprints,
          MAX(created_at) as latest_action
        FROM attendance_audit_trail
        WHERE user_id = $1
        AND company_id = $2
        AND created_at > NOW() - INTERVAL '1 hour'
      `, [userId, companyId]);

      const deviceData = result.rows[0];
      if (deviceData.active_devices > 1) {
        const corruption = {
          type: CorruptionType.CONCURRENT_DEVICE_ACTIONS,
          severity: Severity.HIGH,
          userId,
          companyId,
          detectedAt: new Date().toISOString(),
          details: {
            activeDevices: deviceData.active_devices,
            deviceFingerprints: deviceData.device_fingerprints,
            currentDevice: deviceFingerprint,
            latestAction: deviceData.latest_action,
            potentialPayrollImpact: this.calculateConcurrentDeviceImpact(deviceData)
          }
        };

        await this.logCorruption(corruption);
        return corruption;
      }

      return null;
    } catch (error) {
      console.error('Concurrent device detection error:', error);
      return null;
    }
  }

  /**
   * Detect payroll anomalies
   */
  async detectPayrollAnomalies(userId, companyId, days = 7) {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_shifts,
          SUM(total_hours) as total_hours,
          SUM(total_break_seconds) as total_break_seconds,
          AVG(total_hours) as avg_hours_per_shift,
          MAX(total_hours) as max_hours_in_shift,
          MIN(total_hours) as min_hours_in_shift,
          STDDEV(total_hours) as hours_stddev
        FROM shifts
        WHERE user_id = $1
        AND company_id = $2
        AND clock_in_time > NOW() - INTERVAL '${days} days'
        AND clock_out_time IS NOT NULL
      `, [userId, companyId]);

      const payrollData = result.rows[0];
      const anomalies = [];

      // Check for excessive hours
      if (payrollData.total_hours > days * 12) { // More than 12 hours/day average
        anomalies.push('Excessive total hours detected');
      }

      // Check for zero-hour shifts
      if (payrollData.min_hours_in_shift === 0) {
        anomalies.push('Zero-hour shifts detected');
      }

      // Check for abnormal shift patterns
      if (payrollData.hours_stddev > 4) { // High variance
        anomalies.push('Abnormal shift hour variance detected');
      }

      // Check for break time anomalies
      const avgBreakPerShift = payrollData.total_break_seconds / payrollData.total_shifts / 3600;
      if (avgBreakPerShift > 2) { // More than 2 hours break per shift
        anomalies.push('Excessive break time detected');
      }

      if (anomalies.length > 0) {
        const corruption = {
          type: CorruptionType.PAYROLL_ANOMALY,
          severity: Severity.MEDIUM,
          userId,
          companyId,
          detectedAt: new Date().toISOString(),
          details: {
            anomalies,
            payrollMetrics: {
              totalShifts: payrollData.total_shifts,
              totalHours: payrollData.total_hours,
              avgHoursPerShift: payrollData.avg_hours_per_shift,
              maxHoursInShift: payrollData.max_hours_in_shift,
              minHoursInShift: payrollData.min_hours_in_shift,
              hoursStddev: payrollData.hours_stddev,
              avgBreakPerShift
            },
            analysisPeriod: {
              days,
              startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
              endDate: new Date().toISOString()
            }
          }
        };

        await this.logCorruption(corruption);
        return corruption;
      }

      return null;
    } catch (error) {
      console.error('Payroll anomaly detection error:', error);
      return null;
    }
  }

  /**
   * Comprehensive corruption scan
   */
  async scanForCorruption(userId, companyId, options = {}) {
    const scans = [];

    // Duplicate shift detection
    const duplicateResult = await this.detectDuplicateShifts(
      userId, 
      companyId, 
      options.timeWindowMinutes || 5
    );
    if (duplicateResult) scans.push(duplicateResult);

    // Partial break state detection
    const breakStateResult = await this.detectPartialBreakStates(userId, companyId);
    if (breakStateResult) scans.push(breakStateResult);

    // Stale session detection
    const staleSessionResult = await this.detectStaleSessions(
      userId, 
      companyId, 
      options.maxStaleHours || 12
    );
    if (staleSessionResult) scans.push(staleSessionResult);

    // Concurrent device detection
    const concurrentDeviceResult = await this.detectConcurrentDeviceActions(
      userId, 
      companyId, 
      options.deviceFingerprint
    );
    if (concurrentDeviceResult) scans.push(concurrentDeviceResult);

    // Payroll anomaly detection
    const anomalyResult = await this.detectPayrollAnomalies(
      userId, 
      companyId, 
      options.analysisDays || 7
    );
    if (anomalyResult) scans.push(anomalyResult);

    return {
      userId,
      companyId,
      scannedAt: new Date().toISOString(),
      totalCorruption: scans.length,
      corruptions: scans,
      severity: this.calculateOverallSeverity(scans)
    };
  }

  /**
   * Calculate duplicate shift impact
   */
  calculateDuplicateShiftImpact(activeShifts) {
    const avgHoursPerShift = 8; // Standard 8-hour shift
    const duplicateCount = activeShifts.active_shifts - 1;
    return {
      potentialOverpayment: duplicateCount * avgHoursPerShift,
      affectedPayPeriods: Math.ceil(duplicateCount * avgHoursPerShift / 40), // 40 hours/week
      riskLevel: duplicateCount > 2 ? 'CRITICAL' : 'HIGH'
    };
  }

  /**
   * Calculate break state impact
   */
  calculateBreakStateImpact(shift, issues) {
    const avgBreakTime = 1; // Standard 1-hour break
    let impact = {
      potentialOverpayment: 0,
      potentialUnderpayment: 0,
      dataIntegrityRisk: 'MEDIUM'
    };

    issues.forEach(issue => {
      if (issue.includes('total_break_seconds already > 0')) {
        impact.potentialOverpayment += avgBreakTime;
      }
      if (issue.includes('Negative break duration')) {
        impact.dataIntegrityRisk = 'HIGH';
      }
    });

    return impact;
  }

  /**
   * Calculate stale session impact
   */
  calculateStaleSessionImpact(staleShifts) {
    return {
      potentialOverpayment: staleShifts.reduce((total, shift) => 
        total + Math.max(0, shift.hoursActive - 12), 0
      , 0),
      complianceRisk: 'HIGH',
      affectedDays: staleShifts.length,
      recommendedAction: 'MANUAL_REVIEW_REQUIRED'
    };
  }

  /**
   * Calculate concurrent device impact
   */
  calculateConcurrentDeviceImpact(deviceData) {
    return {
      securityRisk: 'HIGH',
      dataIntegrityRisk: 'HIGH',
      potentialUnauthorizedAccess: deviceData.active_devices - 1,
      recommendedAction: 'SESSION_TERMINATION_REQUIRED'
    };
  }

  /**
   * Calculate overall severity
   */
  calculateOverallSeverity(corruptions) {
    if (corruptions.length === 0) return 'LOW';
    
    const severityMap = {
      [Severity.CRITICAL]: 4,
      [Severity.HIGH]: 3,
      [Severity.MEDIUM]: 2,
      [Severity.LOW]: 1
    };

    const maxSeverity = Math.max(...corruptions.map(c => 
      severityMap[c.severity] || 0
    ));

    return maxSeverity >= 4 ? 'CRITICAL' : 
           maxSeverity >= 3 ? 'HIGH' : 
           maxSeverity >= 2 ? 'MEDIUM' : 'LOW';
  }

  /**
   * Log corruption detection
   */
  async logCorruption(corruption) {
    try {
      // Log to attendance logs
      await this.logger.logSecurity(corruption.userId, corruption.companyId, 'payroll_corruption_detected', {
        corruptionType: corruption.type,
        severity: corruption.severity,
        details: corruption.details,
        detectedAt: corruption.detectedAt
      });

      // Store in corruption tracking table
      await query(`
        INSERT INTO payroll_corruption_alerts (
          id,
          user_id,
          company_id,
          corruption_type,
          severity,
          detected_at,
          details,
          status,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'OPEN', NOW()
        )
      `, [
        this.generateId(),
        corruption.userId,
        corruption.companyId,
        corruption.type,
        corruption.severity,
        corruption.detectedAt,
        JSON.stringify(corruption.details)
      ]);

      // Send alert to administrators
      await this.sendAlert(corruption);

    } catch (error) {
      console.error('Failed to log corruption:', error);
    }
  }

  /**
   * Send alert to administrators
   */
  async sendAlert(corruption) {
    // This would integrate with your notification system
    console.log('🚨 PAYROLL CORRUPTION ALERT:', {
      type: corruption.type,
      severity: corruption.severity,
      userId: corruption.userId,
      details: corruption.details
    });
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get corruption alerts for company
   */
  async getCorruptionAlerts(companyId, options = {}) {
    const limit = options.limit || 50;
    const hours = options.hours || 24;

    const result = await query(`
      SELECT 
        id,
        corruption_type,
        severity,
        detected_at,
        details,
        status,
        u.name as user_name,
        u.email as user_email
      FROM payroll_corruption_alerts pca
      JOIN users u ON pca.user_id = u.id
      WHERE pca.company_id = $1
      AND pca.detected_at > NOW() - INTERVAL '${hours} hours'
      ORDER BY pca.detected_at DESC
      LIMIT $2
    `, [companyId, hours, limit]);

    return result.rows;
  }

  /**
   * Update corruption alert status
   */
  async updateCorruptionStatus(alertId, status, notes = '') {
    await query(`
      UPDATE payroll_corruption_alerts
      SET 
        status = $1,
        resolved_at = NOW(),
        resolution_notes = $2
      WHERE id = $3
    `, [status, notes, alertId]);
  }
}

module.exports = {
  PayrollCorruptionDetector,
  CorruptionType,
  Severity
};
