-- Attendance Logs Table Migration
-- Production-safe logging and observability for attendance lifecycle

-- Create attendance_logs table for comprehensive logging
CREATE TABLE IF NOT EXISTS attendance_logs (
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_company_time ON attendance_logs(user_id, company_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_level_time ON attendance_logs(level, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_category_time ON attendance_logs(category, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_event_time ON attendance_logs(event, timestamp DESC);

-- Indexes for duplicate detection
CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_event_time ON attendance_logs(user_id, event, timestamp DESC);

-- Row Level Security
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE attendance_logs IS 'Attendance lifecycle and security logging table';
COMMENT ON COLUMN attendance_logs.level IS 'Log level: INFO, WARN, ERROR, CRITICAL';
COMMENT ON COLUMN attendance_logs.category IS 'Event category: LIFECYCLE, DUPLICATE, REPLAY, INVALID_STATE, SECURITY, PERFORMANCE';
COMMENT ON COLUMN attendance_logs.metadata IS 'JSON metadata for additional context';
