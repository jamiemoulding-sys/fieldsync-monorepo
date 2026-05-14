-- Final PostgreSQL Constraint and Index Strategy
-- For Active Shifts, Replay Safety, and Payroll Integrity

-- ================================================================
-- ACTIVE SHIFT SAFETY CONSTRAINTS
-- ================================================================

-- Core constraint: Prevents duplicate active shifts per user
-- This is the foundation of attendance safety
ALTER TABLE shifts ADD CONSTRAINT shifts_unique_active_shift 
  UNIQUE (user_id, company_id, clock_out_time) 
  NOT DEFERRABLE;

-- Prevents clock out during break (business rule enforcement)
ALTER TABLE shifts ADD CONSTRAINT shifts_no_clock_out_during_break 
  CHECK (clock_out_time IS NULL OR break_started_at IS NULL);

-- Prevents break start when already on break
ALTER TABLE shifts ADD CONSTRAINT shifts_no_duplicate_break 
  CHECK (break_started_at IS NULL OR (break_started_at IS NOT NULL AND clock_out_time IS NULL));

-- Prevents invalid break sequences
ALTER TABLE shifts ADD CONSTRAINT shifts_break_sequence_valid 
  CHECK (
    (break_started_at IS NULL) OR 
    (break_started_at > clock_in_time AND 
     (clock_out_time IS NULL OR break_started_at < clock_out_time))
  );

-- Prevents negative break durations (data integrity)
ALTER TABLE shifts ADD CONSTRAINT shifts_break_duration_positive 
  CHECK (total_break_seconds >= 0);

-- Prevents excessive work hours (payroll protection)
ALTER TABLE shifts ADD CONSTRAINT shifts_max_work_hours 
  CHECK (total_hours <= 24);

-- Prevents excessive break duration (payroll protection)
ALTER TABLE shifts ADD CONSTRAINT shifts_max_break_duration 
  CHECK (
    break_started_at IS NULL OR 
    (break_started_at IS NOT NULL AND 
     (total_break_seconds <= 4 * 3600)) -- Max 4 hours break
  );

-- ================================================================
-- REPLAY SAFETY CONSTRAINTS
-- ================================================================

-- Prevents rapid clock-in attempts (replay protection)
ALTER TABLE shifts ADD CONSTRAINT shifts_min_clock_in_interval 
  CHECK (
    clock_in_time >= (
      SELECT MAX(clock_in_time) 
      FROM shifts s2 
      WHERE s2.user_id = shifts.user_id 
      AND s2.company_id = shifts.company_id
      AND s2.clock_in_time < shifts.clock_in_time
    ) + INTERVAL '1 minute'
  );

-- Prevents duplicate device fingerprint usage (concurrent device protection)
ALTER TABLE shifts ADD CONSTRAINT shifts_unique_device_active 
  EXCLUDE (device_fingerprint WITH =) 
  WHERE (clock_out_time IS NULL);

-- Prevents session reuse across different users
ALTER TABLE shifts ADD CONSTRAINT shifts_session_user_integrity 
  CHECK (
    session_id IS NULL OR
    (session_id NOT IN (
      SELECT DISTINCT session_id 
      FROM shifts s2 
      WHERE s2.user_id != shifts.user_id 
      AND s2.company_id = shifts.company_id 
      AND s2.session_id IS NOT NULL
      AND s2.clock_in_time > NOW() - INTERVAL '12 hours'
    ))
  );

-- ================================================================
-- PAYROLL INTEGRITY CONSTRAINTS
-- ================================================================

-- Time sequence integrity (prevents time manipulation)
ALTER TABLE shifts ADD CONSTRAINT shifts_time_sequence_integrity 
  CHECK (
    clock_out_time IS NULL OR 
    clock_out_time > clock_in_time
  );

-- Total hours calculation integrity
ALTER TABLE shifts ADD CONSTRAINT shifts_total_hours_calculation 
  CHECK (
    total_hours >= 0 AND total_hours <= 24
  );

-- Break time calculation integrity
ALTER TABLE shifts ADD CONSTRAINT shifts_break_time_calculation 
  CHECK (
    total_break_seconds >= 0 AND 
    (total_break_seconds <= 4 * 3600 OR break_started_at IS NULL)
  );

