# Attendance Observability and Logging System

## Overview

This document describes the production-safe attendance logging and observability system implemented for FieldSync, providing comprehensive monitoring of lifecycle transitions, replay detection, duplicate actions, and invalid state attempts.

## Architecture

### Core Components

1. **AttendanceLogger Class** (`services/attendanceLogger.js`)
   - Structured logging with multiple log levels
   - Event categorization (lifecycle, duplicate, replay, security, performance)
   - JSON metadata storage for rich context
   - Automatic cleanup functionality
   - Performance metrics tracking

2. **Logging Middleware** (`middleware/attendanceLoggingMiddleware.js`)
   - Non-intrusive request interception
   - Request ID generation for traceability
   - Helper functions for different log types
   - Performance monitoring with response time tracking

3. **Enhanced Routes** (`routes/shifts-logged.js`)
   - Integration examples with comprehensive logging
   - State transition logging
   - Duplicate detection logging
   - Security event logging
   - Performance metrics collection

4. **Observability Dashboard** (`routes/attendanceDashboard.js`)
   - Real-time analytics API
   - Duplicate detection summaries
   - Security event monitoring
   - Performance metrics dashboard
   - Log cleanup functionality

## Log Categories and Levels

### Log Levels
```javascript
const LogLevel = {
  INFO: 'INFO',      // Normal operations, successful transitions
  WARN: 'WARN',      // Duplicate actions, replay detection
  ERROR: 'ERROR',    // Invalid state attempts, validation failures
  CRITICAL: 'CRITICAL' // Security events, data corruption
};
```

### Event Categories
```javascript
const EventCategory = {
  LIFECYCLE: 'LIFECYCLE',       // Clock-in, clock-out, break start/end
  DUPLICATE: 'DUPLICATE',           // Duplicate request detection
  REPLAY: 'REPLAY',               // Offline/network replay detection
  INVALID_STATE: 'INVALID_STATE',  // Invalid state transitions
  SECURITY: 'SECURITY',            // Security violations, attacks
  PERFORMANCE: 'PERFORMANCE'         // Performance metrics and timing
};
```

## Database Schema

### Attendance Logs Table
```sql
CREATE TABLE attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  level VARCHAR(10) NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
  category VARCHAR(20) NOT NULL CHECK (category IN ('LIFECYCLE', 'DUPLICATE', 'REPLAY', 'INVALID_STATE', 'SECURITY', 'PERFORMANCE')),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  event VARCHAR(50) NOT NULL,
  shift_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Key Features

### 1. Lifecycle Transition Logging
```javascript
// Log successful clock-in
await logger.logLifecycle(userId, companyId, 'clock_in_completed', shiftId, {
  isLate,
  location_id,
  scheduleId: schedule?.id,
  geofenceCompliance: distance <= location.radius
});

// Log break start
await logger.logLifecycle(userId, companyId, 'break_start_completed', shiftId, {
  reason,
  hasLocation: !!location
});
```

### 2. Duplicate Detection
```javascript
// State-based duplicate detection
if (existingShift.state === AttendanceState.CLOCKED_IN) {
  await logger.logDuplicate(userId, companyId, 'clock_in_attempt', shiftId, {
    type: 'state_based',
    window: 0, // No time window for state-based detection
    existingState: 'CLOCKED_IN',
    attemptedState: 'CLOCKED_IN'
  });
}
```

### 3. Replay Detection
```javascript
// Network replay detection
const requestAge = Date.now() - new Date(request.timestamp).getTime();
if (requestAge < 5000) { // 5 seconds
  await logger.logReplay(userId, companyId, 'clock_in_replay', shiftId, {
    type: 'network_retry',
    replayAge: requestAge,
    originalTimestamp: request.timestamp,
    replayCount: user.replayCount + 1
  });
}
```

### 4. Security Event Logging
```javascript
// Suspicious activity detection
if (attemptsPerMinute > 10) {
  await logger.logSecurity(userId, companyId, 'rate_limit_exceeded', securityDetails, {
    threat: 'brute_force',
    severity: 'high',
    source: 'api',
    attemptsPerMinute
  });
}
```

### 5. Performance Monitoring
```javascript
// Automatic response time tracking
const originalEnd = res.end;
res.end = function() {
  const duration = Date.now() - startTime;
  await logger.logPerformance(userId, companyId, 'clock_in', {
    duration,
    statusCode: res.statusCode,
    databaseQueries: 3
  });
  originalEnd.call(this);
};
```

## API Endpoints

### Analytics API
```
GET /api/attendance/analytics
```
Returns comprehensive attendance analytics including:
- Recent lifecycle events
- Duplicate detection summary
- Performance metrics
- Error rates by category

### Duplicate Detection API
```
GET /api/attendance/duplicates
```
Returns duplicate detection summary for specified time period:
- Total events by category
- Duplicate types and frequencies
- User-specific duplicate patterns

### Security Events API
```
GET /api/attendance/security
```
Returns security events for monitoring:
- Recent security violations
- Attack patterns
- Threat levels and sources
- IP and user agent analysis

### Performance Metrics API
```
GET /api/attendance/performance
```
Returns performance analytics:
- Response time distributions
- Database query performance
- System health indicators
- Bottleneck identification

### Log Cleanup API
```
POST /api/attendance/cleanup
```
Admin-only endpoint for log maintenance:
- Configurable retention period
- Automatic old log cleanup
- Cleanup confirmation and metrics

## Integration Benefits

### For Development Team
1. **Real-time Monitoring** - Live view of attendance system health
2. **Troubleshooting Support** - Detailed logs for issue diagnosis
3. **Performance Optimization** - Identify bottlenecks and optimization opportunities
4. **Security Monitoring** - Early detection of suspicious activities
5. **Compliance Reporting** - Audit-ready logs for regulatory requirements

### For Operations Team
1. **Proactive Alerting** - Automated notifications for critical events
2. **Trend Analysis** - Pattern recognition in user behavior
3. **Capacity Planning** - Data-driven infrastructure decisions
4. **Incident Response** - Quick access to relevant event data
5. **SLA Monitoring** - Service level agreement compliance tracking

## Monitoring Dashboards

### Key Metrics to Track
1. **Request Volume**: Total attendance requests per time period
2. **Success Rate**: Percentage of successful operations
3. **Error Rate**: Failed operations by category and reason
4. **Response Time**: API response time distributions
5. **Duplicate Rate**: Frequency and patterns of duplicate requests
6. **Replay Detection**: Offline/network replay events
7. **Security Events**: Unauthorized access attempts and violations
8. **Performance**: Database query times and system health

### Alerting Thresholds
- **Error Rate > 5%**: Investigate system issues
- **Duplicate Rate > 2%**: Check for client-side issues
- **Response Time > 2s**: Performance investigation
- **Security Events > 10/hour**: Security team notification
- **Log Volume > 10000/hour**: Infrastructure scaling

## Implementation Benefits

### Production Safety
- **Non-intrusive**: Middleware-based approach with zero breaking changes
- **Comprehensive Coverage**: All attendance operations monitored
- **Rich Context**: JSON metadata captures full request context
- **Performance Optimized**: Minimal overhead with efficient indexing
- **Security Focused**: Dedicated security event tracking

### Operational Excellence
- **Real-time Observability**: Live dashboards for immediate insights
- **Historical Analysis**: Trend identification and capacity planning
- **Automated Maintenance**: Self-cleaning log management
- **Compliance Ready**: Audit-trail logging for regulatory requirements

This observability system provides enterprise-grade monitoring and logging capabilities while maintaining the lightweight, non-intrusive architecture required for production deployment.
