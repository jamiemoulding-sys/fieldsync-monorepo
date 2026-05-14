-- Production-Safe Schema
-- Minimal, correct, and operationally reliable attendance system

-- Add critical constraints for production safety
ALTER TABLE shifts ADD CONSTRAINT shifts_unique_active 
  UNIQUE (user_id, company_id, clock_out_time) 
  NOT DEFERRABLE;

-- Add GPS coordinate validation
ALTER TABLE shifts ADD CONSTRAINT shifts_lat_range 
CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

ALTER TABLE shifts ADD CONSTRAINT shifts_lng_range 
CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

-- Add shift duration limits
ALTER TABLE shifts ADD CONSTRAINT shifts_max_work_hours 
CHECK (total_hours IS NULL OR total_hours <= 24);

ALTER TABLE shifts ADD CONSTRAINT shifts_max_break_seconds 
CHECK (total_break_seconds IS NULL OR (total_break_seconds <= 14400); -- 4 hours max

-- Add time sequence validation
ALTER TABLE shifts ADD CONSTRAINT shifts_time_sequence 
CHECK (
  clock_out_time IS NULL OR 
  clock_out_time > clock_in_time
);

-- Add break time sequence validation
ALTER TABLE shifts ADD CONSTRAINT shifts_break_sequence 
CHECK (
  break_started_at IS NULL OR 
  (break_started_at > clock_in_time AND 
   (clock_out_time IS NULL OR break_started_at < clock_out_time))
);

-- Add device fingerprint constraint
ALTER TABLE shifts ADD CONSTRAINT shifts_device_fingerprint_format 
CHECK (device_fingerprint IS NULL OR LENGTH(TRIM(device_fingerprint)) >= 32);

-- Add session ID constraint
ALTER TABLE shifts ADD CONSTRAINT shifts_session_id_format 
CHECK (session_id IS NULL OR LENGTH(TRIM(session_id)) >= 32);

-- Create audit log table
CREATE TABLE IF NOT EXISTS attendance_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL, -- 'clock_in', 'clock_out', 'break_start', 'break_end'
  old_data JSONB,
  new_data JSONB,
  device_fingerprint VARCHAR(64),
  session_id VARCHAR(36),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Foreign key constraints
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Add indexes for audit log
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_audit_log_shift_id 
ON attendance_audit_log(shift_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_audit_log_user_id 
ON attendance_audit_log(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_audit_log_company_id 
ON attendance_audit_log(company_id, created_at DESC);

-- Create device session table
CREATE TABLE IF NOT EXISTS device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  device_fingerprint VARCHAR(64) NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '12 hours'),
  is_active BOOLEAN DEFAULT TRUE,
  -- Foreign key constraints
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  -- Unique constraint for active sessions
  UNIQUE(user_id, device_fingerprint, is_active)
);

-- Add indexes for device sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_device_sessions_user_device 
ON device_sessions(user_id, device_fingerprint, is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_device_sessions_expires_at 
ON device_sessions(expires_at);

-- Create replay protection table
CREATE TABLE IF NOT EXISTS replay_protection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL,
  replay_key VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '5 minutes'),
  -- Foreign key constraints
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  -- Unique constraint for replay protection
  UNIQUE(replay_key)
);

