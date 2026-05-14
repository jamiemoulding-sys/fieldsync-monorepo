#!/usr/bin/env node

/**
 * Simplified Attendance System Deployment
 * 
 * Deploy the refactored attendance system with minimal complexity
 * and maximum safety.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class SimplifiedDeployment {
  constructor() {
    this.deploymentId = `simplified-${Date.now()}`;
    this.backupDir = './backups';
    this.startTime = Date.now();
  }

  async deploy() {
    console.log('🚀 Deploying Simplified Attendance System...');
    console.log(`Deployment ID: ${this.deploymentId}\n`);

    try {
      // Phase 1: Pre-deployment checks
      await this.preDeploymentChecks();
      
      // Phase 2: Create backup
      await this.createBackup();
      
      // Phase 3: Deploy simplified schema
      await this.deploySchema();
      
      // Phase 4: Deploy application
      await this.deployApplication();
      
      // Phase 5: Validate deployment
      await this.validateDeployment();
      
      // Phase 6: Cleanup old files
      await this.cleanup();
      
      const duration = (Date.now() - this.startTime) / 1000;
      console.log(`\n✅ Simplified deployment completed in ${duration}s`);
      console.log(`Deployment ID: ${this.deploymentId}`);
      
    } catch (error) {
      console.error('\n❌ Deployment failed:', error.message);
      await this.handleFailure(error);
      process.exit(1);
    }
  }

  async preDeploymentChecks() {
    console.log('🔍 Pre-deployment checks...');
    
    // Check environment
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('Not in production environment');
    }
    
    // Check database connectivity
    try {
      execSync('node -e "require(\'./database/connection\').query(\'SELECT 1\')"', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('Database connectivity check failed');
    }
    
    // Check required files exist
    const requiredFiles = [
      './services/attendanceCore.js',
      './routes/attendance.js',
      './migrations/20250516000000_simplified_attendance.sql'
    ];
    
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }
    
    console.log('✅ Pre-deployment checks passed');
  }

  async createBackup() {
    console.log('💾 Creating backup...');
    
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    const backupFile = path.join(this.backupDir, `backup-${this.deploymentId}.sql`);
    
    try {
      execSync(`pg_dump ${process.env.DATABASE_URL} > ${backupFile}`, { stdio: 'inherit' });
      
      const stats = fs.statSync(backupFile);
      if (stats.size < 1000) {
        throw new Error('Backup file appears to be empty');
      }
      
      console.log(`✅ Backup created: ${backupFile}`);
    } catch (error) {
      throw new Error(`Backup creation failed: ${error.message}`);
    }
  }

  async deploySchema() {
    console.log('🗄️ Deploying simplified schema...');
    
    const migrationFile = './migrations/20250516000000_simplified_attendance.sql';
    
    try {
      console.log('Running migration...');
      execSync(`psql ${process.env.DATABASE_URL} < ${migrationFile}`, { stdio: 'inherit' });
      
      // Verify schema deployment
      await this.verifySchema();
      
      console.log('✅ Schema deployed successfully');
    } catch (error) {
      throw new Error(`Schema deployment failed: ${error.message}`);
    }
  }

  async verifySchema() {
    const { query } = require('./database/connection');
    
    // Check core tables exist
    const tables = ['shifts', 'attendance_audit_trail', 'user_sessions', 'user_devices'];
    
    for (const table of tables) {
      const result = await query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_name = $1 AND table_schema = 'public'
      `, [table]);
      
      if (result.rows[0].count === 0) {
        throw new Error(`Table not found: ${table}`);
      }
    }
    
    // Check critical indexes exist
    const indexes = [
      'idx_shifts_active_user',
      'idx_shifts_break_state',
      'idx_shifts_device',
      'idx_audit_company_time'
    ];
    
    for (const index of indexes) {
      const result = await query(`
        SELECT COUNT(*) as count 
        FROM pg_indexes 
        WHERE indexname = $1 AND schemaname = 'public'
      `, [index]);
      
      if (result.rows[0].count === 0) {
        throw new Error(`Index not found: ${index}`);
      }
    }
  }

  async deployApplication() {
    console.log('🚀 Deploying application...');
    
    try {
      // Stop service
      try {
        execSync('systemctl stop fieldsync-backend', { stdio: 'pipe' });
        console.log('Service stopped');
      } catch (error) {
        console.warn('Could not stop service:', error.message);
      }
      
      // Update code
      try {
        execSync('git pull origin main', { stdio: 'pipe' });
        console.log('Code updated');
      } catch (error) {
        console.warn('Git pull failed:', error.message);
      }
      
      // Install dependencies
      execSync('npm ci --production', { stdio: 'inherit' });
      console.log('Dependencies installed');
      
      // Start service
      execSync('systemctl start fieldsync-backend', { stdio: 'pipe' });
      console.log('Service started');
      
      // Wait for service to be ready
      await this.waitForService();
      
      console.log('✅ Application deployed successfully');
    } catch (error) {
      throw new Error(`Application deployment failed: ${error.message}`);
    }
  }

  async waitForService() {
    const maxWait = 60000; // 60 seconds
    const interval = 2000; // 2 seconds
    let waitTime = 0;
    
    while (waitTime < maxWait) {
      try {
        const response = await fetch('http://localhost:3000/attendance/health');
        if (response.ok) {
          console.log('✅ Service is ready');
          return;
        }
      } catch (error) {
        console.log(`Waiting for service... (${waitTime/1000}s)`);
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
      waitTime += interval;
    }
    
    throw new Error('Service failed to become ready');
  }

  async validateDeployment() {
    console.log('✅ Validating deployment...');
    
    try {
      // Test health endpoint
      const healthResponse = await fetch('http://localhost:3000/attendance/health');
      if (!healthResponse.ok) {
        throw new Error('Health check failed');
      }
      
      const healthData = await healthResponse.json();
      console.log('Health check:', healthData.status);
      
      // Test database functions
      const { query } = require('./database/connection');
      const healthCheck = await query('SELECT * FROM attendance_system_health()');
      console.log('System health metrics:', healthCheck.rows.length);
      
      // Test core functionality
      const testResult = await this.testCoreFunctionality();
      if (!testResult.success) {
        throw new Error(`Core functionality test failed: ${testResult.error}`);
      }
      
      console.log('✅ Deployment validation passed');
    } catch (error) {
      throw new Error(`Deployment validation failed: ${error.message}`);
    }
  }

  async testCoreFunctionality() {
    try {
      const { AttendanceCore } = require('./services/attendanceCore');
      const core = new AttendanceCore();
      
      // Test state retrieval
      const state = await core.getState('test-user', 'test-company');
      
      // Test payroll validation
      const validation = await core.validatePayrollIntegrity('test-shift-id');
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');
    
    try {
      // Remove old complex files
      const filesToRemove = [
        './services/attendanceStateMachine.js',
        './services/attendanceLogger.js',
        './services/payrollCorruptionDetector.js',
        './middleware/attendanceStateMiddleware.js',
        './middleware/attendanceLoggingMiddleware.js',
        './routes/shifts-enhanced.js',
        './routes/shifts-logged.js',
        './routes/attendanceDashboard.js'
      ];
      
      for (const file of filesToRemove) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`Removed: ${file}`);
        }
      }
      
      // Remove old migrations
      const migrationsToRemove = [
        './migrations/20250512000000_attendance_logs.sql',
        './migrations/20250513000000_attendance_corrections.sql',
        './migrations/20250514000000_payroll_corruption_detection.sql',
        './migrations/20250515000000_attendance_performance_indexes.sql'
      ];
      
      for (const migration of migrationsToRemove) {
        if (fs.existsSync(migration)) {
          fs.unlinkSync(migration);
          console.log(`Removed: ${migration}`);
        }
      }
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }

  async handleFailure(error) {
    console.log('\n🔄 Handling deployment failure...');
    
    try {
      const backupFile = path.join(this.backupDir, `backup-${this.deploymentId}.sql`);
      
      if (fs.existsSync(backupFile)) {
        console.log('🔙 Rolling back to backup...');
        execSync(`psql ${process.env.DATABASE_URL} < ${backupFile}`, { stdio: 'inherit' });
        console.log('✅ Rollback completed');
      }
      
      // Restart service
      try {
        execSync('systemctl restart fieldsync-backend', { stdio: 'pipe' });
        console.log('Service restarted');
      } catch (restartError) {
        console.warn('Service restart failed:', restartError.message);
      }
      
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError.message);
    }
  }

  async rollback(deploymentId) {
    console.log(`🔙 Rolling back deployment: ${deploymentId}`);
    
    try {
      const backupFile = path.join(this.backupDir, `backup-${deploymentId}.sql`);
      
      if (!fs.existsSync(backupFile)) {
        throw new Error('Backup file not found');
      }
      
      // Stop service
      execSync('systemctl stop fieldsync-backend', { stdio: 'pipe' });
      
      // Restore backup
      execSync(`psql ${process.env.DATABASE_URL} < ${backupFile}`, { stdio: 'inherit' });
      
      // Start service
      execSync('systemctl start fieldsync-backend', { stdio: 'pipe' });
      
      // Wait for service
      await this.waitForService();
      
      console.log('✅ Rollback completed successfully');
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      throw error;
    }
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const deployment = new SimplifiedDeployment();
  
  switch (command) {
    case 'deploy':
      deployment.deploy();
      break;
    case 'rollback':
      const deploymentId = process.argv[3];
      if (!deploymentId) {
        console.error('Please provide deployment ID');
        process.exit(1);
      }
      deployment.rollback(deploymentId);
      break;
    default:
      console.log('Usage: node deploySimplified.js [deploy|rollback] [deployment-id]');
      process.exit(1);
  }
}

module.exports = SimplifiedDeployment;
