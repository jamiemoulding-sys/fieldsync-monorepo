-- Minimal Attendance Schema
-- Database-first integrity enforcement with maximum simplicity

-- Core attendance table with database constraints
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
  
  -- Device tracking for basic concurrency protection
  device_fingerprint VARCHAR(255),
  session_id VARCHAR(255),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Database constraints enforce attendance integrity
ALTER TABLE shifts ADD CONSTRAINT shifts_unique_active 
  UNIQUE (user_id, company_id, clock_out_time) 
  DEFERRABLE INITIALLY DEFERRED;

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

-- Essential indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_active 
ON shifts (user_id, company_id, clock_out_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_break 
ON shifts (user_id, company_id, break_started_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_device 
ON shifts (device_fingerprint, user_id, company_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_time 
ON shifts (clock_in_time DESC);

-- Row Level Security
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY shifts_company_policy ON shifts
  FOR ALL TO authenticated_users
  USING (company_id = current_setting('app.current_company_id')::uuid);

-- Database function for payroll integrity validation
CREATE OR REPLACE FUNCTION validate_shift_payroll_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate total hours calculation
  IF NEW.clock_out_time IS NOT NULL THEN
    -- Calculate expected total hours
    DECLARE
      expected_hours NUMERIC;
      actual_hours NUMERIC;
    BEGIN
      expected_hours := EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 3600;
      IF NEW.total_break_seconds > 0 THEN
        expected_hours := expected_hours - (NEW.total_break_seconds / 3600);
      END IF;
      actual_hours := NEW.total_hours;
      
      -- Allow 1 minute tolerance for rounding
      IF ABS(expected_hours - actual_hours) > 0.02 THEN
        RAISE EXCEPTION 'Total hours calculation mismatch: expected %, got %', 
          expected_hours, actual_hours;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic payroll validation
CREATE TRIGGER validate_payroll_integrity
  BEFORE UPDATE OR INSERT ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION validate_shift_payroll_integrity();

-- Database function for break duration calculation
CREATE OR REPLACE FUNCTION calculate_break_duration()
RETURNS TRIGGER AS $$
BEGIN
  -- When ending a break, calculate duration
  IF OLD.break_started_at IS NOT NULL AND NEW.break_started_at IS NULL THEN
    NEW.total_break_seconds := COALESCE(OLD.total_break_seconds, 0) + 
      EXTRACT(EPOCH FROM (NOW() - OLD.break_started_at));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic break duration calculation
CREATE TRIGGER calculate_break_duration_trigger
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_break_duration();

-- Database function for total hours calculation
CREATE OR REPLACE FUNCTION calculate_total_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- When clocking out, calculate total hours
  IF OLD.clock_out_time IS NULL AND NEW.clock_out_time IS NOT NULL THEN
    NEW.total_hours := EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 3600;
    IF NEW.total_break_seconds > 0 THEN
      NEW.total_hours := NEW.total_hours - (NEW.total_break_seconds / 3600);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic total hours calculation
CREATE TRIGGER calculate_total_hours_trigger
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_hours();

-- Simple health check function
CREATE OR REPLACE FUNCTION attendance_health_check()
RETURNS JSONB AS $$
DECLARE
  health JSONB := '{"status": "healthy", "checks": {}}'::JSONB;
  active_shifts INTEGER;
  recent_shifts INTEGER;
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
  
  -- Check if any constraints violated
  BEGIN
    PERFORM 1 FROM shifts WHERE NOT (
      (clock_out_time IS NULL OR clock_out_time > clock_in_time) AND
      (break_started_at IS NULL OR 
       (break_started_at > clock_in_time AND 
        (clock_out_time IS NULL OR break_started_at < clock_out_time))) AND
      (total_break_seconds >= 0) AND
      (total_hours >= 0)
    );
    health := jsonb_set(health, '{checks,constraints}', 'ok'::JSONB);
  EXCEPTION WHEN OTHERS THEN
    health := jsonb_set(health, '{checks,constraints}', 'violated'::JSONB);
  END;
  
  RETURN health;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'status', 'unhealthy',
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql;

-- Performance optimization
ALTER SYSTEM SET shared_buffers = '128MB';
ALTER SYSTEM SET work_mem = '8MB';
ALTER SYSTEM SET maintenance_work_mem = '32MB';
ALTER SYSTEM SET statement_timeout = '30s';
ALTER SYSTEM SET lock_timeout = '10s';

-- Enable query statistics for monitoring
ALTER SYSTEM SET track_activities = 'on';
ALTER SYSTEM SET track_counts = 'on';

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated_users;
GRANT SELECT, INSERT, UPDATE ON shifts TO authenticated_users;

-- Comments
COMMENT ON TABLE shifts IS 'Core attendance table with database-first integrity enforcement';
COMMENT ON CONSTRAINT shifts_unique_active ON shifts IS 'Prevents duplicate active shifts per user';
COMMENT ON CONSTRAINT shifts_clock_out_after_clock_in ON shifts IS 'Ensures clock out is after clock in';
COMMENT ON CONSTRAINT shifts_break_during_shift ON shifts IS 'Ensures break is during shift hours';
COMMENT ON CONSTRAINT shifts_break_not_during_clock_out ON shifts IS 'Prevents break when clocked out';

COMMENT ON FUNCTION validate_shift_payroll_integrity() IS 'Automatic payroll integrity validation';
COMMENT ON FUNCTION calculate_break_duration() IS 'Automatic break duration calculation';
COMMENT ON FUNCTION calculate_total_hours() IS 'Automatic total hours calculation';
COMMENT ON FUNCTION attendance_health_check() IS 'Simple health check for monitoring';
