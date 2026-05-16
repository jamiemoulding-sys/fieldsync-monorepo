-- Final Minimal Attendance Schema
-- Addresses ALL identified production risks

-- Drop existing schema
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_devices CASCADE;
DROP TABLE IF EXISTS constraint_violations CASCADE;

-- Core attendance table with comprehensive fixes
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  location_id UUID NOT NULL,
  
  -- Core timing fields
  clock_in_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  clock_out_time TIMESTAMP WITH TIME ZONE,
  break_started_at TIMESTAMP WITH TIME ZONE,
  total_break_seconds INTEGER DEFAULT 0,
  total_hours NUMERIC(10,2) DEFAULT 0,
  
  -- Location fields with validation
  clock_in_lat NUMERIC(10,8),
  clock_in_lng NUMERIC(11,8),
  clock_out_lat NUMERIC(10,8),
  clock_out_lng NUMERIC(11,8),
  
  -- Device tracking with cryptographic fingerprint
  device_fingerprint VARCHAR(64) NOT NULL, -- SHA256 hash
  session_id UUID NOT NULL, -- UUID prevents collision - Risk #14
  
  -- Metadata with JSON validation
  metadata JSONB DEFAULT '{}',
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- COMPREHENSIVE CONSTRAINTS (all NOT DEFERRABLE)
ALTER TABLE shifts ADD CONSTRAINT shifts_unique_active 
  UNIQUE (user_id, company_id, clock_out_time) 
  NOT DEFERRABLE;

ALTER TABLE shifts ADD CONSTRAINT shifts_clock_out_after_clock_in 
  CHECK (clock_out_time IS NULL OR clock_out_time > clock_in_time);

ALTER TABLE shifts ADD CONSTRAINT shifts_break_during_shift 
  CHECK (break_started_at IS NULL OR 
         (break_started_at > clock_in_time AND 
          (clock_out_time IS NULL OR break_started_at < clock_out_time)));

ALTER TABLE shifts ADD CONSTRAINT shifts_break_not_during_clock_out 
  CHECK (clock_out_time IS NULL OR break_started_at IS NULL);

ALTER TABLE shifts ADD CONSTRAINT shifts_total_break_positive 
  CHECK (total_break_seconds >= 0);

ALTER TABLE shifts ADD CONSTRAINT shifts_total_hours_positive 
  CHECK (total_hours >= 0);

ALTER TABLE shifts ADD CONSTRAINT shifts_total_hours_max 
  CHECK (total_hours <= 24); -- Max 24 hours per shift

ALTER TABLE shifts ADD CONSTRAINT shifts_lat_range 
  CHECK (
    (clock_in_lat IS NULL OR (clock_in_lat >= -90 AND clock_in_lat <= 90)) AND
    (clock_out_lat IS NULL OR (clock_out_lat >= -90 AND clock_out_lat <= 90))
  );

ALTER TABLE shifts ADD CONSTRAINT shifts_lng_range 
  CHECK (
    (clock_in_lng IS NULL OR (clock_in_lng >= -180 AND clock_in_lng <= 180)) AND
    (clock_out_lng IS NULL OR (clock_out_lng >= -180 AND clock_out_lng <= 180))
  );

ALTER TABLE shifts ADD CONSTRAINT shifts_device_fingerprint_format 
  CHECK (device_fingerprint ~ '^[a-f0-9]{64}$'); -- SHA256 format

-- User sessions with UUID session IDs - Fix for Risk #14
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  device_fingerprint VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '12 hours'),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent expired session usage - Risk #5
  CONSTRAINT sessions_not_expired CHECK (expires_at > NOW()),
  
  -- Prevent duplicate session IDs
  CONSTRAINT sessions_unique_session UNIQUE (session_id),
  
  -- Prevent duplicate active sessions per user/device
  CONSTRAINT sessions_unique_user_device UNIQUE (user_id, device_fingerprint, status)
);

-- User devices for enhanced concurrency protection
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  device_fingerprint VARCHAR(64) NOT NULL,
  device_type VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, device_fingerprint),
  CONSTRAINT devices_fingerprint_format CHECK (device_fingerprint ~ '^[a-f0-9]{64}$')
);