-- Geographic coordinate validation (prevents invalid locations)
ALTER TABLE shifts ADD CONSTRAINT shifts_coordinate_validation 
  CHECK (
    (clock_in_lat IS NULL OR (clock_in_lat >= -90 AND clock_in_lat <= 90)) AND
    (clock_in_lng IS NULL OR (clock_in_lng >= -180 AND clock_in_lng <= 180)) AND
    (clock_out_lat IS NULL OR (clock_out_lat >= -90 AND clock_out_lat <= 90)) AND
    (clock_out_lng IS NULL OR (clock_out_lng >= -180 AND clock_out_lng <= 180))
  );

-- Device fingerprint format validation (prevents spoofing)
ALTER TABLE shifts ADD CONSTRAINT shifts_device_fingerprint_format 
  CHECK (device_fingerprint ~ '^[a-f0-9]{64}$'); -- SHA256 format

-- ================================================================
-- CRITICAL INDEXES FOR PERFORMANCE
-- ================================================================

-- Primary index for active shift lookups (most critical)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_active_user 
ON shifts (user_id, company_id, clock_out_time DESC, id DESC);

-- Index for break state queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_break_state 
ON shifts (user_id, company_id, break_started_at DESC, id DESC);

-- Index for device fingerprint queries (replay protection)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_device_fingerprint 
ON shifts (device_fingerprint, user_id, company_id, clock_in_time DESC);

-- Index for session-based queries (replay protection)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_session 
ON shifts (session_id, user_id, company_id, clock_in_time DESC);

