-- Minimal Attendance Performance Indexes Migration
-- Optimized for high-concurrency attendance operations and row-locking scalability

-- ========================================
-- P0 CRITICAL: Core Performance Indexes
-- ========================================

-- Most critical: Active shift lookup with row locking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_active_user_company 
ON shifts (user_id, company_id, clock_out_time DESC, id DESC);

-- Break state queries with row locking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_break_state 
ON shifts (user_id, company_id, break_started_at DESC, id DESC);

-- Time-based queries for history and analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_time_range 
ON shifts (user_id, company_id, clock_in_time DESC);

-- Device tracking for concurrent device detection
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_device_tracking 
ON shifts (device_fingerprint, user_id, company_id, created_at DESC);

-- Location-based queries for geofence validation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_location_time 
ON shifts (location_id, clock_in_time DESC);

-- Fast authentication lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_auth_company 
ON users (company_id, email, is_active DESC);

-- Role and permission checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_permissions 
ON users (company_id, role, is_active DESC);

-- Session validation with expiration
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active 
ON user_sessions (user_id, company_id, expires_at DESC, status DESC);

-- Device session coordination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_device 
ON user_sessions (device_fingerprint, user_id, last_activity DESC);

-- Session cleanup queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expiration 
ON user_sessions (expires_at, status DESC);

-- ========================================
-- P1 HIGH-IMPACT: Performance Indexes
-- ========================================

-- Time-based audit queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_time 
ON activity_logs (user_id, company_id, created_at DESC);

-- Action-based filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_action 
ON activity_logs (company_id, action, created_at DESC);

-- Metadata JSON queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_metadata 
ON activity_logs USING GIN (metadata);

-- Company-based location lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locations_company_active 
ON locations (company_id, archived DESC, name ASC);

-- Geospatial queries (include location data)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locations_geofence 
ON locations (company_id, archived DESC) 
INCLUDE (latitude, longitude, radius);

-- User schedule lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_user_date 
ON schedules (user_id, company_id, date DESC);

-- Time range queries for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_time_range 
ON schedules (company_id, start_time DESC, end_time DESC);

-- ========================================
-- P2 SUPPORTING: Audit and Analytics Indexes
-- ========================================

-- Correction request lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_corrections_user_status 
ON attendance_corrections (user_id, company_id, status DESC, created_at DESC);

-- Manager approval queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_corrections_approval 
ON attendance_corrections (company_id, status, approved_by DESC, created_at DESC);

-- Expiration cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_corrections_expires 
ON attendance_corrections (expires_at DESC, status DESC);

-- Audit trail queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_correction 
ON attendance_audit_trail (correction_request_id, created_at DESC);

-- Audit trail company queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_company 
ON attendance_audit_trail (company_id, created_at DESC);

-- Audit trail manager queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_manager 
ON attendance_audit_trail (manager_id, created_at DESC);

-- Payroll corruption alerts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_corruption_alerts_severity 
ON payroll_corruption_alerts (company_id, severity DESC, detected_at DESC);

-- User-based corruption tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_corruption_alerts_user 
ON payroll_corruption_alerts (user_id, company_id, detected_at DESC);

-- Device tracking queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_devices_user_fingerprint 
ON user_devices (user_id, device_fingerprint, last_seen DESC);

-- Device company queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_devices_company_status 
ON user_devices (company_id, status, last_seen DESC);

-- ========================================
-- OPTIMIZATION: Composite Indexes for Common Queries
-- ========================================

-- Active shift with location filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_active_location 
ON shifts (user_id, company_id, location_id, clock_out_time DESC);

-- Shift history with date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_history_range 
ON shifts (user_id, company_id, clock_in_time DESC, clock_out_time DESC);

-- Break duration analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_break_analytics 
ON shifts (user_id, company_id, break_started_at DESC, total_break_seconds DESC);

-- GPS route tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_routes_shift_time 
ON shift_routes (shift_id, created_at DESC);

-- Route logs with time filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_route_logs_shift_time 
ON shift_route_logs (shift_id, company_id, created_at DESC);

-- Task completion tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_completions_shift_user 
ON task_completions (shift_id, user_id, completed_at DESC);

-- Task assignment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assigned_user 
ON tasks (assigned_to, company_id, status DESC, due_date DESC);

-- ========================================
-- PERFORMANCE: Monitoring and Maintenance
-- ========================================

-- Function to analyze index usage
CREATE OR REPLACE FUNCTION analyze_index_performance()
RETURNS TABLE(
    table_name TEXT,
    index_name TEXT,
    usage_count BIGINT,
    efficiency_percent NUMERIC,
    recommendation TEXT
) AS $$
DECLARE
    idx_record RECORD;
    recommendations TEXT[];
