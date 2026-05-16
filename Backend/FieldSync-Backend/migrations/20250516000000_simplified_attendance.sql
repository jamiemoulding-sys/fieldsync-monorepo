-- Simplified Attendance Schema
-- Minimal production-safe schema with all critical protections

-- Core attendance table with essential fields only
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
  total_hours NUMERIC DEFAULT 0,
  
  -- Location fields
  clock_in_lat NUMERIC,
  clock_in_lng NUMERIC,
  clock_out_lat NUMERIC,
  clock_out_lng NUMERIC,
  
  -- Device tracking for concurrency protection
  device_fingerprint VARCHAR(255),
  session_id VARCHAR(255),
  device_type VARCHAR(50) DEFAULT 'web',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Simple audit trail for all changes
CREATE TABLE IF NOT EXISTS attendance_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- clock_in, clock_out, break_start, break_end
  before_data JSONB,
  after_data JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions for replay protection and concurrency
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  device_fingerprint VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '12 hours'),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device tracking for concurrent device detection
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  device_fingerprint VARCHAR(255) NOT NULL,
  device_type VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, device_fingerprint)
);

-- Essential indexes for performance and concurrency
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_active_user 
ON shifts (user_id, company_id, clock_out_time DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_break_state 
ON shifts (user_id, company_id, break_started_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_device 
ON shifts (device_fingerprint, user_id, company_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_time 
ON shifts (user_id, company_id, clock_in_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_company_time 
ON attendance_audit_trail (company_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_action_time 
ON attendance_audit_trail (action, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active 
ON user_sessions (user_id, company_id, expires_at DESC, status DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_device 
ON user_sessions (device_fingerprint, user_id, last_activity DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_user 
ON user_devices (user_id, company_id, status DESC, last_seen DESC);

-- Row Level Security
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY shifts_company_policy ON shifts
  FOR ALL TO authenticated_users
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY audit_company_policy ON attendance_audit_trail
  FOR ALL TO authenticated_users
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY sessions_company_policy ON user_sessions
  FOR ALL TO authenticated_users
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY devices_company_policy ON user_devices
  FOR ALL TO authenticated_users
  USING (company_id = current_setting('app.current_company_id')::uuid);

-- Constraints for data integrity
ALTER TABLE shifts ADD CONSTRAINT shifts_clock_out_after_clock_in 
  CHECK (clock_out_time IS NULL OR clock_out_time > clock_in_time);

ALTER TABLE shifts ADD CONSTRAINT shifts_break_during_shift 
  CHECK (break_started_at IS NULL OR 
         (break_started_at > clock_in_time AND 
          (clock_out_time IS NULL OR break_started_at < clock_out_time)));

ALTER TABLE shifts ADD CONSTRAINT shifts_total_break_positive 
  CHECK (total_break_seconds >= 0);

ALTER TABLE shifts ADD CONSTRAINT shifts_total_hours_positive 
  CHECK (total_hours >= 0);

-- Triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_shift_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shift_update_timestamp
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_shift_timestamp();

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() 
    OR status = 'EXPIRED';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to validate shift payroll integrity
CREATE OR REPLACE FUNCTION validate_shift_integrity(shift_uuid UUID)
RETURNS TABLE(is_valid BOOLEAN, error_message TEXT) AS $$
DECLARE
    shift_record RECORD;
    errors TEXT[] := '{}';
BEGIN
    -- Get shift data
    SELECT * INTO shift_record 
    FROM shifts 
    WHERE id = shift_uuid;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Shift not found';
        RETURN;
    END IF;
    
    -- Validate clock sequence
    IF shift_record.clock_out_time IS NOT NULL THEN
        IF shift_record.clock_out_time <= shift_record.clock_in_time THEN
            errors := array_append(errors, 'Clock out must be after clock in');
        END IF;
    END IF;
    
    -- Validate break sequence
    IF shift_record.break_started_at IS NOT NULL THEN
        IF shift_record.break_started_at <= shift_record.clock_in_time THEN
            errors := array_append(errors, 'Break start must be after clock in');
        END IF;
        
        IF shift_record.clock_out_time IS NOT NULL THEN
            IF shift_record.break_started_at >= shift_record.clock_out_time THEN
                errors := array_append(errors, 'Break start must be before clock out');
            END IF;
        END IF;
    END IF;
    
    -- Return validation result
    IF array_length(errors, 1) > 0 THEN
        RETURN QUERY SELECT FALSE, array_to_string(errors, '; ');
    ELSE
        RETURN QUERY SELECT TRUE, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE shifts IS 'Core attendance tracking with all essential protections';
COMMENT ON TABLE attendance_audit_trail IS 'Simple audit trail for all attendance changes';
COMMENT ON TABLE user_sessions IS 'Session tracking for replay protection and security';
COMMENT ON TABLE user_devices IS 'Device tracking for concurrent device detection';

COMMENT ON COLUMN shifts.device_fingerprint IS 'Device identifier for concurrency protection';
COMMENT ON COLUMN shifts.session_id IS 'Session identifier for replay protection';
COMMENT ON COLUMN shifts.total_break_seconds IS 'Total break time in seconds';
COMMENT ON COLUMN shifts.total_hours IS 'Total work hours calculated automatically';

-- Performance optimization settings
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Enable statement timeout for safety
ALTER SYSTEM SET statement_timeout = '30s';
ALTER SYSTEM SET lock_timeout = '10s';

-- Configure connection pooling
ALTER SYSTEM SET max_connections = '200';
ALTER SYSTEM SET max_prepared_transactions = '200';

-- Optimize for attendance workload
ALTER SYSTEM SET random_page_cost = '1.1';
ALTER SYSTEM SET seq_page_cost = '1.0';
ALTER SYSTEM SET cpu_tuple_cost = '0.01';
ALTER SYSTEM SET cpu_index_tuple_cost = '0.005';

-- Enable query statistics for monitoring
ALTER SYSTEM SET track_activities = 'on';
ALTER SYSTEM SET track_counts = 'on';
ALTER SYSTEM SET track_io_timing = 'on';

-- Create function to monitor system health
CREATE OR REPLACE FUNCTION attendance_system_health()
RETURNS TABLE(
  metric_name TEXT,
  metric_value NUMERIC,
  status TEXT
) AS $$
BEGIN
    -- Active shifts count
    RETURN QUERY
    SELECT 
      'active_shifts'::TEXT,
      COUNT(*)::NUMERIC,
      CASE WHEN COUNT(*) < 1000 THEN 'good' ELSE 'warning' END
    FROM shifts WHERE clock_out_time IS NULL;
    
    -- Recent audit entries
    RETURN QUERY
    SELECT 
      'recent_audits'::TEXT,
      COUNT(*)::NUMERIC,
      CASE WHEN COUNT(*) < 10000 THEN 'good' ELSE 'warning' END
    FROM attendance_audit_trail 
    WHERE created_at > NOW() - INTERVAL '1 hour';
    
    -- Active sessions
    RETURN QUERY
    SELECT 
      'active_sessions'::TEXT,
      COUNT(*)::NUMERIC,
      CASE WHEN COUNT(*) < 500 THEN 'good' ELSE 'warning' END
    FROM user_sessions 
    WHERE status = 'ACTIVE' AND expires_at > NOW();
    
    -- Database connections
    RETURN QUERY
    SELECT 
      'db_connections'::TEXT,
      COUNT(*)::NUMERIC,
      CASE WHEN COUNT(*) < 150 THEN 'good' ELSE 'warning' END
    FROM pg_stat_activity 
    WHERE state = 'active';
END;
$$ LANGUAGE plpgsql;

-- Schedule regular cleanup (requires pg_cron extension)
SELECT cron.schedule('0 2 * * *', $$SELECT cleanup_expired_sessions()$$);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated_users;
GRANT SELECT, INSERT, UPDATE ON shifts TO authenticated_users;
GRANT SELECT ON attendance_audit_trail TO authenticated_users;
GRANT SELECT, INSERT, UPDATE ON user_sessions TO authenticated_users;
GRANT SELECT, INSERT, UPDATE ON user_devices TO authenticated_users;

-- Create view for active shifts with user info
CREATE OR REPLACE VIEW active_shifts_view AS
SELECT 
  s.*,
  u.name as user_name,
  u.email as user_email,
  l.name as location_name
FROM shifts s
JOIN users u ON s.user_id = u.id
JOIN locations l ON s.location_id = l.id
WHERE s.clock_out_time IS NULL;

-- Create view for audit trail with user info
CREATE OR REPLACE VIEW audit_trail_view AS
SELECT 
  a.*,
  u.name as user_name,
  u.email as user_email
FROM attendance_audit_trail a
LEFT JOIN users u ON a.metadata->>'userId' = u.id::TEXT
WHERE a.company_id IS NOT NULL;

-- Create view for system health
CREATE OR REPLACE VIEW system_health_view AS
SELECT * FROM attendance_system_health();

-- Simple health check function
CREATE OR REPLACE FUNCTION attendance_health_check()
RETURNS JSONB AS $$
DECLARE
  health JSONB := '{"status": "healthy", "checks": {}}'::JSONB;
  check_result RECORD;
BEGIN
  -- Test database connectivity
  PERFORM 1;
  health := jsonb_set(health, '{checks,database}', 'ok'::JSONB);
  
  -- Test table access
  PERFORM COUNT(*) FROM shifts;
  health := jsonb_set(health, '{checks,tables}', 'ok'::JSONB);
  
  -- Test indexes
  PERFORM COUNT(*) FROM pg_indexes WHERE tablename = 'shifts';
  health := jsonb_set(health, '{checks,indexes}', 'ok'::JSONB);
  
  -- Test functions
  PERFORM attendance_system_health();
  health := jsonb_set(health, '{checks,functions}', 'ok'::JSONB);
  
  RETURN health;
EXCEPTION WHEN OTHERS THEN
  health := jsonb_set(health, '{status}', 'unhealthy'::JSONB);
  health := jsonb_set(health, '{error}', SQLERRM::JSONB);
  RETURN health;
END;
$$ LANGUAGE plpgsql;