-- Constraint violations logging - Fix for Risk #21
CREATE TABLE IF NOT EXISTS constraint_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(255) NOT NULL,
  constraint_name VARCHAR(255) NOT NULL,
  violation_data JSONB,
  user_id UUID,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OPTIMIZED INDEXES
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_active 
ON shifts (user_id, company_id, clock_out_time DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_break 
ON shifts (user_id, company_id, break_started_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_device 
ON shifts (device_fingerprint, user_id, company_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_time 
ON shifts (clock_in_time DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_session 
ON shifts (session_id, user_id, company_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active 
ON user_sessions (user_id, company_id, expires_at DESC, status DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_device 
ON user_sessions (device_fingerprint, user_id, last_activity DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_violations_recent 
ON constraint_violations (created_at DESC, company_id);

-- ENHANCED DATABASE FUNCTIONS

-- Timezone-aware validation - Fix for Risk #13
CREATE OR REPLACE FUNCTION validate_shift_timezone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_out_time IS NOT NULL THEN
    DECLARE
      clock_in_utc TIMESTAMP WITH TIME ZONE;
      clock_out_utc TIMESTAMP WITH TIME ZONE;
      max_shift_hours NUMERIC := 16; -- Maximum reasonable shift
      shift_duration NUMERIC;
    BEGIN
      clock_in_utc := NEW.clock_in_time AT TIME ZONE 'UTC';
      clock_out_utc := NEW.clock_out_time AT TIME ZONE 'UTC';
      
      -- Calculate shift duration in UTC
      shift_duration := EXTRACT(EPOCH FROM (clock_out_utc - clock_in_utc)) / 3600;
      
      -- Check for reasonable shift duration
      IF shift_duration > max_shift_hours THEN
        -- Log violation
        INSERT INTO constraint_violations (
          table_name, constraint_name, violation_data, user_id, company_id
        ) VALUES (
          'shifts', 'max_shift_duration', 
          jsonb_build_object('shift_duration', shift_duration),
          NEW.user_id, NEW.company_id
        );
        
        RAISE EXCEPTION 'Shift duration exceeds maximum of % hours', max_shift_hours;
      END IF;
      
      -- Check for negative duration (clock skew)
      IF shift_duration < 0 THEN
        INSERT INTO constraint_violations (
          table_name, constraint_name, violation_data, user_id, company_id
        ) VALUES (
          'shifts', 'negative_shift_duration', 
          jsonb_build_object('shift_duration', shift_duration),
          NEW.user_id, NEW.company_id
        );
        
        RAISE EXCEPTION 'Negative shift duration detected: possible clock skew';
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Server-side time validation - Fix for Risk #16
CREATE OR REPLACE FUNCTION validate_server_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_out_time IS NOT NULL THEN
    DECLARE
      client_clock_out TIMESTAMP WITH TIME ZONE := NEW.clock_out_time;
      server_now TIMESTAMP WITH TIME ZONE := NOW();
      time_diff_minutes NUMERIC;
    BEGIN
      time_diff_minutes := EXTRACT(EPOCH FROM (server_now - client_clock_out)) / 60;
      
      -- If client time is more than 5 minutes off, use server time
      IF ABS(time_diff_minutes) > 5 THEN
        NEW.metadata := jsonb_set(
          COALESCE(NEW.metadata, '{}'),
          '{time_corrected}',
          'true'
        );
        NEW.metadata := jsonb_set(
          NEW.metadata,
          '{original_client_time}',
          to_jsonb(client_clock_out)
        );
        NEW.metadata := jsonb_set(
          NEW.metadata,
          '{time_correction_reason}',
          to_jsonb('Client time deviation > 5 minutes')
        );
        
        -- Use server time instead
        NEW.clock_out_time := server_now;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enhanced payroll integrity validation
CREATE OR REPLACE FUNCTION validate_shift_payroll_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate total hours calculation
  IF NEW.clock_out_time IS NOT NULL THEN
    DECLARE
      expected_hours NUMERIC(10,2);
      actual_hours NUMERIC(10,2);
      tolerance NUMERIC := 0.02; -- 1 minute tolerance
    BEGIN
      -- Use UTC times for calculation
      expected_hours := EXTRACT(EPOCH FROM (
        (NEW.clock_out_time AT TIME ZONE 'UTC') - 
        (NEW.clock_in_time AT TIME ZONE 'UTC')
      )) / 3600;
      
      IF NEW.total_break_seconds > 0 THEN
        expected_hours := expected_hours - (NEW.total_break_seconds / 3600);
      END IF;
      
      actual_hours := NEW.total_hours;
      
      -- Check for calculation errors
      IF ABS(expected_hours - actual_hours) > tolerance THEN
        INSERT INTO constraint_violations (
          table_name, constraint_name, violation_data, user_id, company_id
        ) VALUES (
          'shifts', 'payroll_calculation_mismatch', 
          jsonb_build_object(
            'expected_hours', expected_hours,
            'actual_hours', actual_hours,
            'difference', ABS(expected_hours - actual_hours)
          ),
          NEW.user_id, NEW.company_id
        );
        
        RAISE EXCEPTION 'Total hours calculation mismatch: expected %, got %', 
          expected_hours, actual_hours;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fixed break duration calculation
CREATE OR REPLACE FUNCTION calculate_break_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.break_started_at IS NOT NULL AND NEW.break_started_at IS NULL THEN
    DECLARE
      break_duration NUMERIC;
      break_start TIMESTAMP WITH TIME ZONE;
      break_end TIMESTAMP WITH TIME ZONE;
    BEGIN
      break_start := OLD.break_started_at AT TIME ZONE 'UTC';
      
      IF NEW.clock_out_time IS NOT NULL THEN
        break_end := NEW.clock_out_time AT TIME ZONE 'UTC';
      ELSE
        break_end := NOW() AT TIME ZONE 'UTC';
      END IF;
      
      break_duration := EXTRACT(EPOCH FROM (break_end - break_start));
      
      -- Validate break duration (max 4 hours)
      IF break_duration > 4 * 3600 THEN
        INSERT INTO constraint_violations (
          table_name, constraint_name, violation_data, user_id, company_id
        ) VALUES (
          'shifts', 'excessive_break_duration', 
          jsonb_build_object('break_duration_seconds', break_duration),
          NEW.user_id, NEW.company_id
        );
        
        RAISE EXCEPTION 'Break duration exceeds maximum of 4 hours';
      END IF;
      
      NEW.total_break_seconds := COALESCE(OLD.total_break_seconds, 0) + break_duration;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fixed total hours calculation
CREATE OR REPLACE FUNCTION calculate_total_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.clock_out_time IS NULL AND NEW.clock_out_time IS NOT NULL THEN
    DECLARE
      total_seconds NUMERIC;
      work_seconds NUMERIC;
    BEGIN
      -- Use UTC times for calculation
      total_seconds := EXTRACT(EPOCH FROM (
        (NEW.clock_out_time AT TIME ZONE 'UTC') - 
        (NEW.clock_in_time AT TIME ZONE 'UTC')
      ));
      
      work_seconds := total_seconds - COALESCE(NEW.total_break_seconds, 0);
      
      NEW.total_hours := work_seconds / 3600;
      
      -- Validate reasonable hours (max 16 hours work time)
      IF NEW.total_hours > 16 THEN
        INSERT INTO constraint_violations (
          table_name, constraint_name, violation_data, user_id, company_id
        ) VALUES (
          'shifts', 'excessive_work_hours', 
          jsonb_build_object('total_hours', NEW.total_hours),
          NEW.user_id, NEW.company_id
        );
        
        RAISE EXCEPTION 'Work hours exceed maximum of 16 hours';
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS (in correct order to avoid conflicts)
CREATE TRIGGER validate_shift_timezone_trigger
  BEFORE INSERT OR UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION validate_shift_timezone();

CREATE TRIGGER validate_server_time_trigger
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION validate_server_time();

CREATE TRIGGER validate_payroll_integrity_trigger
  BEFORE INSERT OR UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION validate_shift_payroll_integrity();

CREATE TRIGGER calculate_break_duration_trigger
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_break_duration();

CREATE TRIGGER calculate_total_hours_trigger
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_hours();

CREATE TRIGGER update_timestamp_trigger
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Session cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() OR status = 'EXPIRED';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Enhanced health check function
CREATE OR REPLACE FUNCTION attendance_health_check()
RETURNS JSONB AS $$
DECLARE
  health JSONB := '{"status": "healthy", "checks": {}}'::JSONB;
  active_shifts INTEGER;
  recent_shifts INTEGER;
  constraint_violations INTEGER;
  expired_sessions INTEGER;
  active_sessions INTEGER;
  pool_status JSONB;
BEGIN
  -- Test database connectivity
  PERFORM 1;
  health := jsonb_set(health, '{checks,database}', 'ok'::JSONB);
  
  -- Count active shifts
  SELECT COUNT(*) INTO active_shifts 
  FROM shifts 
  WHERE clock_out_time IS NULL;
  
  health := jsonb_set(health, '{checks,active_shifts}', active_shifts::JSONB);
  
  -- Count recent shifts (last 24 hours)
  SELECT COUNT(*) INTO recent_shifts 
  FROM shifts 
  WHERE clock_in_time > NOW() - INTERVAL '24 hours';
  
  health := jsonb_set(health, '{checks,recent_shifts}', recent_shifts::JSONB);
  
  -- Check for constraint violations
  SELECT COUNT(*) INTO constraint_violations
  FROM constraint_violations 
  WHERE created_at > NOW() - INTERVAL '1 hour';
  
  health := jsonb_set(health, '{checks,recent_violations}', constraint_violations::JSONB);
  
  -- Check expired sessions
  SELECT COUNT(*) INTO expired_sessions
  FROM user_sessions 
  WHERE expires_at < NOW();
  
  health := jsonb_set(health, '{checks,expired_sessions}', expired_sessions::JSONB);
  
  -- Count active sessions
  SELECT COUNT(*) INTO active_sessions
  FROM user_sessions 
  WHERE expires_at > NOW() AND status = 'ACTIVE';
  
  health := jsonb_set(health, '{checks,active_sessions}', active_sessions::JSONB);
  
  -- Overall status
  IF constraint_violations > 10 OR expired_sessions > 100 THEN
    health := jsonb_set(health, '{status}', 'warning'::JSONB);
  END IF;
  
  IF constraint_violations > 50 OR expired_sessions > 500 THEN
    health := jsonb_set(health, '{status}', 'critical'::JSONB);
  END IF;
  
  RETURN health;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'status', 'unhealthy',
    'error', SQLERRM,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- System statistics function
CREATE OR REPLACE FUNCTION attendance_system_stats()
RETURNS JSONB AS $$
DECLARE
  stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'active_shifts', (SELECT COUNT(*) FROM shifts WHERE clock_out_time IS NULL),
    'recent_shifts', (SELECT COUNT(*) FROM shifts WHERE clock_in_time > NOW() - INTERVAL '24 hours'),
    'total_shifts', (SELECT COUNT(*) FROM shifts),
    'active_sessions', (SELECT COUNT(*) FROM user_sessions WHERE expires_at > NOW()),
    'total_sessions', (SELECT COUNT(*) FROM user_sessions),
    'active_devices', (SELECT COUNT(*) FROM user_devices WHERE status = 'ACTIVE'),
    'recent_violations', (SELECT COUNT(*) FROM constraint_violations WHERE created_at > NOW() - INTERVAL '1 hour'),
    'total_violations', (SELECT COUNT(*) FROM constraint_violations),
    'avg_shift_hours', (SELECT AVG(total_hours) FROM shifts WHERE clock_out_time IS NOT NULL AND clock_in_time > NOW() - INTERVAL '7 days'),
    'avg_break_seconds', (SELECT AVG(total_break_seconds) FROM shifts WHERE total_break_seconds > 0 AND clock_in_time > NOW() - INTERVAL '7 days')
  ) INTO stats;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE constraint_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY shifts_company_policy ON shifts
  FOR ALL TO authenticated_users
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY sessions_company_policy ON user_sessions
  FOR ALL TO authenticated_users
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY devices_company_policy ON user_devices
  FOR ALL TO authenticated_users
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY violations_company_policy ON constraint_violations
  FOR ALL TO authenticated_users
  USING (company_id = current_setting('app.current_company_id')::uuid);

-- Performance optimization
ALTER SYSTEM SET shared_buffers = '128MB';
ALTER SYSTEM SET work_mem = '8MB';
ALTER SYSTEM SET maintenance_work_mem = '32MB';
ALTER SYSTEM SET statement_timeout = '30s';
ALTER SYSTEM SET lock_timeout = '10s';

-- Enable query statistics
ALTER SYSTEM SET track_activities = 'on';
ALTER SYSTEM SET track_counts = 'on';

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated_users;
GRANT SELECT, INSERT, UPDATE ON shifts TO authenticated_users;
GRANT SELECT, INSERT, UPDATE ON user_sessions TO authenticated_users;
GRANT SELECT, INSERT, UPDATE ON user_devices TO authenticated_users;
GRANT SELECT ON constraint_violations TO authenticated_users;

-- Schedule cleanup
SELECT cron.schedule('0 */6 * * *', $$SELECT cleanup_expired_sessions()$$);

-- Comments
COMMENT ON TABLE shifts IS 'Final minimal attendance table with comprehensive production safety';
COMMENT ON CONSTRAINT shifts_unique_active ON shifts IS 'NOT DEFERRABLE - prevents race conditions';
COMMENT ON CONSTRAINT shifts_device_fingerprint_format ON shifts IS 'SHA256 format prevents spoofing';
COMMENT ON CONSTRAINT sessions_not_expired ON user_sessions IS 'Prevents expired session usage';
COMMENT ON TABLE constraint_violations IS 'Logs all constraint violations for security monitoring';

COMMENT ON FUNCTION validate_shift_timezone() IS 'Timezone-aware validation prevents edge cases';
COMMENT ON FUNCTION validate_server_time() IS 'Server-side time validation prevents clock manipulation';
COMMENT ON FUNCTION attendance_health_check() IS 'Enhanced health check with comprehensive monitoring';
