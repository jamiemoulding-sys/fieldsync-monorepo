-- Payroll Corruption Detection System Migration
-- Detects and prevents hidden payroll corruption scenarios

-- Create payroll corruption alerts table
CREATE TABLE IF NOT EXISTS payroll_corruption_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  corruption_type VARCHAR(50) NOT NULL CHECK (corruption_type IN (
    'DUPLICATE_SHIFTS', 
    'PARTIAL_BREAK_STATE', 
    'STALE_SESSION', 
    'CONCURRENT_DEVICE_ACTIONS', 
    'PAYROLL_ANOMALY', 
    'DATA_MANIPULATION', 
    'SESSION_HIJACKING'
  )),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  details JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user devices tracking table
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  device_fingerprint VARCHAR(255) NOT NULL,
  device_type VARCHAR(50) NOT NULL,
  user_agent TEXT,
  ip_address INET,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, device_fingerprint)
);

-- Create session tracking table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  device_fingerprint VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED', 'TERMINATED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '12 hours'),
  terminated_at TIMESTAMP WITH TIME ZONE,
  terminated_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add device tracking to shifts table
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(255);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

-- Add corruption detection flags to shifts
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS corruption_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS corruption_details JSONB;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_corruption_alerts_company_severity ON payroll_corruption_alerts(company_id, severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_corruption_alerts_user_type ON payroll_corruption_alerts(user_id, corruption_type, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_corruption_alerts_status ON payroll_corruption_alerts(status, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_fingerprint ON user_devices(user_id, device_fingerprint, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_user_devices_company_status ON user_devices(company_id, status, last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id, session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON user_sessions(status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device ON user_sessions(device_fingerprint, last_activity DESC);

CREATE INDEX IF NOT EXISTS idx_shifts_device_fingerprint ON shifts(device_fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_corruption_flag ON shifts(corruption_flag, created_at DESC);

-- Row Level Security
ALTER TABLE payroll_corruption_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE payroll_corruption_alerts IS 'Alerts for detected payroll corruption scenarios';
COMMENT ON TABLE user_devices IS 'Tracks user devices for concurrent action detection';
COMMENT ON TABLE user_sessions IS 'User session tracking for security and compliance';
COMMENT ON COLUMN shifts.device_fingerprint IS 'Device fingerprint for shift origin tracking';
COMMENT ON COLUMN shifts.session_id IS 'Session ID for shift correlation';
COMMENT ON COLUMN shifts.corruption_flag IS 'Flag indicating potential corruption in shift data';
COMMENT ON COLUMN shifts.corruption_details IS 'Details of detected corruption issues';

-- Create function to clean up expired sessions
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

-- Create function to detect concurrent device usage
CREATE OR REPLACE FUNCTION detect_concurrent_devices(p_user_id UUID, p_company_id UUID)
RETURNS TABLE(device_fingerprint VARCHAR, last_seen TIMESTAMP) AS $$
BEGIN
    RETURN QUERY
    SELECT device_fingerprint, last_seen
    FROM user_devices
    WHERE user_id = p_user_id
    AND company_id = p_company_id
    AND status = 'ACTIVE'
    AND last_seen > NOW() - INTERVAL '1 hour'
    ORDER BY last_seen DESC;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update device last_seen on activity
CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_devices 
    SET last_seen = NOW(), updated_at = NOW()
    WHERE user_id = NEW.user_id 
    AND device_fingerprint = NEW.device_fingerprint;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for shift device tracking
DROP TRIGGER IF EXISTS shift_device_tracking_trigger ON shifts;
CREATE TRIGGER shift_device_tracking_trigger
    BEFORE INSERT OR UPDATE ON shifts
    FOR EACH ROW
    EXECUTE FUNCTION update_device_last_seen();
