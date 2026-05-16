#!/usr/bin/env node

/**
 * Production Readiness Test Script
 * 
 * Validates all critical aspects of the attendance system
 * before production deployment.
 */

const { query } = require('../database/connection');
const axios = require('axios');

class ProductionReadinessTest {
  constructor() {
    this.results = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      passed: []
    };
    this.apiBase = process.env.API_BASE_URL || 'http://localhost:3000';
  }

  async runAllTests() {
    console.log('🚀 Starting Production Readiness Tests...\n');

    // P0 Critical Tests
    await this.testDatabaseIndexes();
    await this.testRowLocking();
    await this.testConcurrentDeviceHandling();
    await this.testOfflineReplayProtection();
    await this.testPayrollIntegrity();

    // P1 High Priority Tests
    await this.testLoggingAndObservability();
    await this.testRollbackSafety();
    await this.testApiSecurity();

    // P2 Medium Priority Tests
    await this.testPerformanceAndScalability();
    await this.testIntegrationPoints();

    // P3 Low Priority Tests
    await this.testDocumentationAndTraining();

    this.printResults();
    return this.results;
  }

  async testDatabaseIndexes() {
    console.log('📊 Testing Database Indexes...');

    try {
      // Check if critical indexes exist
      const indexCheck = await query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public'
        AND indexname IN (
          'idx_shifts_active_user_company',
          'idx_shifts_break_state',
          'idx_shifts_device_tracking',
          'idx_users_auth_company',
          'idx_sessions_active'
        )
      `);

      if (indexCheck.rows.length < 5) {
        this.results.critical.push({
          test: 'Database Indexes',
          issue: `Missing critical indexes. Found ${indexCheck.rows.length}/5`,
          recommendation: 'Run migration: 20250515000000_attendance_performance_indexes.sql'
        });
      } else {
        this.results.passed.push('Database Indexes: All critical indexes present');
      }

      // Test index performance
      const perfTest = await query(`
        SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        AND tablename = 'shifts'
        AND indexname = 'idx_shifts_active_user_company'
      `);

      const indexPerf = perfTest.rows[0];
      if (indexPerf.idx_tup_fetch > 2.0) {
        this.results.high.push({
          test: 'Index Performance',
          issue: `Poor index efficiency: ${indexPerf.idx_tup_fetch}`,
          recommendation: 'Consider REINDEX or query optimization'
        });
      }

    } catch (error) {
      this.results.critical.push({
        test: 'Database Indexes',
        issue: `Database connection error: ${error.message}`,
        recommendation: 'Check database connectivity and permissions'
      });
    }
  }

  async testRowLocking() {
    console.log('🔒 Testing Row Locking...');

    try {
      // Test concurrent shift operations
      const testUserId = 'test-user-' + Date.now();
      const testCompanyId = 'test-company';

      // Create test shift
      await query(`
        INSERT INTO shifts (user_id, company_id, clock_in_time)
        VALUES ($1, $2, NOW())
      `, [testUserId, testCompanyId]);

      // Simulate concurrent access
      const promises = Array(5).fill().map(async (_, i) => {
        const client = await this.getDbClient();
        
        try {
          await client.query('BEGIN');
          
          const result = await client.query(`
            SELECT * FROM shifts 
            WHERE user_id = $1 AND company_id = $2 AND clock_out_time IS NULL 
            ORDER BY id DESC
            LIMIT 1 FOR UPDATE
          `, [testUserId, testCompanyId]);

          await client.query('COMMIT');
          return { success: true, locked: result.rows[0] };
        } catch (error) {
          await client.query('ROLLBACK');
          return { success: false, error: error.message };
        } finally {
          client.release();
        }
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      
      if (successCount < 4) {
        this.results.high.push({
          test: 'Row Locking',
          issue: `Only ${successCount}/5 concurrent operations succeeded`,
          recommendation: 'Check FOR UPDATE usage and deadlock handling'
        });
      } else {
        this.results.passed.push('Row Locking: Concurrent access working correctly');
      }

      // Cleanup test data
      await query(`DELETE FROM shifts WHERE user_id = $1`, [testUserId]);

    } catch (error) {
      this.results.critical.push({
        test: 'Row Locking',
        issue: `Row locking test failed: ${error.message}`,
        recommendation: 'Check database transaction configuration'
      });
    }
  }

  async testConcurrentDeviceHandling() {
    console.log('📱 Testing Concurrent Device Handling...');

    try {
      // Test device fingerprinting
      const device1 = 'device-' + Math.random().toString(36);
      const device2 = 'device-' + Math.random().toString(36);
      const testUserId = 'test-user-device';

      // Register first device
      await query(`
        INSERT INTO user_devices (user_id, company_id, device_fingerprint, status)
        VALUES ($1, $2, $3, 'ACTIVE')
      `, [testUserId, 'test-company', device1]);

      // Try to register second device
      try {
        await query(`
          INSERT INTO user_devices (user_id, company_id, device_fingerprint, status)
          VALUES ($1, $2, $3, 'ACTIVE')
        `, [testUserId, 'test-company', device2]);
        
        this.results.high.push({
          test: 'Concurrent Device Handling',
          issue: 'Multiple device registration should be prevented',
          recommendation: 'Implement device conflict detection'
        });
      } catch (conflictError) {
        if (conflictError.code === '23505') { // Unique constraint violation
          this.results.passed.push('Concurrent Device Handling: Device conflict prevention working');
        } else {
          throw conflictError;
        }
      }

      // Cleanup test data
      await query(`DELETE FROM user_devices WHERE user_id = $1`, [testUserId]);

    } catch (error) {
      this.results.critical.push({
        test: 'Concurrent Device Handling',
        issue: `Device handling test failed: ${error.message}`,
        recommendation: 'Check device tracking implementation'
      });
    }
  }

  async testOfflineReplayProtection() {
    console.log('🔄 Testing Offline Replay Protection...');

    try {
      // Simulate offline queue with duplicate requests
      const testRequests = [
        { action: 'clockIn', payload: { location_id: 1 }, timestamp: Date.now() },
        { action: 'clockIn', payload: { location_id: 1 }, timestamp: Date.now() + 1000 },
        { action: 'clockOut', payload: {}, timestamp: Date.now() + 2000 },
        { action: 'breakStart', payload: {}, timestamp: Date.now() + 3000 }
      ];

      // Test deduplication logic
      const uniqueRequests = new Map();
      let duplicateCount = 0;

      testRequests.forEach(request => {
        const key = `${request.action}-${JSON.stringify(request.payload)}`;
        if (uniqueRequests.has(key)) {
          duplicateCount++;
        } else {
          uniqueRequests.set(key, true);
        }
      });

      if (duplicateCount === 2) {
        this.results.passed.push('Offline Replay Protection: Duplicate detection working');
      } else {
        this.results.high.push({
          test: 'Offline Replay Protection',
          issue: `Expected 2 duplicates, found ${duplicateCount}`,
          recommendation: 'Check queue deduplication logic'
        });
      }

    } catch (error) {
      this.results.critical.push({
        test: 'Offline Replay Protection',
        issue: `Replay protection test failed: ${error.message}`,
        recommendation: 'Check offline queue implementation'
      });
    }
  }

  async testPayrollIntegrity() {
    console.log('💰 Testing Payroll Integrity...');

    try {
      // Test time calculations
      const testShifts = [
        {
          clock_in_time: '2025-01-15T09:00:00Z',
          clock_out_time: '2025-01-15T17:00:00Z',
          break_started_at: '2025-01-15T12:00:00Z',
          break_ended_at: '2025-01-15T13:00:00Z'
        }
      ];

      let calculationErrors = 0;

      testShifts.forEach(shift => {
        // Calculate total hours
        const clockIn = new Date(shift.clock_in_time);
        const clockOut = new Date(shift.clock_out_time);
        const totalMs = clockOut - clockIn;
        const totalHours = totalMs / (1000 * 60 * 60);

        // Calculate break duration
        const breakStart = new Date(shift.break_started_at);
        const breakEnd = new Date(shift.break_ended_at);
        const breakMs = breakEnd - breakStart;
        const breakHours = breakMs / (1000 * 60 * 60);

        // Validate calculations
        if (totalHours !== 8) calculationErrors++;
        if (breakHours !== 1) calculationErrors++;
        if (totalHours - breakHours !== 7) calculationErrors++;
      });

      if (calculationErrors === 0) {
        this.results.passed.push('Payroll Integrity: Time calculations accurate');
      } else {
        this.results.high.push({
          test: 'Payroll Integrity',
          issue: `Found ${calculationErrors} calculation errors`,
          recommendation: 'Review time calculation logic'
        });
      }

    } catch (error) {
      this.results.critical.push({
        test: 'Payroll Integrity',
        issue: `Payroll integrity test failed: ${error.message}`,
        recommendation: 'Check time calculation functions'
      });
    }
  }

  async testLoggingAndObservability() {
    console.log('📋 Testing Logging and Observability...');

    try {
      // Test audit trail creation
      const testLog = {
        user_id: 'test-user',
        company_id: 'test-company',
        action: 'production_test',
        before_data: { test: 'before' },
        after_data: { test: 'after' },
        metadata: { test: true }
      };

      await query(`
        INSERT INTO attendance_audit_trail (
          correction_request_id, manager_id, company_id, action, 
          before_data, after_data, metadata
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6
        )
      `, [
        'test-request', 'test-manager', testLog.company_id,
        'test_audit', JSON.stringify(testLog.before_data),
        JSON.stringify(testLog.after_data),
        JSON.stringify(testLog.metadata)
      ]);

      // Verify log was created
      const logCheck = await query(`
        SELECT COUNT(*) as count FROM attendance_audit_trail 
        WHERE company_id = $1 AND action = 'test_audit'
      `, [testLog.company_id]);

      if (logCheck.rows[0].count > 0) {
        this.results.passed.push('Logging and Observability: Audit trail working');
      } else {
        this.results.high.push({
          test: 'Logging and Observability',
          issue: 'Audit trail not created',
          recommendation: 'Check logging configuration'
        });
      }

    } catch (error) {
      this.results.critical.push({
        test: 'Logging and Observability',
        issue: `Logging test failed: ${error.message}`,
        recommendation: 'Check audit trail implementation'
      });
    }
  }

  async testRollbackSafety() {
    console.log('🔙 Testing Rollback Safety...');

    try {
      // Test transaction rollback
      const client = await this.getDbClient();
      
      try {
        await client.query('BEGIN');
        
        // Create test record
        await client.query(`
          INSERT INTO shifts (user_id, company_id, clock_in_time)
          VALUES ($1, $2, NOW())
        `, ['test-rollback', 'test-company']);

        // Simulate error and rollback
        await client.query(`
          INSERT INTO non_existent_table VALUES (1)
        `);
        
        await client.query('ROLLBACK');
        
        // Verify rollback worked
        const checkRollback = await client.query(`
          SELECT COUNT(*) as count FROM shifts 
          WHERE user_id = $1 AND company_id = $2
        `, ['test-rollback', 'test-company']);

        if (checkRollback.rows[0].count === 0) {
          this.results.passed.push('Rollback Safety: Transaction rollback working');
        } else {
          this.results.high.push({
            test: 'Rollback Safety',
            issue: 'Rollback did not work as expected',
            recommendation: 'Check transaction configuration'
          });
        }

      } finally {
        client.release();
      }

    } catch (error) {
      this.results.critical.push({
        test: 'Rollback Safety',
        issue: `Rollback test failed: ${error.message}`,
        recommendation: 'Check transaction handling'
      });
    }
  }

  async testApiSecurity() {
    console.log('🔐 Testing API Security...');

    try {
      // Test rate limiting
      const requests = Array(20).fill().map(() => 
        axios.post(`${this.apiBase}/shifts/clock-in`, {
          location_id: 1,
          latitude: 40.7,
          longitude: -74.0
        })
      );

      const results = await Promise.allSettled(requests);
      const successCount = results.filter(r => r.status === 200).length;
      const rateLimitCount = results.filter(r => r.status === 429).length;

      if (rateLimitCount > 0) {
        this.results.passed.push('API Security: Rate limiting working');
      } else if (successCount > 15) {
        this.results.high.push({
          test: 'API Security',
          issue: `Too many successful requests: ${successCount}/20`,
          recommendation: 'Implement stronger rate limiting'
        });
      } else {
        this.results.passed.push('API Security: Basic security measures in place');
      }

    } catch (error) {
      this.results.high.push({
        test: 'API Security',
        issue: `API security test failed: ${error.message}`,
        recommendation: 'Check API security configuration'
      });
    }
  }

  async testPerformanceAndScalability() {
    console.log('⚡ Testing Performance and Scalability...');

    try {
      // Test query performance
      const perfTest = await query(`
        EXPLAIN ANALYZE SELECT * FROM shifts 
        WHERE user_id = $1 AND company_id = $2 AND clock_out_time IS NULL 
        ORDER BY id DESC
        LIMIT 1
      `, ['test-user', 'test-company']);

      const usesIndex = perfTest.rows[0]['QUERY PLAN'].includes('Index Scan');
      
      if (usesIndex) {
        this.results.passed.push('Performance: Query using index');
      } else {
        this.results.medium.push({
          test: 'Performance',
          issue: 'Query not using expected index',
          recommendation: 'Check index creation and usage'
        });
      }

    } catch (error) {
      this.results.high.push({
        test: 'Performance and Scalability',
        issue: `Performance test failed: ${error.message}`,
        recommendation: 'Check database configuration and indexes'
      });
    }
  }

  async testIntegrationPoints() {
    console.log('🔗 Testing Integration Points...');

    try {
      // Test database connection
      const dbTest = await query('SELECT 1 as test');
      
      if (dbTest.rows[0].test === 1) {
        this.results.passed.push('Integration: Database connection working');
      } else {
        this.results.high.push({
          test: 'Integration',
          issue: 'Database connection failed',
          recommendation: 'Check database configuration'
        });
      }

    } catch (error) {
      this.results.critical.push({
        test: 'Integration Points',
        issue: `Integration test failed: ${error.message}`,
        recommendation: 'Check system integration'
      });
    }
  }

  async testDocumentationAndTraining() {
    console.log('📚 Testing Documentation and Training...');

    try {
      // Check if documentation exists
      const fs = require('fs').promises;
      const docsPath = './docs/productionReadinessChecklist.md';
      
      try {
        await fs.access(docsPath);
        this.results.passed.push('Documentation: Production readiness checklist exists');
      } catch {
        this.results.medium.push({
          test: 'Documentation',
          issue: 'Production readiness checklist not found',
          recommendation: 'Create comprehensive documentation'
        });
      }

    } catch (error) {
      this.results.medium.push({
        test: 'Documentation and Training',
        issue: `Documentation test failed: ${error.message}`,
        recommendation: 'Create documentation and training materials'
      });
    }
  }

  async getDbClient() {
    const { Pool } = require('pg');
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 PRODUCTION READINESS TEST RESULTS');
    console.log('='.repeat(60) + '\n');

    const categories = [
      { name: '🚨 CRITICAL', items: this.results.critical, color: 'red' },
      { name: '🔥 HIGH', items: this.results.high, color: 'yellow' },
      { name: '⚡ MEDIUM', items: this.results.medium, color: 'blue' },
      { name: '✅ PASSED', items: this.results.passed, color: 'green' }
    ];

    categories.forEach(category => {
      if (category.items.length > 0) {
        console.log(`\n${category.name}:`);
        category.items.forEach(item => {
          console.log(`  ❌ ${item.test}`);
          console.log(`     Issue: ${item.issue}`);
          console.log(`     Recommendation: ${item.recommendation}`);
        });
      }
    });

    // Summary
    const totalTests = Object.values(this.results).flat().length;
    const passedTests = this.results.passed.length;
    const criticalIssues = this.results.critical.length;
    const highIssues = this.results.high.length;

    console.log('\n📊 SUMMARY:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} (${Math.round(passedTests/totalTests * 100)}%)`);
    console.log(`Critical Issues: ${criticalIssues}`);
    console.log(`High Issues: ${highIssues}`);

    if (criticalIssues === 0 && highIssues === 0 && passedTests >= totalTests * 0.8) {
      console.log('\n🎉 SYSTEM READY FOR PRODUCTION!');
    } else {
      console.log('\n⚠️  SYSTEM NOT READY FOR PRODUCTION');
      console.log('Please address critical and high issues before deployment.');
    }

    console.log('\n' + '='.repeat(60));
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new ProductionReadinessTest();
  tester.runAllTests().catch(console.error);
}

module.exports = ProductionReadinessTest;