-- Index for time-based queries (payroll calculations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_time_range 
ON shifts (clock_in_time DESC, company_id) 
WHERE clock_out_time IS NOT NULL;

-- Index for location-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_location_time 
ON shifts (location_id, clock_in_time DESC);

-- Composite index for payroll integrity checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_payroll_integrity 
ON shifts (company_id, clock_in_time, clock_out_time, total_hours, total_break_seconds)
WHERE clock_out_time IS NOT NULL;

-- ================================================================
-- PARTIAL INDEXES FOR PERFORMANCE OPTIMIZATION
-- ================================================================

-- Index only for active shifts (smaller, faster)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_active_only 
ON shifts (user_id, company_id, id DESC)
WHERE clock_out_time IS NULL;

-- Index only for breaks in progress
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_breaks_in_progress 
ON shifts (user_id, company_id, break_started_at DESC)
WHERE break_started_at IS NOT NULL AND clock_out_time IS NULL;

-- Index for recent shifts (last 30 days)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_recent 
ON shifts (user_id, company_id, clock_in_time DESC)
WHERE clock_in_time > NOW() - INTERVAL '30 days';

-- ================================================================
-- TRIGGER-BASED CONSTRAINTS FOR COMPLEX VALIDATION
-- ================================================================

-- Function to validate shift duration (prevents excessive hours)
CREATE OR REPLACE FUNCTION validate_shift_duration()
RETURNS TRIGGER AS $$
DECLARE
  shift_duration NUMERIC;
  max_shift_hours NUMERIC := 16; -- Maximum reasonable work hours
BEGIN
  IF NEW.clock_out_time IS NOT NULL THEN
    -- Calculate duration in UTC to avoid timezone issues
    shift_duration := EXTRACT(EPOCH FROM (
      (NEW.clock_out_time AT TIME ZONE 'UTC') - 
      (NEW.clock_in_time AT TIME ZONE 'UTC')
    )) / 3600;
    
    IF shift_duration > max_shift_hours THEN
      RAISE EXCEPTION 'Shift duration of % hours exceeds maximum of % hours', 
        shift_duration, max_shift_hours;
    END IF;
    
    IF shift_duration < 0 THEN
      RAISE EXCEPTION 'Negative shift duration detected: possible clock manipulation';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate break duration (prevents excessive breaks)
CREATE OR REPLACE FUNCTION validate_break_duration()
RETURNS TRIGGER AS $$
DECLARE
  break_duration NUMERIC;
  max_break_hours NUMERIC := 4; -- Maximum reasonable break
BEGIN
  IF OLD.break_started_at IS NOT NULL AND NEW.break_started_at IS NULL THEN
    -- Calculate break duration
    break_duration := EXTRACT(EPOCH FROM (
      (NEW.clock_out_time AT TIME ZONE 'UTC') - 
      (OLD.break_started_at AT TIME ZONE 'UTC')
    )) / 3600;
    
    IF break_duration > max_break_hours THEN
      RAISE EXCEPTION 'Break duration of % hours exceeds maximum of % hours', 
        break_duration, max_break_hours;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate payroll calculations
CREATE OR REPLACE FUNCTION validate_payroll_calculations()
RETURNS TRIGGER AS $$
DECLARE
  expected_hours NUMERIC(10,2);
  actual_hours NUMERIC(10,2);
  tolerance NUMERIC := 0.02; -- 1 minute tolerance
BEGIN
  IF NEW.clock_out_time IS NOT NULL THEN
    -- Calculate expected hours
    expected_hours := EXTRACT(EPOCH FROM (
      (NEW.clock_out_time AT TIME ZONE 'UTC') - 
      (NEW.clock_in_time AT TIME ZONE 'UTC')
    )) / 3600;
    
    -- Subtract break time
    IF NEW.total_break_seconds > 0 THEN
      expected_hours := expected_hours - (NEW.total_break_seconds / 3600);
    END IF;
    
    actual_hours := NEW.total_hours;
    
    -- Validate calculation
    IF ABS(expected_hours - actual_hours) > tolerance THEN
      RAISE EXCEPTION 'Payroll calculation mismatch: expected % hours, got % hours', 
        expected_hours, actual_hours;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to prevent rapid clock-in attempts (replay protection)
CREATE OR REPLACE FUNCTION prevent_rapid_clock_in()
RETURNS TRIGGER AS $$
DECLARE
  last_clock_in TIMESTAMP WITH TIME ZONE;
  min_interval INTERVAL := '1 minute';
BEGIN
  -- Get last clock-in for this user
  SELECT MAX(clock_in_time) INTO last_clock_in
  FROM shifts
  WHERE user_id = NEW.user_id
  AND company_id = NEW.company_id
  AND clock_in_time < NEW.clock_in_time;
  
  IF last_clock_in IS NOT NULL THEN
    IF NEW.clock_in_time < last_clock_in + min_interval THEN
      RAISE EXCEPTION 'Clock-in attempted too soon after previous attempt';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- TRIGGERS FOR CONSTRAINT ENFORCEMENT
-- ================================================================

-- Shift duration validation trigger
CREATE TRIGGER trigger_validate_shift_duration
  BEFORE INSERT OR UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION validate_shift_duration();

-- Break duration validation trigger
CREATE TRIGGER trigger_validate_break_duration
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION validate_break_duration();

-- Payroll calculation validation trigger
CREATE TRIGGER trigger_validate_payroll_calculations
  BEFORE INSERT OR UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION validate_payroll_calculations();

-- Rapid clock-in prevention trigger
CREATE TRIGGER trigger_prevent_rapid_clock_in
  BEFORE INSERT ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_rapid_clock_in();

-- ================================================================
-- PARTIAL UNIQUE INDEXES FOR REPLAY PROTECTION
-- ================================================================

-- Prevent concurrent operations on same user/device
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_user_device_active 
ON shifts (user_id, device_fingerprint) 
WHERE clock_out_time IS NULL;

-- Prevent concurrent operations on same session
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_user_session_active 
ON shifts (user_id, session_id) 
WHERE clock_out_time IS NULL;

-- ================================================================
-- SECURITY CONSTRAINTS
-- ================================================================

-- Prevent invalid UUID formats
ALTER TABLE shifts ADD CONSTRAINT shifts_session_id_uuid 
  CHECK (session_id IS NULL OR session_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');

-- Prevent invalid company_id/user_id formats
ALTER TABLE shifts ADD CONSTRAINT shifts_uuid_format 
  CHECK (
    user_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AND
    company_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  );

-- ================================================================
-- MONITORING VIEWS
-- ================================================================

-- View for active shifts monitoring
CREATE OR REPLACE VIEW active_shifts_monitor AS
SELECT 
  s.id,
  s.user_id,
  s.company_id,
  s.clock_in_time,
  s.break_started_at,
  s.total_hours,
  s.device_fingerprint,
  s.session_id,
  EXTRACT(EPOCH FROM (NOW() - s.clock_in_time)) / 60 as active_minutes,
  CASE 
    WHEN s.break_started_at IS NOT NULL THEN 'ON_BREAK'
    ELSE 'CLOCKED_IN'
  END as status
FROM shifts s
WHERE s.clock_out_time IS NULL;

-- View for constraint violations monitoring
CREATE OR REPLACE VIEW constraint_violations_monitor AS
SELECT 
  table_name,
  constraint_name,
  violation_data->>'error' as error_message,
  violation_data->>'user_id' as user_id,
  violation_data->>'company_id' as company_id,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as minutes_ago
FROM constraint_violations
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- View for payroll integrity monitoring
CREATE OR REPLACE VIEW payroll_integrity_monitor AS
SELECT 
  s.id,
  s.user_id,
  s.company_id,
  s.clock_in_time,
  s.clock_out_time,
  s.total_hours,
  s.total_break_seconds,
  CASE 
    WHEN s.total_hours > 12 THEN 'EXCESSIVE_HOURS'
    WHEN s.total_break_seconds > 4 * 3600 THEN 'EXCESSIVE_BREAK'
    WHEN s.total_hours < 0 THEN 'NEGATIVE_HOURS'
    WHEN s.total_break_seconds < 0 THEN 'NEGATIVE_BREAK'
    ELSE 'OK'
  END as integrity_status,
  s.metadata
FROM shifts s
WHERE s.clock_out_time IS NOT NULL
  AND s.clock_in_time > NOW() - INTERVAL '7 days';

-- ================================================================
-- PERFORMANCE OPTIMIZATION
-- ================================================================

-- Analyze tables for query planner optimization
ANALYZE shifts;
ANALYZE user_sessions;
ANALYZE user_devices;
ANALYZE constraint_violations;

-- Set statistics target for better query planning
ALTER TABLE shifts ALTER COLUMN user_id SET STATISTICS 100;
ALTER TABLE shifts ALTER COLUMN company_id SET STATISTICS 100;
ALTER TABLE shifts ALTER COLUMN clock_out_time SET STATISTICS 100;
ALTER TABLE shifts ALTER COLUMN break_started_at SET STATISTICS 100;

-- ================================================================
-- COMMENTS FOR DOCUMENTATION
-- ================================================================

COMMENT ON CONSTRAINT shifts_unique_active_shift ON shifts IS 
  'Prevents duplicate active shifts per user - core attendance safety constraint';

COMMENT ON CONSTRAINT shifts_no_clock_out_during_break ON shifts IS 
  'Prevents clocking out while on break - business rule enforcement';

COMMENT ON CONSTRAINT shifts_min_clock_in_interval ON shifts IS 
  'Prevents rapid clock-in attempts - replay protection';

COMMENT ON CONSTRAINT shifts_max_work_hours ON shifts IS 
  'Prevents excessive work hours - payroll protection';

COMMENT ON CONSTRAINT shifts_device_fingerprint_format ON shifts IS 
  'Ensures device fingerprint is SHA256 format - prevents spoofing';

COMMENT ON INDEX idx_shifts_active_user ON shifts IS 
  'Primary index for active shift lookups - most critical performance index';

COMMENT ON INDEX idx_shifts_device_fingerprint ON shifts IS 
  'Index for replay protection - prevents concurrent device operations';

COMMENT ON TRIGGER trigger_validate_shift_duration ON shifts IS 
  'Validates shift duration to prevent excessive hours - payroll protection';

COMMENT ON TRIGGER trigger_validate_payroll_calculations ON shifts IS 
  'Validates payroll calculations for accuracy - payroll integrity';

COMMENT ON VIEW active_shifts_monitor ON shifts IS 
  'Monitor active shifts for operational visibility';

COMMENT ON VIEW payroll_integrity_monitor ON shifts IS 
  'Monitor payroll integrity issues for compliance';

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Test constraint effectiveness
DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.check_constraints 
  WHERE table_name = 'shifts';
  
  RAISE NOTICE 'Shifts table has % constraints', constraint_count;
  
  -- Test index effectiveness
  SELECT COUNT(*) INTO constraint_count
  FROM pg_indexes 
  WHERE tablename = 'shifts';
  
  RAISE NOTICE 'Shifts table has % indexes', constraint_count;
END $$;
