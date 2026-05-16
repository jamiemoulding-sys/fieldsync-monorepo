/**
 * Attendance Corrections API Routes
 * 
 * Provides API endpoints for attendance correction requests,
 * manager approvals, and payroll reconciliation with full audit integrity.
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { AttendanceCorrectionService, CorrectionType, CorrectionStatus } = require('../services/attendanceCorrectionService');

/**
 * Initialize correction service
 */
const correctionService = new AttendanceCorrectionService();

/**
 * Middleware to check correction permissions
 */
const requireCorrectionPermission = (permission = 'attendance_correction') => {
  return async (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has correction permissions
    const result = await query(`
      SELECT permissions, role FROM users 
      WHERE id = $1 AND company_id = $2
    `, [user.id, user.companyId]);

    const dbUser = result.rows[0];
    if (!dbUser) {
      return res.status(403).json({ error: 'User not found' });
    }

    const permissions = dbUser.permissions ? JSON.parse(dbUser.permissions) : [];
    const hasPermission = permissions.includes(permission) || dbUser.role === 'admin';

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Insufficient permissions for attendance corrections',
        required: permission
      });
    }

    req.correctionService = correctionService;
    next();
  };
};

//
// =======================
// ✅ CORRECTION REQUESTS
// =======================
router.post('/requests', authenticateToken, requireCorrectionPermission(), async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;
    const { correctionService } = req;

    const {
      type,
      shiftId,
      originalData,
      correctedData,
      reason
    } = req.body;

    // Validate required fields
    if (!type || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: type, reason'
      });
    }

    // Create correction request
    const result = await correctionService.createCorrectionRequest(userId, companyId, {
      type,
      shiftId,
      originalData,
      correctedData,
      reason,
      requestedBy: userId
    });

    res.status(201).json({
      success: true,
      correctionRequest: result,
      message: 'Correction request submitted for manager approval'
    });

  } catch (error) {
    console.error('Correction request creation error:', error);
    res.status(500).json({
      error: 'Failed to create correction request'
    });
  }
});

//
// =======================
// ✅ MANAGER APPROVALS
// =======================
router.post('/approve', authenticateToken, requireCorrectionPermission(), async (req, res) => {
  try {
    const managerId = req.user.id;
    const companyId = req.user.companyId;
    const { correctionService } = req;

    const {
      requestId,
      approvalNotes
    } = req.body;

    if (!requestId) {
      return res.status(400).json({
        error: 'Missing required field: requestId'
      });
    }

    // Approve correction
    const result = await correctionService.approveCorrection(managerId, companyId, requestId, {
      approvedBy: managerId,
      notes: approvalNotes
    });

    res.json({
      success: true,
      correction: result,
      message: 'Correction approved and applied successfully'
    });

  } catch (error) {
    console.error('Correction approval error:', error);
    res.status(500).json({
      error: 'Failed to approve correction'
    });
  }
});

//
// =======================
// ❌ MANAGER REJECTIONS
// =======================
router.post('/reject', authenticateToken, requireCorrectionPermission(), async (req, res) => {
  try {
    const managerId = req.user.id;
    const companyId = req.user.companyId;
    const { correctionService } = req;

    const {
      requestId,
      rejectionReason
    } = req.body;

    if (!requestId || !rejectionReason) {
      return res.status(400).json({
        error: 'Missing required fields: requestId, rejectionReason'
      });
    }

    // Reject correction
    const result = await correctionService.rejectCorrection(managerId, companyId, requestId, {
      reason: rejectionReason
    });

    res.json({
      success: true,
      correction: result,
      message: 'Correction request rejected'
    });

  } catch (error) {
    console.error('Correction rejection error:', error);
    res.status(500).json({
      error: 'Failed to reject correction'
    });
  }
});

