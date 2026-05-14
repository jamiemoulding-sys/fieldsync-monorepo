/**
 * Attendance Correction Service
 * 
 * Provides the safest long-term strategy for attendance correction,
 * manager overrides, and payroll reconciliation while preserving audit integrity.
 */

const { query } = require('../database/connection');
const { AttendanceLogger, LogLevel, EventCategory } = require('./attendanceLogger');

/**
 * Correction Types
 */
const CorrectionType = {
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',     // Manual time correction
  MANAGER_OVERRIDE: 'MANAGER_OVERRIDE',         // Manager approval override
  SYSTEM_ERROR: 'SYSTEM_ERROR',                 // System error correction
  PAYROLL_RECONCILIATION: 'PAYROLL_RECONCILIATION', // Payroll discrepancy fix
  EMERGENCY_CORRECTION: 'EMERGENCY_CORRECTION'   // Emergency fix
};

/**
 * Correction Status
 */
const CorrectionStatus = {
  PENDING: 'PENDING',           // Awaiting approval
  APPROVED: 'APPROVED',         // Manager approved
  REJECTED: 'REJECTED',         // Manager rejected
  APPLIED: 'APPLIED',           // Correction applied
  REVERTED: 'REVERTED',         // Correction reverted
  AUDITED: 'AUDITED'            // Audit completed
};

/**
 * Attendance Correction Service
 */
class AttendanceCorrectionService {
  constructor() {
    this.logger = new AttendanceLogger();
  }

  /**
   * Create attendance correction request
   */
  async createCorrectionRequest(userId, companyId, correctionData) {
    const requestId = this.generateCorrectionId();
    
    try {
      // Validate correction data
      const validation = this.validateCorrectionData(correctionData);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Create correction request
      const result = await query(`
        INSERT INTO attendance_corrections (
          id,
          user_id,
          company_id,
          correction_type,
          shift_id,
          original_data,
          corrected_data,
          reason,
          requested_by,
          status,
          created_at,
          expires_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW() + INTERVAL '7 days'
        )
        RETURNING *
      `, [
        requestId,
        userId,
        companyId,
        correctionData.type,
        correctionData.shiftId || null,
        JSON.stringify(correctionData.originalData),
        JSON.stringify(correctionData.correctedData),
        correctionData.reason,
        correctionData.requestedBy,
        CorrectionStatus.PENDING
      ]);

      // Log correction request
      await this.logger.logLifecycle(userId, companyId, 'correction_requested', requestId, {
        correctionType: correctionData.type,
        shiftId: correctionData.shiftId,
        reason: correctionData.reason,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });

      // Notify managers for approval
      await this.notifyManagers(companyId, {
        type: 'correction_request',
        requestId: result.rows[0].id,
        userId,
        correctionType: correctionData.type,
        urgency: this.calculateUrgency(correctionData)
      });

      return {
        success: true,
        requestId: result.rows[0].id,
        status: CorrectionStatus.PENDING
      };

    } catch (error) {
      await this.logger.logSecurity(userId, companyId, 'correction_creation_failed', {
        error: error.message,
        correctionData
      });
      
      throw error;
    }
  }

  /**
   * Manager approval for correction
   */
  async approveCorrection(managerId, companyId, requestId, approvalData) {
    try {
      // Verify manager permissions
      const hasPermission = await this.verifyManagerPermission(managerId, companyId);
      if (!hasPermission) {
        throw new Error('Insufficient permissions for correction approval');
      }

      // Get correction request
      const correction = await this.getCorrectionRequest(requestId, companyId);
      if (!correction) {
        throw new Error('Correction request not found');
      }

      // Validate approval data
      const validation = this.validateApprovalData(approvalData, correction);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Create audit trail before applying correction
      const auditId = await this.createAuditTrail({
        requestId,
        managerId,
        companyId,
        action: 'correction_approved',
        beforeData: correction.original_data,
        afterData: correction.corrected_data,
        approvalData: approvalData
      });

      // Apply correction atomically
      await this.applyCorrectionAtomically(correction, approvalData);

      // Update correction status
      await query(`
        UPDATE attendance_corrections
        SET 
          status = $1,
          approved_by = $2,
          approved_at = NOW(),
          audit_id = $3
        WHERE id = $4
        AND company_id = $5
      `, [
        CorrectionStatus.APPROVED,
        managerId,
        auditId,
        requestId,
        companyId
      ]);

      // Log successful approval
      await this.logger.logLifecycle(correction.user_id, companyId, 'correction_approved', requestId, {
        correctionType: correction.correction_type,
        shiftId: correction.shift_id,
        managerId,
        auditId
      });

      // Notify user of correction
      await this.notifyUser(correction.user_id, {
        type: 'correction_applied',
        correctionType: correction.correction_type,
        approvedBy: managerId,
        changes: this.summarizeChanges(correction.original_data, correction.corrected_data)
      });

      return {
        success: true,
        requestId,
        status: CorrectionStatus.APPLIED,
        auditId
      };

    } catch (error) {
      await this.logger.logSecurity(managerId, companyId, 'correction_approval_failed', {
        error: error.message,
        requestId,
        approvalData
      });
      
      throw error;
    }
  }