BEGIN
    recommendations := ARRAY[
        'Consider REINDEX if efficiency < 80%',
        'Monitor if usage_count > 10000',
        'Optimize query if usage_count < 100'
    ];
    
    FOR idx_record IN 
        SELECT 
            t.relname as table_name,
            i.relname as index_name,
            s.idx_scan as usage_count,
            CASE 
                WHEN s.idx_tup_read > 0 THEN 
                    (s.idx_tup_fetch::NUMERIC / s.idx_tup_read::NUMERIC) * 100
                ELSE 0 
            END as efficiency_percent,
            CASE 
                WHEN s.idx_scan > 10000 THEN recommendations[2]
                WHEN s.idx_tup_fetch::NUMERIC / s.idx_tup_read::NUMERIC < 0.8 THEN recommendations[1]
                ELSE recommendations[3]
            END as recommendation
        FROM pg_stat_user_indexes i
        JOIN pg_stat_user_tables t ON i.tablename = t.relname
        JOIN pg_stat_user_indexes s ON i.indexrelid = s.indexrelid
        WHERE i.schemaname = 'public'
        AND t.schemaname = 'public'
        AND i.tablename IN ('shifts', 'users', 'user_sessions', 'activity_logs')
    LOOP
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to rebuild fragmented indexes
CREATE OR REPLACE FUNCTION rebuild_fragmented_indexes()
RETURNS TEXT AS $$
DECLARE
    idx_record RECORD;
    rebuilt_count INTEGER := 0;
BEGIN
    FOR idx_record IN 
        SELECT schemaname, tablename, indexname 
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        AND idx_scan > 5000 -- Fragmentation threshold
        AND idx_tup_fetch > 2.0 -- Poor efficiency threshold
    LOOP
        BEGIN
            EXECUTE 'REINDEX INDEX CONCURRENTLY ' || idx_record.schemaname || '.' || idx_record.tablename || '.' || idx_record.indexname;
            rebuilt_count := rebuilt_count + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Continue with other indexes if one fails
            CONTINUE;
        END;
    END LOOP;
    
    RETURN 'Rebuilt ' || rebuilt_count || ' fragmented indexes';
END;
$$ LANGUAGE plpgsql;

-- Schedule regular maintenance (run daily at 2 AM)
SELECT cron.schedule('0 2 * * *', $$
    BEGIN
        PERFORM rebuild_fragmented_indexes();
        -- Log index performance analysis
        INSERT INTO maintenance_logs (log_type, message, created_at)
        VALUES ('index_maintenance', 'Daily index rebuild completed', NOW());
    END;
$$);

-- ========================================
-- COMMENTS: Index Purpose and Usage
-- ========================================

COMMENT ON INDEX idx_shifts_active_user_company IS 'Critical for active shift lookups with row locking';
COMMENT ON INDEX idx_shifts_break_state IS 'Optimizes break state queries and prevents race conditions';
COMMENT ON INDEX idx_shifts_time_range IS 'Improves shift history and analytics queries';
COMMENT ON INDEX idx_shifts_device_tracking IS 'Enables concurrent device detection and coordination';
COMMENT ON INDEX idx_users_auth_company IS 'Essential for fast user authentication and authorization';
COMMENT ON INDEX idx_sessions_active IS 'Critical for session validation and security';
COMMENT ON INDEX idx_activity_logs_time IS 'Optimizes audit trail queries for compliance reporting';
COMMENT ON INDEX idx_locations_company_active IS 'Improves geofence validation and location lookups';
COMMENT ON INDEX idx_corrections_user_status IS 'Essential for attendance correction workflow and audit trail';

-- ========================================
-- PERFORMANCE: Configuration Settings
-- ========================================

-- Recommended PostgreSQL settings for attendance workload
ALTER SYSTEM SET shared_buffers = '256MB';           -- Cache frequently accessed data
ALTER SYSTEM SET effective_cache_size = '1GB';          -- Cache query plans
ALTER SYSTEM SET work_mem = '16MB';                     -- Memory for sort operations
ALTER SYSTEM SET maintenance_work_mem = '64MB';          -- Memory for index operations
ALTER SYSTEM SET checkpoint_completion_target = '0.9';        -- Balance between durability and performance
ALTER SYSTEM SET wal_buffers = '16MB';                   -- Write-ahead logging buffers
ALTER SYSTEM SET random_page_cost = '1.1';                -- Favor index scans over sequential scans
ALTER SYSTEM SET seq_page_cost = '1.0';                  -- Cost for sequential page fetches

-- Connection pool settings for high concurrency
ALTER SYSTEM SET max_connections = '200';
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements'; -- Track query statistics

-- Enable query plan caching
ALTER SYSTEM SET plan_cache_mode = 'force_generic_plan';         -- Use generic plans for better caching
ALTER SYSTEM SET jit = 'off';                                   -- Disable JIT for simple queries

-- ========================================
-- MONITORING: Performance Metrics Collection
-- ========================================

-- Enable detailed statistics collection
ALTER SYSTEM SET track_activities = 'on';
ALTER SYSTEM SET track_counts = 'on';
ALTER SYSTEM SET track_io_timing = 'on';
ALTER SYSTEM SET track_functions = 'all';

-- Collect statistics regularly
CREATE OR REPLACE FUNCTION collect_attendance_stats()
RETURNS VOID AS $$
BEGIN
    -- Analyze tables for better query planning
    ANALYZE shifts;
    ANALYZE users;
    ANALYZE user_sessions;
    ANALYZE activity_logs;
    ANALYZE locations;
    ANALYZE schedules;
    
    -- Log performance metrics
    INSERT INTO performance_metrics (metric_type, metric_value, collected_at)
    SELECT 
        'active_shift_queries' as metric_type,
        COUNT(*) as metric_value,
        NOW() as collected_at
    FROM pg_stat_statements 
    WHERE query LIKE '%shifts% AND clock_out_time IS NULL%';
END;
$$ LANGUAGE plpgsql;

-- Schedule stats collection (every 5 minutes)
SELECT cron.schedule('*/5 * * * *', $$
    BEGIN
        PERFORM collect_attendance_stats();
    END;
$$);
