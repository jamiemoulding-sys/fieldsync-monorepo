-- Attendance Corrections System Migration
-- Safest long-term strategy for attendance correction, manager overrides, and payroll reconciliation

-- Create attendance corrections table
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  correction_type VARCHAR(30) NOT NULL CHECK (correction_type IN (
    'MANUAL_ADJUSTMENT', 
    'MANAGER_OVERRIDE', 
    'SYSTEM_ERROR', 
    'PAYROLL_RECONCILIATION', 
    'EMERGENCY_CORRECTION'
  )),
  shift_id UUID,
  original_data JSONB NOT NULL,
  corrected_data JSONB NOT NULL,
  reason TEXT NOT NULL,
  requested_by UUID NOT NULL,
  approved_by UUID,
  rejected_by UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'APPROVED', 'REJECTED', 'APPLIED', 'REVERTED', 'AUDITED'
  )),
  approval_notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  audit_id UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_corrections_user_company ON attendance_corrections(user_id, company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON attendance_corrections(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_type ON attendance_corrections(correction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_shift ON attendance_corrections(shift_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_expires ON attendance_corrections(expires_at);

-- Create comprehensive audit trail table
CREATE TABLE IF NOT EXISTS attendance_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_request_id UUID,
  manager_id UUID,
  company_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  before_data JSONB NOT NULL,
  after_data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit trail
CREATE INDEX IF NOT EXISTS idx_audit_correction ON attendance_audit_trail(correction_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_company ON attendance_audit_trail(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_manager ON attendance_audit_trail(manager_id, created_at DESC);

-- Create payroll reconciliations table
CREATE TABLE IF NOT EXISTS payroll_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  reconciliation_type VARCHAR(30) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  original_totals JSONB NOT NULL,
  corrected_totals JSONB NOT NULL,
  discrepancy_amount DECIMAL(10,2),
  discrepancy_reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for payroll reconciliations
CREATE INDEX IF NOT EXISTS idx_recon_company_period ON payroll_reconciliations(company_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_recon_status ON payroll_reconciliations(status, created_at DESC);

-- Add correction flags to shifts table for audit integrity
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS system_correction BOOLEAN DEFAULT FALSE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS override_reason TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS override_by UUID;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS correction_applied_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for correction tracking
CREATE INDEX IF NOT EXISTS idx_shifts_correction_applied ON shifts(correction_applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_system_correction ON shifts(system_correction DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_override_by ON shifts(override_by DESC);

-- Row Level Security
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_reconciliations ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE attendance_corrections IS 'Attendance correction requests and approvals with full audit trail';
COMMENT ON TABLE attendance_audit_trail IS 'Comprehensive audit trail for all attendance corrections';
COMMENT ON TABLE payroll_reconciliations IS 'Payroll reconciliation records with discrepancy tracking';
COMMENT ON COLUMN shifts.system_correction IS 'Flag indicating system-applied correction';
COMMENT ON COLUMN shifts.override_reason IS 'Reason for manager override correction';
COMMENT ON COLUMN shifts.override_by IS 'Manager who approved override correction';
COMMENT ON COLUMN shifts.correction_applied_at IS 'Timestamp when correction was applied';