  /**
   * Reject correction request
   */
  async rejectCorrection(managerId, companyId, requestId, rejectionData) {
    try {
      // Verify manager permissions
      const hasPermission = await this.verifyManagerPermission(managerId, companyId);
      if (!hasPermission) {
        throw new Error('Insufficient permissions for correction rejection');
      }

      // Get correction request
      const correction = await this.getCorrectionRequest(requestId, companyId);
      if (!correction) {
        throw new Error('Correction request not found');
      }

      // Create audit trail
      const auditId = await this.createAuditTrail({
        requestId,
        managerId,
        companyId,
        action: 'correction_rejected',
        beforeData: correction.original_data,
        afterData: correction.original_data, // No change applied
        rejectionData
      });

      // Update correction status
      await query(`
        UPDATE attendance_corrections
        SET 
          status = $1,
          rejected_by = $2,
          rejected_at = NOW(),
          rejection_reason = $3,
          audit_id = $4
        WHERE id = $5
        AND company_id = $6
      `, [
        CorrectionStatus.REJECTED,
        managerId,
        rejectionData.reason,
        auditId,
        requestId,
        companyId
      ]);

      // Log rejection
      await this.logger.logLifecycle(correction.user_id, companyId, 'correction_rejected', requestId, {
        correctionType: correction.correction_type,
        shiftId: correction.shift_id,
        managerId,
        rejectionReason: rejectionData.reason
      });

      // Notify user of rejection
      await this.notifyUser(correction.user_id, {
        type: 'correction_rejected',
        correctionType: correction.correction_type,
        rejectedBy: managerId,
        rejectionReason: rejectionData.reason
      });

      return {
        success: true,
        requestId,
        status: CorrectionStatus.REJECTED,
        auditId
      };

    } catch (error) {
      await this.logger.logSecurity(managerId, companyId, 'correction_rejection_failed', {
        error: error.message,
        requestId,
        rejectionData
      });
      
      throw error;
    }
  }