//
// =======================
// 📊 CORRECTION HISTORY
// =======================
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await correctionService.getCorrectionHistory(userId, companyId, {
      limit,
      offset
    });

    res.json({
      success: true,
      corrections: result,
      pagination: {
        limit,
        offset,
        total: result.length
      }
    });

  } catch (error) {
    console.error('Correction history error:', error);
    res.status(500).json({
      error: 'Failed to fetch correction history'
    });
  }
});

//
// =======================
// 📋 PENDING CORRECTIONS (MANAGER VIEW)
// =======================
router.get('/pending', authenticateToken, requireCorrectionPermission(), async (req, res) => {
  try {
    const managerId = req.user.id;
    const companyId = req.user.companyId;
    const limit = parseInt(req.query.limit) || 20;

    const result = await correctionService.getPendingCorrections(companyId, {
      limit
    });

    res.json({
      success: true,
      pendingCorrections: result,
      count: result.length
    });

  } catch (error) {
    console.error('Pending corrections error:', error);
    res.status(500).json({
      error: 'Failed to fetch pending corrections'
    });
  }
});

//
// =======================
// 💰 PAYROLL RECONCILIATION
// =======================
router.post('/reconcile', authenticateToken, requireCorrectionPermission(), async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;
    const { correctionService } = req;

    const {
      type,
      periodStart,
      periodEnd,
      originalTotals,
      correctedTotals,
      discrepancyAmount,
      discrepancyReason,
      corrections
    } = req.body;

    // Validate required fields
    const requiredFields = ['type', 'periodStart', 'periodEnd', 'originalTotals', 'correctedTotals'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          error: `Missing required field: ${field}`
        });
      }
    }

    // Create reconciliation
    const result = await correctionService.reconcilePayroll(companyId, {
      type,
      periodStart,
      periodEnd,
      originalTotals,
      correctedTotals,
      discrepancyAmount,
      discrepancyReason,
      corrections: corrections || [],
      createdBy: userId
    });

    res.status(201).json({
      success: true,
      reconciliation: result,
      message: 'Payroll reconciliation completed successfully'
    });

  } catch (error) {
    console.error('Payroll reconciliation error:', error);
    res.status(500).json({
      error: 'Failed to reconcile payroll'
    });
  }
});

//
// =======================
// 📈 RECONCILIATION HISTORY
// =======================
router.get('/reconciliations', authenticateToken, requireCorrectionPermission(), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const limit = parseInt(req.query.limit) || 30;
    const offset = parseInt(req.query.offset) || 0;

    const result = await query(`
      SELECT 
        id,
        reconciliation_type,
        period_start,
        period_end,
        discrepancy_amount,
        discrepancy_reason,
        status,
        created_at,
        completed_at,
        corrections_applied
      FROM payroll_reconciliations
      WHERE company_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [companyId, limit, offset]);

    res.json({
      success: true,
      reconciliations: result,
      pagination: {
        limit,
        offset,
        total: result.length
      }
    });

  } catch (error) {
    console.error('Reconciliation history error:', error);
    res.status(500).json({
      error: 'Failed to fetch reconciliation history'
    });
  }
});

//
// =======================
// 🔍 AUDIT TRAIL
// =======================
router.get('/audit/:requestId', authenticateToken, requireCorrectionPermission(), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { requestId} = req.params;

    const result = await query(`
      SELECT 
        at.id,
        at.action,
        at.before_data,
        at.after_data,
        at.metadata,
        at.created_at,
        u.name as manager_name,
        u.email as manager_email
      FROM attendance_audit_trail at
      JOIN users u ON at.manager_id = u.id
      WHERE at.correction_request_id = $1
      AND at.company_id = $2
      ORDER BY at.created_at DESC
    `, [requestId, companyId]);

    res.json({
      success: true,
      auditTrail: result,
      requestId
    });

  } catch (error) {
    console.error('Audit trail error:', error);
    res.status(500).json({
      error: 'Failed to fetch audit trail'
    });
  }
});

module.exports = router;
