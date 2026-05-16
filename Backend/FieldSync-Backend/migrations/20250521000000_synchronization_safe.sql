-- Production-Safe Synchronization Schema
-- Adds constraints, triggers, and views for synchronization consistency

-- Add audit log table for tracking all shift changes
CREATE TABLE IF NOT EXISTS shift_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  -- Foreign key constraints
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Add indexes for audit log
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_audit_log_shift_id 
ON shift_audit_log(shift_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_audit_log_user_id 
ON shift_audit_log(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_audit_log_company_id 
ON shift_audit_log(company_id, created_at DESC);

-- Add system stats table for caching
CREATE TABLE IF NOT EXISTS system_stats_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  stat_type VARCHAR(50) NOT NULL,
  stat_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '5 minutes'),
  -- Foreign key constraint
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  -- Unique constraint for stat type per company
  UNIQUE(company_id, stat_type)
);

-- Add indexes for system stats cache
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_stats_cache_company_type 
ON system_stats_cache(company_id, stat_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_stats_cache_expires_at 
ON system_stats_cache(expires_at);

-- Add trigger for shift audit logging
CREATE OR REPLACE FUNCTION audit_shift_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log all shift changes
  INSERT INTO shift_audit_log (
    shift_id, user_id, company_id, action, old_data, new_data, created_by
  ) VALUES (
    NEW.id, NEW.user_id, NEW.company_id, TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE row_to_json(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW) END,
    COALESCE(NEW.created_by, OLD.created_by)
  );
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the operation
  INSERT INTO shift_audit_log (
    shift_id, user_id, company_id, action, old_data, new_data, created_by
  ) VALUES (
    COALESCE(NEW.id, OLD.id), COALESCE(NEW.user_id, OLD.user_id), COALESCE(NEW.company_id, OLD.company_id),
    TG_OP, 
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE row_to_json(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW) END,
    COALESCE(NEW.created_by, OLD.created_by)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for shift audit logging
DROP TRIGGER IF EXISTS audit_shift_trigger ON shifts;
CREATE TRIGGER audit_shift_trigger
  AFTER INSERT OR UPDATE OR DELETE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION audit_shift_changes();

-- Add materialized view for active shifts summary
DROP MATERIALIZED VIEW IF EXISTS active_shifts_summary;
CREATE MATERIALIZED VIEW active_shifts_summary AS
SELECT 
  s.id,
  s.user_id,
  s.company_id,
  s.location_id,
  s.clock_in_time,
  s.total_hours,
  s.break_started_at,
  s.total_break_seconds,
  s.latitude,
  s.longitude,
  s.device_fingerprint,
  s.session_id,
  s.metadata,
  u.name as user_name,
  u.email as user_email,
  u.hourly_rate,
  l.name as location_name,
  l.lat as location_lat,
  l.lng as location_lng,
  l.radius as location_radius,
  EXTRACT(EPOCH FROM (NOW() - s.clock_in_time)) / 60 as active_minutes,
  CASE 
    WHEN s.break_started_at IS NOT NULL THEN 'ON_BREAK'
    ELSE 'CLOCKED_IN'
  END as status
FROM shifts s
JOIN users u ON s.user_id = u.id
JOIN locations l ON s.location_id = l.id
WHERE s.clock_out_time IS NULL;

-- Add unique index for materialized view
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_active_shifts_summary_id 
ON active_shifts_summary(id);

-- Add indexes for materialized view
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_shifts_summary_company 
ON active_shifts_summary(company_id, clock_in_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_shifts_summary_user 
ON active_shifts_summary(user_id, clock_in_time DESC);

-- Add function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_active_shifts_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY active_shifts_summary;
END;
$$ LANGUAGE plpgsql;

-- Add function to update system stats cache
CREATE OR REPLACE FUNCTION update_system_stats_cache(p_company_id UUID)
RETURNS void AS $$
DECLARE
    v_active_shifts INTEGER;
    v_recent_shifts INTEGER;
    v_total_shifts INTEGER;
    v_avg_hours NUMERIC;
    v_total_users INTEGER;
    v_total_locations INTEGER;
BEGIN
    -- Calculate stats
    SELECT COUNT(*) INTO v_active_shifts
    FROM shifts
    WHERE company_id = p_company_id AND clock_out_time IS NULL;
    
    SELECT COUNT(*) INTO v_recent_shifts
    FROM shifts
    WHERE company_id = p_company_id AND clock_in_time > NOW() - INTERVAL '24 hours';
    
    SELECT COUNT(*) INTO v_total_shifts
    FROM shifts
    WHERE company_id = p_company_id;
    
    SELECT COALESCE(AVG(total_hours), 0) INTO v_avg_hours
    FROM shifts
    WHERE company_id = p_company_id AND clock_out_time IS NOT NULL 
    AND clock_in_time > NOW() - INTERVAL '7 days';
    
    SELECT COUNT(*) INTO v_total_users
    FROM users
    WHERE company_id = p_company_id;
    
    SELECT COUNT(*) INTO v_total_locations
    FROM locations
    WHERE company_id = p_company_id;
    
    -- Update cache
    INSERT INTO system_stats_cache (company_id, stat_type, stat_data, expires_at)
    VALUES (
      p_company_id, 
      'system_stats',
      jsonb_build_object(
        'active_shifts', v_active_shifts,
        'recent_shifts', v_recent_shifts,
        'total_shifts', v_total_shifts,
        'avg_hours', ROUND(v_avg_hours, 2),
        'total_users', v_total_users,
        'total_locations', v_total_locations,
        'calculated_at', NOW()
      ),
      NOW() + INTERVAL '5 minutes'
    )
    ON CONFLICT (company_id, stat_type) 
    DO UPDATE SET 
      stat_data = EXCLUDED.stat_data,
      expires_at = EXCLUDED.expires_at;
END;
$$ LANGUAGE plpgsql;

-- Add function to get system stats from cache
CREATE OR REPLACE FUNCTION get_system_stats(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_cached_stats JSONB;
    v_is_expired BOOLEAN;
BEGIN
    -- Check cache
    SELECT stat_data, (expires_at < NOW()) INTO v_cached_stats, v_is_expired
    FROM system_stats_cache
    WHERE company_id = p_company_id AND stat_type = 'system_stats';
    
    -- If cache is expired or doesn't exist, refresh it
    IF v_cached_stats IS NULL OR v_is_expired THEN
        PERFORM update_system_stats_cache(p_company_id);
        
        SELECT stat_data INTO v_cached_stats
        FROM system_stats_cache
        WHERE company_id = p_company_id AND stat_type = 'system_stats';
    END IF;
    
    RETURN COALESCE(v_cached_stats, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Add function to detect consistency issues
CREATE OR REPLACE FUNCTION detect_consistency_issues(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_issues JSONB := '[]'::jsonb;
    v_issue_count INTEGER := 0;
BEGIN
    -- Check for orphaned shifts
    IF EXISTS (
        SELECT 1 FROM shifts s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.company_id = p_company_id AND u.id IS NULL
        LIMIT 1
    ) THEN
        SELECT jsonb_build_object(
            'type', 'orphaned_shifts',
            'count', COUNT(*),
            'description', 'Shifts with invalid user_id'
        ) INTO v_issue
        FROM shifts s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.company_id = p_company_id AND u.id IS NULL;
        
        v_issues := v_issues || v_issue;
        v_issue_count := v_issue_count + 1;
    END IF;
    
    -- Check for negative hours
    IF EXISTS (
        SELECT 1 FROM shifts
        WHERE company_id = p_company_id AND total_hours < 0
        LIMIT 1
    ) THEN
        SELECT jsonb_build_object(
            'type', 'negative_hours',
            'count', COUNT(*),
            'description', 'Shifts with negative total_hours'
        ) INTO v_issue
        FROM shifts
        WHERE company_id = p_company_id AND total_hours < 0;
        
        v_issues := v_issues || v_issue;
        v_issue_count := v_issue_count + 1;
    END IF;
    
    -- Check for excessive hours
    IF EXISTS (
        SELECT 1 FROM shifts
        WHERE company_id = p_company_id AND total_hours > 24
        LIMIT 1
    ) THEN
        SELECT jsonb_build_object(
            'type', 'excessive_hours',
            'count', COUNT(*),
            'description', 'Shifts with total_hours > 24'
        ) INTO v_issue
        FROM shifts
        WHERE company_id = p_company_id AND total_hours > 24;
        
        v_issues := v_issues || v_issue;
        v_issue_count := v_issue_count + 1;
    END IF;
    
    -- Check for stale active shifts
    IF EXISTS (
        SELECT 1 FROM shifts
        WHERE company_id = p_company_id AND clock_out_time IS NULL 
        AND clock_in_time < NOW() - INTERVAL '24 hours'
        LIMIT 1
    ) THEN
        SELECT jsonb_build_object(
            'type', 'stale_active_shifts',
            'count', COUNT(*),
            'description', 'Active shifts older than 24 hours'
        ) INTO v_issue
        FROM shifts
        WHERE company_id = p_company_id AND clock_out_time IS NULL 
        AND clock_in_time < NOW() - INTERVAL '24 hours';
        
        v_issues := v_issues || v_issue;
        v_issue_count := v_issue_count + 1;
    END IF;
    
    -- Check for invalid locations
    IF EXISTS (
        SELECT 1 FROM shifts s
        LEFT JOIN locations l ON s.location_id = l.id
        WHERE s.company_id = p_company_id AND l.id IS NULL
        LIMIT 1
    ) THEN
        SELECT jsonb_build_object(
            'type', 'invalid_locations',
            'count', COUNT(*),
            'description', 'Shifts with invalid location_id'
        ) INTO v_issue
        FROM shifts s
        LEFT JOIN locations l ON s.location_id = l.id
        WHERE s.company_id = p_company_id AND l.id IS NULL;
        
        v_issues := v_issues || v_issue;
        v_issue_count := v_issue_count + 1;
    END IF;
    
    RETURN jsonb_build_object(
        'issues', v_issues,
        'issue_count', v_issue_count,
        'healthy', v_issue_count = 0,
        'checked_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Add function to cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM system_stats_cache
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup job (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-cache', '*/5 * * * *', 'SELECT cleanup_expired_cache();');

-- Add function to validate shift data integrity
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
    IF v_shift.total_break_seconds < 0 OR v_shift.total_break_seconds > 14400 THEN -- 4 hours max
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

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON shift_audit_log TO authenticated_users;
GRANT SELECT, INSERT, UPDATE, DELETE ON system_stats_cache TO authenticated_users;
GRANT SELECT ON active_shifts_summary TO authenticated_users;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION refresh_active_shifts_summary() TO authenticated_users;
GRANT EXECUTE ON FUNCTION update_system_stats_cache(UUID) TO authenticated_users;
GRANT EXECUTE ON FUNCTION get_system_stats(UUID) TO authenticated_users;
GRANT EXECUTE ON FUNCTION detect_consistency_issues(UUID) TO authenticated_users;
GRANT EXECUTE ON FUNCTION cleanup_expired_cache() TO authenticated_users;
GRANT EXECUTE ON FUNCTION validate_shift_integrity(UUID) TO authenticated_users;

-- Comments
COMMENT ON TABLE shift_audit_log IS 'Audit trail for all shift changes';
COMMENT ON TABLE system_stats_cache IS 'Cached system statistics for performance';
COMMENT ON MATERIALIZED VIEW active_shifts_summary IS 'Materialized view of active shifts with user and location details';

COMMENT ON FUNCTION audit_shift_changes() IS 'Trigger function to log all shift changes';
COMMENT ON FUNCTION refresh_active_shifts_summary() IS 'Refresh materialized view of active shifts';
COMMENT ON FUNCTION update_system_stats_cache(UUID) IS 'Update system statistics cache';
COMMENT ON FUNCTION get_system_stats(UUID) IS 'Get system statistics from cache';
COMMENT ON FUNCTION detect_consistency_issues(UUID) IS 'Detect data consistency issues';
COMMENT ON FUNCTION cleanup_expired_cache() IS 'Clean up expired cache entries';
COMMENT ON FUNCTION validate_shift_integrity(UUID) IS 'Validate shift data integrity';