  /**
   * Payroll reconciliation with audit trail
   */
  async reconcilePayroll(companyId, reconciliationData) {
    const requestId = this.generateCorrectionId();
    
    try {
      // Validate reconciliation data
      const validation = this.validateReconciliationData(reconciliationData);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Start reconciliation transaction
      await query('BEGIN');

      try {
        // Create reconciliation record
        const reconResult = await query(`
          INSERT INTO payroll_reconciliations (
            id,
            company_id,
            reconciliation_type,
            period_start,
            period_end,
            original_totals,
            corrected_totals,
            discrepancy_amount,
            discrepancy_reason,
            status,
            created_by,
            created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
          )
          RETURNING *
        `, [
          requestId,
          companyId,
          reconciliationData.type,
          reconciliationData.periodStart,
          reconciliationData.periodEnd,
          JSON.stringify(reconciliationData.originalTotals),
          JSON.stringify(reconciliationData.correctedTotals),
          reconciliationData.discrepancyAmount,
          reconciliationData.discrepancyReason,
          'PENDING',
          reconciliationData.createdBy
        ]);

        // Apply all shift corrections atomically
        for (const correction of reconciliationData.corrections) {
          await this.applyCorrectionAtomically(correction, {
            approvedBy: reconciliationData.createdBy,
            approvalNotes: `Payroll reconciliation: ${reconciliationData.discrepancyReason}`
          });
        }

        // Update reconciliation status
        await query(`
          UPDATE payroll_reconciliations
          SET 
            status = 'COMPLETED',
            completed_at = NOW()
          WHERE id = $1
        `, [reconResult.rows[0].id]);

        await query('COMMIT');

        // Log successful reconciliation
        await this.logger.logLifecycle(reconciliationData.createdBy, companyId, 'payroll_reconciliation_completed', requestId, {
          reconciliationType: reconciliationData.type,
          periodStart: reconciliationData.periodStart,
          periodEnd: reconciliationData.periodEnd,
          discrepancyAmount: reconciliationData.discrepancyAmount,
          correctionsApplied: reconciliationData.corrections.length
        });

        return {
          success: true,
          reconciliationId: reconResult.rows[0].id,
          status: 'COMPLETED',
          correctionsApplied: reconciliationData.corrections.length
        };

      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      await this.logger.logSecurity(reconciliationData.createdBy, companyId, 'payroll_reconciliation_failed', {
        error: error.message,
        reconciliationData
      });
      
      throw error;
    }
  }

  /**
   * Apply correction atomically with full audit trail
   */
  async applyCorrectionAtomically(correction, approvalData = {}) {
    const auditId = await this.createAuditTrail({
      requestId: correction.id,
      managerId: approvalData.approvedBy || correction.requested_by,
      companyId: correction.company_id,
      action: 'correction_applied',
      beforeData: correction.original_data,
      afterData: correction.corrected_data,
      approvalData
    });

    // Apply correction based on type
    switch (correction.correction_type) {
      case CorrectionType.MANUAL_ADJUSTMENT:
        await this.applyTimeAdjustment(correction, auditId);
        break;
        
      case CorrectionType.MANAGER_OVERRIDE:
        await this.applyManagerOverride(correction, auditId);
        break;
        
      case CorrectionType.SYSTEM_ERROR:
        await this.applySystemCorrection(correction, auditId);
        break;
        
      case CorrectionType.PAYROLL_RECONCILIATION:
        await this.applyPayrollCorrection(correction, auditId);
        break;
        
      default:
        throw new Error(`Unknown correction type: ${correction.correction_type}`);
    }
  }

  /**
   * Apply time adjustment correction
   */
  async applyTimeAdjustment(correction, auditId) {
    const shiftId = correction.shift_id;
    const correctedData = JSON.parse(correction.corrected_data);

    // Update shift with new times
    await query(`
      UPDATE shifts
      SET 
        clock_in_time = $1,
        clock_out_time = $2,
        total_hours = $3,
        total_break_seconds = $4,
        latitude = $5,
        longitude = $6,
        updated_at = NOW()
      WHERE id = $7
    `, [
      correctedData.clock_in_time,
      correctedData.clock_out_time,
      correctedData.total_hours,
      correctedData.total_break_seconds,
      correctedData.latitude,
      correctedData.longitude,
      shiftId
    ]);

    // Log specific correction
    await this.logger.logLifecycle(correction.user_id, correction.company_id, 'time_adjustment_applied', shiftId, {
      auditId,
      adjustments: correctedData
    });
  }

  /**
   * Apply manager override correction
   */
  async applyManagerOverride(correction, auditId) {
    const shiftId = correction.shift_id;
    const correctedData = JSON.parse(correction.corrected_data);

    // Update shift with override data
    await query(`
      UPDATE shifts
      SET 
        clock_in_time = $1,
        clock_out_time = $2,
        total_hours = $3,
        is_late = $4,
        override_reason = $5,
        override_by = $6,
        updated_at = NOW()
      WHERE id = $7
    `, [
      correctedData.clock_in_time,
      correctedData.clock_out_time,
      correctedData.total_hours,
      correctedData.is_late,
      correction.reason,
      correction.requested_by,
      shiftId
    ]);

    // Log override
    await this.logger.logLifecycle(correction.user_id, correction.company_id, 'manager_override_applied', shiftId, {
      auditId,
      overrideReason: correction.reason,
      overrideBy: correction.requested_by
    });
  }

  /**
   * Apply system error correction
   */
  async applySystemCorrection(correction, auditId) {
    const shiftId = correction.shift_id;
    const correctedData = JSON.parse(correction.corrected_data);

    // Update shift with correction
    await query(`
      UPDATE shifts
      SET 
        clock_in_time = $1,
        clock_out_time = $2,
        total_hours = $3,
        total_break_seconds = $4,
        system_correction = $5,
        correction_reason = $6,
        updated_at = NOW()
      WHERE id = $7
    `, [
      correctedData.clock_in_time,
      correctedData.clock_out_time,
      correctedData.total_hours,
      correctedData.total_break_seconds,
      true, // system_correction flag
      correction.reason,
      shiftId
    ]);

    // Log system correction
    await this.logger.logLifecycle(correction.user_id, correction.company_id, 'system_correction_applied', shiftId, {
      auditId,
      correctionReason: correction.reason
    });
  }

  /**
   * Create comprehensive audit trail
   */
  async createAuditTrail(auditData) {
    const result = await query(`
      INSERT INTO attendance_audit_trail (
        id,
        correction_request_id,
        manager_id,
        company_id,
        action,
        before_data,
        after_data,
        metadata,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW()
      )
      RETURNING *
    `, [
        auditData.requestId,
        auditData.managerId,
        auditData.companyId,
        auditData.action,
        auditData.beforeData,
        auditData.afterData,
        JSON.stringify(auditData.metadata || {}),
        auditData.requestId
      ]);

    return result.rows[0].id;
  }

  /**
   * Verify manager permissions
   */
  async verifyManagerPermission(managerId, companyId) {
    const result = await query(`
      SELECT role, permissions 
      FROM users 
      WHERE id = $1 
      AND company_id = $2
    `, [managerId, companyId]);

    const user = result.rows[0];
    if (!user) return false;

    // Check if user has correction permissions
    const permissions = user.permissions ? JSON.parse(user.permissions) : [];
    return permissions.includes('attendance_correction') || user.role === 'admin';
  }

  /**
   * Get correction request
   */
  async getCorrectionRequest(requestId, companyId) {
    const result = await query(`
      SELECT * FROM attendance_corrections
      WHERE id = $1 
      AND company_id = $2
    `, [requestId, companyId]);

    return result.rows[0];
  }

  /**
   * Validate correction data
   */
  validateCorrectionData(correctionData) {
    // Required fields
    const required = ['type', 'reason', 'originalData', 'correctedData'];
    for (const field of required) {
      if (!correctionData[field]) {
        return {
          valid: false,
          error: `Missing required field: ${field}`
        };
      }
    }

    // Validate correction type
    const validTypes = Object.values(CorrectionType);
    if (!validTypes.includes(correctionData.type)) {
      return {
        valid: false,
        error: `Invalid correction type: ${correctionData.type}`
      };
    }

    // Validate time data if present
    if (correctionData.correctedData?.clock_in_time) {
      const clockIn = new Date(correctionData.correctedData.clock_in_time);
      const clockOut = new Date(correctionData.correctedData.clock_out_time);
      
      if (clockIn >= clockOut) {
        return {
          valid: false,
          error: 'Clock-in time must be before clock-out time'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate approval data
   */
  validateApprovalData(approvalData, correction) {
    if (!approvalData.approvedBy) {
      return {
        valid: false,
        error: 'Approval requires manager ID'
      };
    }

    // Additional validation based on correction type
    switch (correction.correction_type) {
      case CorrectionType.MANUAL_ADJUSTMENT:
        return this.validateTimeAdjustmentApproval(approvalData);
        
      case CorrectionType.MANAGER_OVERRIDE:
        return this.validateManagerOverrideApproval(approvalData);
        
      default:
        return { valid: true };
    }
  }

  /**
   * Validate time adjustment approval
   */
  validateTimeAdjustmentApproval(approvalData) {
    // Check for reasonable time adjustments
    if (approvalData.maxAdjustmentHours && approvalData.maxAdjustmentHours < 0) {
      return {
        valid: false,
        error: 'Maximum adjustment hours must be positive'
      };
    }

    return { valid: true };
  }

  /**
   * Validate manager override approval
   */
  validateManagerOverrideApproval(approvalData) {
    // Check override reason
    if (!approvalData.overrideReason || approvalData.overrideReason.trim().length === 0) {
      return {
        valid: false,
        error: 'Manager override requires a reason'
      };
    }

    return { valid: true };
  }

  /**
   * Validate reconciliation data
   */
  validateReconciliationData(reconciliationData) {
    const required = ['type', 'periodStart', 'periodEnd', 'originalTotals', 'correctedTotals'];
    for (const field of required) {
      if (!reconciliationData[field]) {
        return {
          valid: false,
          error: `Missing required field: ${field}`
        };
      }
    }

    // Validate period dates
    const periodStart = new Date(reconciliationData.periodStart);
    const periodEnd = new Date(reconciliationData.periodEnd);
    
    if (periodStart >= periodEnd) {
      return {
        valid: false,
        error: 'Period start must be before period end'
      };
    }

    return { valid: true };
  }

  /**
   * Calculate urgency based on correction type and impact
   */
  calculateUrgency(correctionData) {
    const urgencyMap = {
      [CorrectionType.EMERGENCY_CORRECTION]: 'critical',
      [CorrectionType.SYSTEM_ERROR]: 'high',
      [CorrectionType.PAYROLL_RECONCILIATION]: 'high',
      [CorrectionType.MANAGER_OVERRIDE]: 'medium',
      [CorrectionType.MANUAL_ADJUSTMENT]: 'low'
    };

    return urgencyMap[correctionData.type] || 'medium';
  }

  /**
   * Generate unique correction ID
   */
  generateCorrectionId() {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Summarize changes for user notification
   */
  summarizeChanges(originalData, correctedData) {
    const original = JSON.parse(originalData);
    const corrected = JSON.parse(correctedData);
    
    const changes = [];
    
    for (const key in corrected) {
      if (original[key] !== corrected[key]) {
        changes.push({
          field: key,
          from: original[key],
          to: corrected[key]
        });
      }
    }
    
    return changes;
  }

  /**
   * Notify managers of correction request
   */
  async notifyManagers(companyId, notificationData) {
    // This would integrate with your notification system
    // For now, log the notification
    await this.logger.logLifecycle(notificationData.requestedBy, companyId, 'manager_notification_sent', null, {
      notificationType: 'correction_request',
      urgency: notificationData.urgency,
      requestId: notificationData.requestId
    });
  }

  /**
   * Notify user of correction result
   */
  async notifyUser(userId, notificationData) {
    // This would integrate with your notification system
    // For now, log the notification
    await this.logger.logLifecycle(userId, companyId, 'user_notification_sent', null, {
      notificationType: notificationData.type,
      correctionType: notificationData.correctionType
    });
  }

  /**
   * Get correction history
   */
  async getCorrectionHistory(userId, companyId, options = {}) {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    const result = await query(`
      SELECT 
        c.id,
        c.correction_type,
        c.status,
        c.created_at,
        c.approved_at,
        c.shift_id,
        c.reason,
        s.clock_in_time,
        s.clock_out_time,
        s.total_hours,
        CASE 
          WHEN c.approved_by IS NOT NULL THEN u.name
          ELSE NULL
        END as approved_by_name
      FROM attendance_corrections c
      LEFT JOIN shifts s ON c.shift_id = s.id
      LEFT JOIN users u ON c.approved_by = u.id
      WHERE c.user_id = $1
      AND c.company_id = $2
      ORDER BY c.created_at DESC
      LIMIT $3 OFFSET $4
    `, [userId, companyId, limit, offset]);

    return result.rows;
  }

  /**
   * Get pending corrections for managers
   */
  async getPendingCorrections(companyId, options = {}) {
    const limit = options.limit || 20;
    
    const result = await query(`
      SELECT 
        c.id,
        c.correction_type,
        c.status,
        c.created_at,
        c.shift_id,
        c.reason,
        u.name as requested_by_name,
        u.email as requested_by_email,
        s.clock_in_time,
        s.clock_out_time,
        s.total_hours
      FROM attendance_corrections c
      JOIN users u ON c.requested_by = u.id
      LEFT JOIN shifts s ON c.shift_id = s.id
      WHERE c.company_id = $1
      AND c.status = 'PENDING'
      AND c.created_at > NOW() - INTERVAL '7 days'
      ORDER BY c.created_at ASC
      LIMIT $1
    `, [companyId, limit]);

    return result.rows;
  }
}

module.exports = {
  AttendanceCorrectionService,
  CorrectionType,
  CorrectionStatus
};
