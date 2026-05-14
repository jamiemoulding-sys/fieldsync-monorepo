/**
 * Operational Observability Service
 * 
 * Simple observability service for attendance platform with
 * replay visibility, synchronization debugging, and deterministic recovery.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import crypto from 'crypto';

class OperationalObservability {
  constructor() {
    // Storage keys
    this.EVENTS_KEY = 'attendance_events';
    this.METRICS_KEY = 'attendance_metrics';
    this.ALERTS_KEY = 'attendance_alerts';
    this.TRACES_KEY = 'attendance_traces';
    
    // Configuration
    this.MAX_EVENTS = 1000;
    this.MAX_METRICS = 100;
    this.MAX_ALERTS = 100;
    this.MAX_TRACES = 100;
    this.RETENTION_DAYS = 30;
    
    // Event types
    this.EVENT_TYPES = {
      ATTENDANCE: 'attendance',
      GPS: 'gps',
      QUEUE: 'queue',
      STATE: 'state',
      ERROR: 'error',
      SYNC: 'sync'
    };
    
    // Alert severities
    this.SEVERITY = {
      INFO: 'info',
      WARNING: 'warning',
      ERROR: 'error',
      CRITICAL: 'critical'
    };
    
    // Initialize
    this.events = [];
    this.metrics = {};
    this.alerts = [];
    this.traces = [];
    
    this.initialize();
  }

  /**
   * Initialize observability
   */
  async initialize() {
    try {
      // Load existing data
      await this.loadEvents();
      await this.loadMetrics();
      await this.loadAlerts();
      await this.loadTraces();
      
      // Start cleanup interval
      this.startCleanupInterval();
      
      console.log('OperationalObservability initialized');
    } catch (error) {
      console.error('Observability initialization failed:', error);
    }
  }

  /**
   * Log attendance event
   */
  logAttendanceEvent(eventType, data) {
    try {
      const event = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: this.EVENT_TYPES.ATTENDANCE,
        eventType,
        userId: data.userId,
        deviceId: data.deviceId,
        locationId: data.locationId,
        shiftId: data.shiftId,
        state: data.state,
        error: data.error,
        metadata: data.metadata || {}
      };
      
      this.events.push(event);
      this.trimEvents();
      this.persistEvents();
      
      console.log(`[ATTENDANCE] ${eventType}:`, event);
      
      // Check for alerts
      this.checkForAlerts(event);
      
      return event;
    } catch (error) {
      console.error('Log attendance event failed:', error);
      return null;
    }
  }

  /**
   * Log GPS event
   */
  logGPSEvent(eventType, data) {
    try {
      const event = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: this.EVENT_TYPES.GPS,
        eventType,
        accuracy: data.accuracy,
        timestamp: data.timestamp,
        age: data.age,
        error: data.error,
        metadata: data.metadata || {}
      };
      
      this.events.push(event);
      this.trimEvents();
      this.persistEvents();
      
      console.log(`[GPS] ${eventType}:`, event);
      
      // Check for alerts
      this.checkForAlerts(event);
      
      return event;
    } catch (error) {
      console.error('Log GPS event failed:', error);
      return null;
    }
  }

  /**
   * Log queue event
   */
  logQueueEvent(eventType, data) {
    try {
      const event = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: this.EVENT_TYPES.QUEUE,
        eventType,
        operationId: data.operationId,
        operationType: data.operationType,
        queueSize: data.queueSize,
        error: data.error,
        metadata: data.metadata || {}
      };
      
      this.events.push(event);
      this.trimEvents();
      this.persistEvents();
      
      console.log(`[QUEUE] ${eventType}:`, event);
      
      // Check for alerts
      this.checkForAlerts(event);
      
      return event;
    } catch (error) {
      console.error('Log queue event failed:', error);
      return null;
    }
  }

  /**
   * Log state transition
   */
  logStateTransition(fromState, toState, operation) {
    try {
      const event = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: this.EVENT_TYPES.STATE,
        eventType: 'state_transition',
        fromState,
        toState,
        operation,
        userId: operation.userId,
        deviceId: operation.deviceId,
        metadata: operation.metadata || {}
      };
      
      this.events.push(event);
      this.trimEvents();
      this.persistEvents();
      
      console.log(`[STATE] transition:`, event);
      
      return event;
    } catch (error) {
      console.error('Log state transition failed:', error);
      return null;
    }
  }

  /**
   * Log error event
   */
  logErrorEvent(errorType, error, context) {
    try {
      const event = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: this.EVENT_TYPES.ERROR,
        eventType: errorType,
        message: error.message,
        stack: error.stack,
        context: context || {},
        severity: this.getErrorSeverity(error),
        metadata: {
          userId: context.userId,
          deviceId: context.deviceId,
          operation: context.operation
        }
      };
      
      this.events.push(event);
      this.trimEvents();
      this.persistEvents();
      
      console.error(`[ERROR] ${errorType}:`, event);
      
      // Check for alerts
      this.checkForAlerts(event);
      
      return event;
    } catch (logError) {
      console.error('Log error event failed:', logError);
      return null;
    }
  }

  /**
   * Log sync event
   */
  logSyncEvent(eventType, data) {
    try {
      const event = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: this.EVENT_TYPES.SYNC,
        eventType,
        userId: data.userId,
        deviceId: data.deviceId,
        operationCount: data.operationCount,
        successCount: data.successCount,
        failureCount: data.failureCount,
        duration: data.duration,
        error: data.error,
        metadata: data.metadata || {}
      };
      
      this.events.push(event);
      this.trimEvents();
      this.persistEvents();
      
      console.log(`[SYNC] ${eventType}:`, event);
      
      // Update metrics
      this.updateSyncMetrics(eventType, data);
      
      // Check for alerts
      this.checkForAlerts(event);
      
      return event;
    } catch (error) {
      console.error('Log sync event failed:', error);
      return null;
    }
  }

  /**
   * Create trace for debugging
   */
  createTrace(type, data) {
    try {
      const trace = {
        id: this.generateTraceId(),
        timestamp: Date.now(),
        type,
        data,
        userId: data.userId,
        deviceId: data.deviceId,
        context: data.context || {},
        metadata: data.metadata || {}
      };
      
      this.traces.push(trace);
      this.trimTraces();
      this.persistTraces();
      
      console.log(`[TRACE] ${type}:`, trace);
      
      return trace;
    } catch (error) {
      console.error('Create trace failed:', error);
      return null;
    }
  }

  /**
   * Get operational metrics
   */
  getOperationalMetrics() {
    try {
      const now = Date.now();
      const last24Hours = now - (24 * 60 * 60 * 1000);
      
      // Calculate metrics from events
      const recentEvents = this.events.filter(event => event.timestamp > last24Hours);
      
      const metrics = {
        timestamp: now,
        attendance: {
          total_clock_ins: recentEvents.filter(e => e.eventType === 'clock_in_success').length,
          total_clock_outs: recentEvents.filter(e => e.eventType === 'clock_out_success').length,
          total_break_starts: recentEvents.filter(e => e.eventType === 'break_start').length,
          total_break_ends: recentEvents.filter(e => e.eventType === 'break_end').length,
          error_rate: this.calculateErrorRate(recentEvents, ['clock_in_failed', 'clock_out_failed']),
          success_rate: this.calculateSuccessRate(recentEvents, ['clock_in_success', 'clock_out_success'])
        },
        queue: {
          total_operations: recentEvents.filter(e => e.type === 'queue').length,
          failed_operations: recentEvents.filter(e => e.eventType === 'operation_failed').length,
          success_operations: recentEvents.filter(e => e.eventType === 'operation_processed').length,
          average_wait_time: this.calculateAverageQueueWaitTime(recentEvents),
          queue_size_current: this.getCurrentQueueSize()
        },
        gps: {
          total_requests: recentEvents.filter(e => e.type === 'gps').length,
          accuracy_average: this.calculateAverageGPSAccuracy(recentEvents),
          accuracy_issues: recentEvents.filter(e => e.eventType === 'gps_accuracy_issue').length,
          timeout_rate: this.calculateErrorRate(recentEvents, ['gps_timeout'])
        },
        sync: {
          total_syncs: recentEvents.filter(e => e.type === 'sync').length,
          success_rate: this.calculateSuccessRate(recentEvents, ['sync_success']),
          average_duration: this.calculateAverageSyncDuration(recentEvents),
          failure_rate: this.calculateErrorRate(recentEvents, ['sync_failed'])
        },
        errors: {
          total_errors: recentEvents.filter(e => e.type === 'error').length,
          error_types: this.getErrorTypeBreakdown(recentEvents),
          critical_errors: recentEvents.filter(e => e.severity === 'critical').length
        },
        alerts: {
          total_alerts: this.alerts.length,
          critical_alerts: this.alerts.filter(a => a.severity === 'critical').length,
          warning_alerts: this.alerts.filter(a => a.severity === 'warning').length,
          active_alerts: this.alerts.filter(a => a.status === 'active').length
        }
      };
      
      // Update stored metrics
      this.metrics = metrics;
      this.persistMetrics();
      
      return metrics;
    } catch (error) {
      console.error('Get operational metrics failed:', error);
      return null;
    }
  }

  /**
   * Get queue inspection data
   */
  getQueueInspection() {
    try {
      const queueEvents = this.events.filter(e => e.type === 'queue');
      const recentEvents = queueEvents.filter(e => e.timestamp > Date.now() - (24 * 60 * 60 * 1000));
      
      const inspection = {
        timestamp: Date.now(),
        summary: {
          total_operations: queueEvents.length,
          recent_operations: recentEvents.length,
          failed_operations: recentEvents.filter(e => e.eventType === 'operation_failed').length,
          success_operations: recentEvents.filter(e => e.eventType === 'operation_processed').length
        },
        operations: recentEvents.map(event => ({
          id: event.operationId,
          type: event.operationType,
          status: this.getOperationStatusFromEvent(event),
          timestamp: event.timestamp,
          age: Date.now() - event.timestamp,
          attempts: this.getOperationAttempts(event),
          last_error: event.error,
          metadata: event.metadata
        })),
        issues: this.detectQueueIssues(recentEvents),
        recommendations: this.generateQueueRecommendations(recentEvents)
      };
      
      console.log('[QUEUE_INSPECTION]:', inspection);
      
      return inspection;
    } catch (error) {
      console.error('Get queue inspection failed:', error);
      return null;
    }
  }

  /**
   * Get convergence debugging data
   */
  getConvergenceDebugging(userId) {
    try {
      const userEvents = this.events.filter(e => e.userId === userId);
      const recentEvents = userEvents.filter(e => e.timestamp > Date.now() - (24 * 60 * 60 * 1000));
      
      const debugging = {
        timestamp: Date.now(),
        userId,
        summary: {
          total_events: userEvents.length,
          recent_events: recentEvents.length,
          state_transitions: recentEvents.filter(e => e.type === 'state'),
          sync_events: recentEvents.filter(e => e.type === 'sync'),
          error_events: recentEvents.filter(e => e.type === 'error')
        },
        state_history: this.getStateHistory(recentEvents),
        sync_history: this.getSyncHistory(recentEvents),
        issues: this.detectConvergenceIssues(recentEvents),
        recommendations: this.generateConvergenceRecommendations(recentEvents)
      };
      
      console.log(`[CONVERGENCE_DEBUG] ${userId}:`, debugging);
      
      return debugging;
    } catch (error) {
      console.error('Get convergence debugging failed:', error);
      return null;
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    try {
      const activeAlerts = this.alerts.filter(alert => alert.status === 'active');
      
      const alertSummary = {
        timestamp: Date.now(),
        total_alerts: this.alerts.length,
        active_alerts: activeAlerts.length,
        critical_alerts: activeAlerts.filter(a => a.severity === 'critical').length,
        warning_alerts: activeAlerts.filter(a => a.severity === 'warning').length,
        alerts: activeAlerts.map(alert => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp,
          acknowledged: alert.acknowledged,
          resolved: alert.resolved,
          metadata: alert.metadata
        }))
      };
      
      return alertSummary;
    } catch (error) {
      console.error('Get active alerts failed:', error);
      return null;
    }
  }

  /**
   * Create alert
   */
  createAlert(type, severity, message, data) {
    try {
      const alert = {
        id: this.generateAlertId(),
        timestamp: Date.now(),
        type,
        severity,
        message,
        data: data || {},
        status: 'active',
        acknowledged: false,
        resolved: false,
        metadata: {}
      };
      
      this.alerts.push(alert);
      this.trimAlerts();
      this.persistAlerts();
      
      console.log(`[ALERT] ${severity}:`, alert);
      
      // Send notification for critical alerts
      if (severity === this.SEVERITY.CRITICAL) {
        this.sendCriticalNotification(alert);
      }
      
      return alert;
    } catch (error) {
      console.error('Create alert failed:', error);
      return null;
    }
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId) {
    try {
      const alert = this.alerts.find(a => a.id === alertId);
      
      if (alert) {
        alert.status = 'resolved';
        alert.resolvedAt = Date.now();
        this.persistAlerts();
        
        console.log(`[ALERT_RESOLVED] ${alertId}:`, alert);
      }
      
      return alert;
    } catch (error) {
      console.error('Resolve alert failed:', error);
      return null;
    }
  }

  /**
   * Get replay history
   */
  getReplayHistory(operationId) {
    try {
      const operationEvents = this.events.filter(e => 
        e.operationId === operationId && 
        (e.eventType === 'operation_processed' || e.eventType === 'operation_failed')
      );
      
      const history = {
        operationId,
        total_attempts: operationEvents.length,
        successful_attempts: operationEvents.filter(e => e.eventType === 'operation_processed').length,
        failed_attempts: operationEvents.filter(e => e.eventType === 'operation_failed').length,
        last_attempt: operationEvents.length > 0 ? operationEvents[operationEvents.length - 1] : null,
        average_duration: this.calculateAverageOperationDuration(operationEvents),
        success_rate: this.calculateSuccessRate(operationEvents, ['operation_processed']),
        events: operationEvents.map(event => ({
          timestamp: event.timestamp,
          result: event.eventType,
          duration: event.duration,
          error: event.error,
          metadata: event.metadata
        }))
      };
      
      console.log(`[REPLAY_HISTORY] ${operationId}:`, history);
      
      return history;
    } catch (error) {
      console.error('Get replay history failed:', error);
      return null;
    }
  }

  /**
   * Get GPS validation failures
   */
  getGPSValidationFailures(timeRange = 24 * 60 * 60 * 1000) {
    try {
      const now = Date.now();
      const gpsEvents = this.events.filter(e => 
        e.type === 'gps' && 
        e.timestamp > now - timeRange
      );
      
      const failures = {
        timestamp: now,
        time_range_hours: timeRange / (60 * 60 * 1000),
        total_requests: gpsEvents.length,
        accuracy_issues: gpsEvents.filter(e => e.eventType === 'gps_accuracy_issue').length,
        timeout_failures: gpsEvents.filter(e => e.eventType === 'gps_timeout').length,
        average_accuracy: this.calculateAverageGPSAccuracy(gpsEvents),
        accuracy_distribution: this.getAccuracyDistribution(gpsEvents),
        device_breakdown: this.getDeviceBreakdown(gpsEvents),
        recommendations: this.generateGPSRecommendations(gpsEvents)
      };
      
      console.log(`[GPS_VALIDATION]:`, failures);
      
      return failures;
    } catch (error) {
      console.error('Get GPS validation failures failed:', error);
      return null;
    }
  }

  /**
   * Get geofence rejection visibility
   */
  getGeofenceRejections(timeRange = 24 * 60 * 60 * 1000) {
    try {
      const now = Date.now();
      const geofenceEvents = this.events.filter(e => 
        e.eventType === 'geofence_rejection' && 
        e.timestamp > now - timeRange
      );
      
      const rejections = {
        timestamp: now,
        time_range_hours: timeRange / (60 * 60 * 1000),
        total_rejections: geofenceEvents.length,
        reason_breakdown: this.getGeofenceReasonBreakdown(geofenceEvents),
        location_breakdown: this.getGeofenceLocationBreakdown(geofenceEvents),
        device_breakdown: this.getGeofenceDeviceBreakdown(geofenceEvents),
        time_distribution: this.getGeofenceTimeDistribution(geofenceEvents),
        recommendations: this.generateGeofenceRecommendations(geofenceEvents)
      };
      
      console.log(`[GEOFENCE_REJECTIONS]:`, rejections);
      
      return rejections;
    } catch (error) {
      console.error('Get geofence rejections failed:', error);
      return null;
    }
  }

  /**
   * Helper methods
   */
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateTraceId() {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getErrorSeverity(error) {
    if (error.name === 'ValidationError') {
      return this.SEVERITY.WARNING;
    } else if (error.name === 'NetworkError') {
      return this.SEVERITY.ERROR;
    } else if (error.name === 'DatabaseError') {
      return this.SEVERITY.CRITICAL;
    }
    return this.SEVERITY.ERROR;
  }

  calculateErrorRate(events, errorTypes) {
    const totalEvents = events.filter(e => errorTypes.includes(e.eventType)).length;
    const errorEvents = events.filter(e => errorTypes.includes(e.eventType)).length;
    return totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;
  }

  calculateSuccessRate(events, successTypes) {
    const totalEvents = events.filter(e => successTypes.includes(e.eventType)).length;
    const successEvents = events.filter(e => successTypes.includes(e.eventType)).length;
    return totalEvents > 0 ? (successEvents / totalEvents) * 100 : 0;
  }

  calculateAverageGPSAccuracy(events) {
    const accuracyEvents = events.filter(e => e.accuracy !== undefined && e.accuracy !== null);
    if (accuracyEvents.length === 0) return 0;
    
    const totalAccuracy = accuracyEvents.reduce((sum, e) => sum + e.accuracy, 0);
    return totalAccuracy / accuracyEvents.length;
  }

  calculateAverageQueueWaitTime(events) {
    const waitTimeEvents = events.filter(e => e.wait_time !== undefined);
    if (waitTimeEvents.length === 0) return 0;
    
    const totalWaitTime = waitTimeEvents.reduce((sum, e) => sum + e.wait_time, 0);
    return totalWaitTime / waitTimeEvents.length;
  }

  calculateAverageSyncDuration(events) {
    const durationEvents = events.filter(e => e.duration !== undefined);
    if (durationEvents.length === 0) return 0;
    
    const totalDuration = durationEvents.reduce((sum, e) => sum + e.duration, 0);
    return totalDuration / durationEvents.length;
  }

  calculateAverageOperationDuration(events) {
    const durationEvents = events.filter(e => e.duration !== undefined);
    if (durationEvents.length === 0) return 0;
    
    const totalDuration = durationEvents.reduce((sum, e) => sum + e.duration, 0);
    return totalDuration / durationEvents.length;
  }

  getCurrentQueueSize() {
    // This would get the actual queue size from the queue service
    return 0; // Placeholder
  }

  getOperationStatusFromEvent(event) {
    switch (event.eventType) {
      case 'operation_processed':
        return 'success';
      case 'operation_failed':
        return 'failed';
      default:
        return 'pending';
    }
  }

  getOperationAttempts(event) {
    return event.metadata?.attempts || 0;
  }

  detectQueueIssues(events) {
    const issues = [];
    
    // Check for high failure rate
    const failureRate = this.calculateErrorRate(events, ['operation_failed']);
    if (failureRate > 10) {
      issues.push({
        type: 'high_failure_rate',
        severity: 'warning',
        description: `High failure rate: ${failureRate.toFixed(1)}%`
      });
    }
    
    // Check for old operations
    const oldOperations = events.filter(e => Date.now() - e.timestamp > 4 * 60 * 60 * 1000);
    if (oldOperations.length > 5) {
      issues.push({
        type: 'old_operations',
        severity: 'warning',
        description: `${oldOperations.length} operations older than 4 hours`
      });
    }
    
    return issues;
  }

  generateQueueRecommendations(events) {
    const recommendations = [];
    
    const failureRate = this.calculateErrorRate(events, ['operation_failed']);
    if (failureRate > 10) {
      recommendations.push({
        type: 'investigate_queue',
        description: 'Investigate queue processing failures'
      });
    }
    
    return recommendations;
  }

  detectConvergenceIssues(events) {
    const issues = [];
    
    // Check for state inconsistencies
    const stateTransitions = events.filter(e => e.type === 'state');
    const inconsistentStates = stateTransitions.filter(e => {
      // Check for invalid transitions
      return this.isInvalidTransition(e.fromState, e.toState);
    });
    
    if (inconsistentStates.length > 0) {
      issues.push({
        type: 'state_inconsistency',
        severity: 'error',
        description: `${inconsistentStates.length} invalid state transitions`
      });
    }
    
    return issues;
  }

  generateConvergenceRecommendations(events) {
    const recommendations = [];
    
    const inconsistentStates = events.filter(e => 
      e.type === 'state' && this.isInvalidTransition(e.fromState, e.toState)
    );
    
    if (inconsistentStates.length > 0) {
      recommendations.push({
        type: 'validate_state_transitions',
        description: 'Validate state transition logic'
      });
    }
    
    return recommendations;
  }

  isInvalidTransition(fromState, toState) {
    // Simple validation for common invalid transitions
    const invalidTransitions = [
      { from: 'idle', to: 'on_break' },
      { from: 'clocked_in', to: 'clocked_in' },
      { from: 'on_break', to: 'on_break' },
      { from: 'idle', to: 'idle' }
    ];
    
    return invalidTransitions.some(t => t.from === fromState && t.to === toState);
  }

  getStateHistory(events) {
    const stateEvents = events.filter(e => e.type === 'state');
    return stateEvents.map(e => ({
      timestamp: e.timestamp,
      fromState: e.fromState,
      toState: e.toState,
      operation: e.operation
    }));
  }

  getSyncHistory(events) {
    const syncEvents = events.filter(e => e.type === 'sync');
    return syncEvents.map(e => ({
      timestamp: e.timestamp,
      eventType: e.eventType,
      operationCount: e.operationCount,
      successCount: e.successCount,
      failureCount: e.failureCount,
      duration: e.duration
    }));
  }

  getErrorTypeBreakdown(events) {
    const errorEvents = events.filter(e => e.type === 'error');
    const breakdown = {};
    
    errorEvents.forEach(e => {
      breakdown[e.eventType] = (breakdown[e.eventType] || 0) + 1;
    });
    
    return breakdown;
  }

  getAccuracyDistribution(events) {
    const accuracyEvents = events.filter(e => e.accuracy !== undefined && e.accuracy !== null);
    const distribution = {
      excellent: 0,    // < 5m
      good: 0,        // 5-10m
      fair: 0,         // 10-20m
      poor: 0,         // > 20m
      unknown: 0
    };
    
    accuracyEvents.forEach(e => {
      if (e.accuracy < 5) distribution.excellent++;
      else if (e.accuracy < 10) distribution.good++;
      else if (e.accuracy < 20) distribution.fair++;
      else if (e.accuracy >= 20) distribution.poor++;
      else distribution.unknown++;
    });
    
    return distribution;
  }

  getDeviceBreakdown(events) {
    const breakdown = {};
    
    events.forEach(e => {
      const deviceId = e.metadata?.deviceId || 'unknown';
      breakdown[deviceId] = (breakdown[deviceId] || 0) + 1;
    });
    
    return breakdown;
  }

  getGeofenceReasonBreakdown(events) {
    const breakdown = {};
    
    events.forEach(e => {
      const reason = e.metadata?.reason || 'unknown';
      breakdown[reason] = (breakdown[reason] || 0) + 1;
    });
    
    return breakdown;
  }

  getGeofenceLocationBreakdown(events) {
    const breakdown = {};
    
    events.forEach(e => {
      const locationId = e.metadata?.locationId || 'unknown';
      breakdown[locationId] = (breakdown[locationId] || 0) + 1;
    });
    
    return breakdown;
  }

  getGeofenceDeviceBreakdown(events) {
    const breakdown = {};
    
    events.forEach(e => {
      const deviceId = e.metadata?.deviceId || 'unknown';
      breakdown[deviceId] = (breakdown[deviceId] || 0) + 1;
    });
    
    return breakdown;
  }

  getGeofenceTimeDistribution(events) {
    const distribution = {
      morning: 0,    // 6-12
      afternoon: 0,  // 12-18
      evening: 0,    // 18-24
      night: 0       // 0-6
    };
    
    events.forEach(e => {
      const hour = new Date(e.timestamp).getHours();
      
      if (hour >= 6 && hour < 12) distribution.morning++;
      else if (hour >= 12 && hour < 18) distribution.afternoon++;
      else if (hour >= 18 && hour < 24) distribution.evening++;
      else distribution.night++;
    });
    
    return distribution;
  }

  generateGPSRecommendations(events) {
    const recommendations = [];
    
    const accuracyIssues = events.filter(e => e.eventType === 'gps_accuracy_issue').length;
    if (accuracyIssues > 5) {
      recommendations.push({
        type: 'check_gps_settings',
        description: 'Check GPS settings and device configuration'
      });
    }
    
    const timeoutFailures = events.filter(e => e.eventType === 'gps_timeout').length;
    if (timeoutFailures > 3) {
      recommendations.push({
        type: 'improve_gps_timeout',
        description: 'Improve GPS timeout handling'
      });
    }
    
    return recommendations;
  }

  generateGeofenceRecommendations(events) {
    const recommendations = [];
    
    const totalRejections = events.length;
    if (totalRejections > 10) {
      recommendations.push({
        type: 'investigate_geofence',
        description: 'Investigate high geofence rejection rate'
      });
    }
    
    return recommendations;
  }

  updateSyncMetrics(eventType, data) {
    // Update sync metrics
    if (eventType === 'sync_success') {
      this.metrics.sync.success_count = (this.metrics.sync?.success_count || 0) + 1;
    } else if (eventType === 'sync_failed') {
      this.metrics.sync.failure_count = (this.metrics.sync?.failure_count || 0) + 1;
    }
    
    this.metrics.sync.last_sync = Date.now();
    this.persistMetrics();
  }

  checkForAlerts(event) {
    // Check for alert conditions
    if (event.severity === this.SEVERITY.CRITICAL) {
      this.createAlert('critical', event.type, event.message, event.metadata);
    } else if (event.severity === this.SEVERITY.ERROR) {
      // Check error rate
      const recentErrors = this.events.filter(e => 
        e.type === 'error' && 
        e.timestamp > Date.now() - (60 * 60 * 1000)
      );
      
      if (recentErrors.length > 5) {
        this.createAlert('warning', 'high_error_rate', 'High error rate detected', {
          error_count: recentErrors.length,
          time_window: '1 hour'
        });
      }
    }
  }

  sendCriticalNotification(alert) {
    // This would integrate with push notification service
    console.log(`[CRITICAL_NOTIFICATION]: ${alert.message}`);
    
    // Placeholder for actual notification implementation
    // PushNotificationService.send(alert);
  }

  /**
   * Persistence methods
   */
  async loadEvents() {
    try {
      const eventsData = await AsyncStorage.getItem(this.EVENTS_KEY);
      this.events = eventsData ? JSON.parse(eventsData) : [];
    } catch (error) {
      console.error('Load events failed:', error);
      this.events = [];
    }
  }

  async persistEvents() {
    try {
      await AsyncStorage.setItem(this.EVENTS_KEY, JSON.stringify(this.events));
    } catch (error) {
      console.error('Persist events failed:', error);
    }
  }

  async loadMetrics() {
    try {
      const metricsData = await AsyncStorage.getItem(this.METRICS_KEY);
      this.metrics = metricsData ? JSON.parse(metricsData) : {};
    } catch (error) {
      console.error('Load metrics failed:', error);
      this.metrics = {};
    }
  }

  async persistMetrics() {
    try {
      await AsyncStorage.setItem(this.METRICS_KEY, JSON.stringify(this.metrics));
    } catch (error) {
      console.error('Persist metrics failed:', error);
    }
  }

  async loadAlerts() {
    try {
      const alertsData = await AsyncStorage.getItem(this.ALERTS_KEY);
      this.alerts = alertsData ? JSON.parse(alertsData) : [];
    } catch (error) {
      console.error('Load alerts failed:', error);
      this.alerts = [];
    }
  }

  async persistAlerts() {
    try {
      await AsyncStorage.setItem(this.ALERTS_KEY, JSON.stringify(this.alerts));
    } catch (error) {
      console.error('Persist alerts failed:', error);
    }
  }

  async loadTraces() {
    try {
      const tracesData = await AsyncStorage.getItem(this.TRACES_KEY);
      this.traces = tracesData ? JSON.parse(tracesData) : [];
    } catch (error) {
      console.error('Load traces failed:', error);
      this.traces = [];
    }
  }

  async persistTraces() {
    try {
      await AsyncStorage.setItem(this.TRACES_KEY, JSON.stringify(this.traces));
    } catch (error) {
      console.error('Persist traces failed:', error);
    }
  }

  /**
   * Cleanup methods
   */
  trimEvents() {
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }
  }

  trimAlerts() {
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts = this.alerts.slice(-this.MAX_ALERTS);
    }
  }

  trimTraces() {
    if (this.traces.length > this.MAX_TRACES) {
      this.traces = this.traces.slice(-this.MAX_TRACES);
    }
  }

  startCleanupInterval() {
    // Clean up old data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);
  }

  async cleanupOldData() {
    try {
      const cutoffTime = Date.now() - (this.RETENTION_DAYS * 24 * 60 * 60 * 1000);
      
      // Clean events
      const validEvents = this.events.filter(e => e.timestamp > cutoffTime);
      if (validEvents.length !== this.events.length) {
        this.events = validEvents;
        await this.persistEvents();
        console.log(`Cleaned up ${this.events.length - validEvents.length} old events`);
      }
      
      // Clean alerts
      const validAlerts = this.alerts.filter(a => a.timestamp > cutoffTime);
      if (validAlerts.length !== this.alerts.length) {
        this.alerts = validAlerts;
        await this.persistAlerts();
        console.log(`Cleaned up ${this.alerts.length - validAlerts.length} old alerts`);
      }
      
      // Clean traces
      const validTraces = this.traces.filter(t => t.timestamp > cutoffTime);
      if (validTraces.length !== this.traces.length) {
        this.traces = validTraces;
        await this.persistTraces();
        console.log(`Cleaned up ${this.traces.length - validTraces.length} old traces`);
      }
    } catch (error) {
      console.error('Cleanup old data failed:', error);
    }
  }
}

// Create singleton instance
const operationalObservability = new OperationalObservability();

export default operationalObservability;