-- Add indexes for replay protection
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_replay_protection_replay_key 
ON replay_protection(replay_key);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_replay_protection_expires_at 
ON replay_protection(expires_at);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_attendance_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log all shift changes
  INSERT INTO attendance_audit_log (
    shift_id, user_id, company_id, action, old_data, new_data,
    device_fingerprint, session_id, ip_address, user_agent
  ) VALUES (
    NEW.id, NEW.user_id, NEW.company_id,
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'clock_in'
      WHEN NEW.clock_out_time IS NOT NULL AND OLD.clock_out_time IS NULL THEN 'clock_out'
      WHEN NEW.break_started_at IS NOT NULL AND OLD.break_started_at IS NULL THEN 'break_start'
      WHEN NEW.break_started_at IS NULL AND OLD.break_started_at IS NOT NULL THEN 'break_end'
      ELSE TG_OP
    END,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE row_to_json(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW) END,
    NEW.device_fingerprint, NEW.session_id,
    inet_client_addr(), current_setting('request_headers')
  );
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the operation
  INSERT INTO attendance_audit_log (
    shift_id, user_id, company_id, action, old_data, new_data,
    device_fingerprint, session_id, ip_address, user_agent
  ) VALUES (
    COALESCE(NEW.id, OLD.id), COALESCE(NEW.user_id, OLD.user_id), COALESCE(NEW.company_id, OLD.company_id),
    TG_OP, 
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE row_to_json(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW) END,
    COALESCE(NEW.device_fingerprint, OLD.device_fingerprint), COALESCE(NEW.session_id, OLD.session_id),
    inet_client_addr(), current_setting('request_headers')
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for attendance audit logging
DROP TRIGGER IF EXISTS audit_attendance_trigger ON shifts;
CREATE TRIGGER audit_attendance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION audit_attendance_changes();

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Deactivate expired sessions
    UPDATE device_sessions
    SET is_active = FALSE
    WHERE expires_at < NOW() AND is_active = TRUE;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up expired replay protection
CREATE OR REPLACE FUNCTION cleanup_replay_protection()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM replay_protection
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate shift data integrity
CREATE OR REPLACE FUNCTION validate_shift_integrity(p_shift_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_shift RECORD;
    v_issues JSONB := '[]'::jsonb;
    v_valid BOOLEAN := TRUE;
BEGIN
    -- Get shift data
    SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', FALSE, 'error', 'Shift not found');
    END IF;
    
    -- Validate time sequence
    IF v_shift.clock_out_time IS NOT NULL AND v_shift.clock_out_time <= v_shift.clock_in_time THEN
        v_issues := v_issues || jsonb_build_object(
            'type', 'invalid_time_sequence',
            'description', 'clock_out_time must be after clock_in_time'
        );
        v_valid := FALSE;
    END IF;
    
    -- Validate break sequence
    IF v_shift.break_started_at IS NOT NULL THEN
        IF v_shift.break_started_at <= v_shift.clock_in_time THEN
            v_issues := v_issues || jsonb_build_object(
                'type', 'invalid_break_sequence',
                'description', 'break_started_at must be after clock_in_time'
            );
            v_valid := FALSE;
        END IF;
        
        IF v_shift.clock_out_time IS NOT NULL AND v_shift.break_started_at >= v_shift.clock_out_time THEN
            v_issues := v_issues || jsonb_build_object(
                'type', 'invalid_break_sequence',
                'description', 'break_started_at must be before clock_out_time'
            );
            v_valid := FALSE;
        END IF;
    END IF;
    
    -- Validate hours
    IF v_shift.total_hours < 0 OR v_shift.total_hours > 24 THEN
        v_issues := v_issues || jsonb_build_object(
            'type', 'invalid_hours',
            'description', 'total_hours must be between 0 and 24'
        );
        v_valid := FALSE;
    END IF;
    
    -- Validate break seconds
    IF v_shift.total_break_seconds < 0 OR v_shift.total_break_seconds > 14400 THEN
        v_issues := v_issues || jsonb_build_object(
            'type', 'invalid_break_seconds',
            'description', 'total_break_seconds must be between 0 and 14400'
        );
        v_valid := FALSE;
    END IF;
    
    -- Validate coordinates
    IF v_shift.latitude IS NOT NULL AND (v_shift.latitude < -90 OR v_shift.latitude > 90) THEN
        v_issues := v_issues || jsonb_build_object(
            'type', 'invalid_latitude',
            'description', 'latitude must be between -90 and 90'
        );
        v_valid := FALSE;
    END IF;
    
    IF v_shift.longitude IS NOT NULL AND (v_shift.longitude < -180 OR v_shift.longitude > 180) THEN
        v_issues := v_issues || jsonb_build_object(
            'type', 'invalid_longitude',
            'description', 'longitude must be between -180 and 180'
        );
        v_valid := FALSE;
    END IF;
    
    RETURN jsonb_build_object(
        'valid', v_valid,
        'issues', v_issues,
        'validated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to get system health
CREATE OR REPLACE FUNCTION get_system_health(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_health JSONB;
    v_active_shifts INTEGER;
    v_stale_shifts INTEGER;
    v_orphaned_sessions INTEGER;
    v_replay_entries INTEGER;
BEGIN
    -- Count active shifts
    SELECT COUNT(*) INTO v_active_shifts
    FROM shifts
    WHERE company_id = p_company_id AND clock_out_time IS NULL;
    
    -- Count stale shifts (older than 24 hours)
    SELECT COUNT(*) INTO v_stale_shifts
    FROM shifts
    WHERE company_id = p_company_id AND clock_out_time IS NULL 
    AND clock_in_time < NOW() - INTERVAL '24 hours';
    
    -- Count orphaned sessions
    SELECT COUNT(*) INTO v_orphaned_sessions
    FROM device_sessions
    WHERE company_id = p_company_id AND expires_at < NOW() AND is_active = TRUE;
    
    -- Count replay protection entries
    SELECT COUNT(*) INTO v_replay_entries
    FROM replay_protection
    WHERE company_id = p_company_id AND expires_at > NOW();
    
    -- Build health report
    v_health := jsonb_build_object(
        'status', CASE 
            WHEN v_stale_shifts > 0 OR v_orphaned_sessions > 0 THEN 'warning'
            ELSE 'healthy'
        END,
        'active_shifts', v_active_shifts,
        'stale_shifts', v_stale_shifts,
        'orphaned_sessions', v_orphaned_sessions,
        'replay_entries', v_replay_entries,
        'checked_at', NOW()
    );
    
    RETURN v_health;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_audit_log TO authenticated_users;
GRANT SELECT, INSERT, UPDATE, DELETE ON device_sessions TO authenticated_users;
GRANT SELECT, INSERT, UPDATE, DELETE ON replay_protection TO authenticated_users;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO authenticated_users;
GRANT EXECUTE ON FUNCTION cleanup_replay_protection() TO authenticated_users;
GRANT EXECUTE ON FUNCTION validate_shift_integrity(UUID) TO authenticated_users;
GRANT EXECUTE ON FUNCTION get_system_health(UUID) TO authenticated_users;
GRANT EXECUTE ON FUNCTION audit_attendance_changes() TO authenticated_users;

-- Comments
COMMENT ON TABLE attendance_audit_log IS 'Audit trail for all attendance changes';
COMMENT ON TABLE device_sessions IS 'Device session tracking for security';
COMMENT ON TABLE replay_protection IS 'Replay attack protection';
COMMENT ON FUNCTION audit_attendance_changes() IS 'Trigger function to log all attendance changes';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Clean up expired device sessions';
COMMENT ON FUNCTION cleanup_replay_protection() IS 'Clean up expired replay protection entries';
COMMENT ON FUNCTION validate_shift_integrity(UUID) IS 'Validate shift data integrity';
COMMENT ON FUNCTION get_system_health(UUID) IS 'Get system health status';

-- Schedule cleanup jobs (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-sessions', '*/5 * * * *', 'SELECT cleanup_expired_sessions();');
-- SELECT cron.schedule('cleanup-replay', '*/1 * * * *', 'SELECT cleanup_replay_protection();');
