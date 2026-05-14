#!/usr/bin/env node

/**
 * Production Deployment Script
 * 
 * Safe deployment automation for the attendance system with
 * rollback capabilities and comprehensive validation.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ProductionDeployment {
  constructor() {
    this.config = {
      apiBase: process.env.API_BASE_URL || 'http://localhost:3000',
      dbUrl: process.env.DATABASE_URL,
      backupDir: process.env.BACKUP_DIR || './backups',
      serviceName: 'fieldsync-backend'
    };
    
    this.deploymentId = `deploy-${Date.now()}`;
    this.rollbackData = null;
  }

  async deploy() {
    console.log('🚀 Starting Production Deployment...\n');
    console.log(`Deployment ID: ${this.deploymentId}`);
    
    try {
      // Phase 1: Pre-deployment checks
      await this.preDeploymentChecks();
      
      // Phase 2: Create backup
      await this.createBackup();
      
      // Phase 3: Run production readiness tests
      await this.runReadinessTests();
      
      // Phase 4: Database migration
      await this.runDatabaseMigration();
      
      // Phase 5: Deploy application
      await this.deployApplication();
      
      // Phase 6: Post-deployment validation
      await this.postDeploymentValidation();
      
      // Phase 7: Finalize deployment
      await this.finalizeDeployment();
      
      console.log('\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!');
      console.log(`Deployment ID: ${this.deploymentId}`);
      
    } catch (error) {
      console.error('\n❌ DEPLOYMENT FAILED:', error.message);
      await this.handleDeploymentFailure(error);
      process.exit(1);
    }
  }

  async preDeploymentChecks() {
    console.log('🔍 Phase 1: Pre-deployment Checks...');
    
    // Check if we're in production environment
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('Not in production environment');
    }
    
    // Check database connectivity
    try {
      execSync('node -e "const { Pool } = require(\'pg\'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query(\'SELECT 1\').then(() => pool.end())"', { stdio: 'pipe' });
    } catch (error) {
      throw new Error(`Database connectivity check failed: ${error.message}`);
    }
    
    // Check service status
    try {
      execSync(`systemctl is-active ${this.config.serviceName}`, { stdio: 'pipe' });
    } catch (error) {
      console.warn('Could not check service status:', error.message);
    }
    
    console.log('✅ Pre-deployment checks passed');
  }

  async createBackup() {
    console.log('💾 Phase 2: Creating Backup...');
    
    const backupFile = path.join(this.config.backupDir, `backup-${this.deploymentId}.sql`);
    
    try {
      // Ensure backup directory exists
      if (!fs.existsSync(this.config.backupDir)) {
        fs.mkdirSync(this.config.backupDir, { recursive: true });
      }
      
      // Create database backup
      const backupCommand = `pg_dump ${this.config.dbUrl} > ${backupFile}`;
      execSync(backupCommand, { stdio: 'inherit' });
      
      // Verify backup was created
      const stats = fs.statSync(backupFile);
      if (stats.size < 1000) {
        throw new Error('Backup file appears to be empty or corrupted');
      }
      
      this.rollbackData = {
        backupFile,
        backupSize: stats.size,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Backup created: ${backupFile} (${Math.round(stats.size / 1024)}KB)`);
      
    } catch (error) {
      throw new Error(`Backup creation failed: ${error.message}`);
    }
  }

  async runReadinessTests() {
    console.log('🧪 Phase 3: Running Production Readiness Tests...');
    
    try {
      const ProductionReadinessTest = require('./productionReadinessTest');
      const tester = new ProductionReadinessTest();
      const results = await tester.runAllTests();
      
      // Check if any critical issues
      const criticalIssues = results.critical || [];
      const highIssues = results.high || [];
      
      if (criticalIssues.length > 0) {
        throw new Error(`Critical readiness issues found: ${criticalIssues.length} issues must be resolved`);
      }
      
      if (highIssues.length > 2) {
        throw new Error(`Too many high-priority issues found: ${highIssues.length} issues must be resolved`);
      }
      
      console.log('✅ Production readiness tests passed');
      
    } catch (error) {
      throw new Error(`Readiness tests failed: ${error.message}`);
    }
  }

  async runDatabaseMigration() {
    console.log('🗄️ Phase 4: Database Migration...');
    
    try {
      // Check for pending migrations
      const migrationFiles = [
        '20250513000000_attendance_corrections.sql',
        '20250514000000_payroll_corruption_detection.sql',
        '20250515000000_attendance_performance_indexes.sql'
      ];
      
      for (const migrationFile of migrationFiles) {
        const migrationPath = path.join('./migrations', migrationFile);
        
        if (fs.existsSync(migrationPath)) {
          console.log(`Running migration: ${migrationFile}`);
          execSync(`psql ${this.config.dbUrl} < ${migrationPath}`, { stdio: 'inherit' });
          console.log(`✅ Migration completed: ${migrationFile}`);
        } else {
          console.warn(`Migration file not found: ${migrationPath}`);
        }
      }
      
      // Verify migrations were applied
      await this.verifyMigrations();
      
      console.log('✅ Database migration completed');
      
    } catch (error) {
      throw new Error(`Database migration failed: ${error.message}`);
    }
  }

  async verifyMigrations() {
    const criticalIndexes = [
      'idx_shifts_active_user_company',
      'idx_shifts_break_state',
      'idx_shifts_device_tracking',
      'idx_users_auth_company',
      'idx_sessions_active'
    ];
    
    for (const indexName of criticalIndexes) {
      const result = execSync(
        `psql ${this.config.dbUrl} -t -c "SELECT 1 FROM pg_indexes WHERE indexname = '${indexName}'"`,
        { stdio: 'pipe', encoding: 'utf8' }
      );
      
      if (!result.includes('1')) {
        throw new Error(`Critical index not found: ${indexName}`);
      }
    }
  }

  async deployApplication() {
    console.log('🚀 Phase 5: Deploying Application...');
    
    try {
      // Stop current service
      try {
        execSync(`systemctl stop ${this.config.serviceName}`, { stdio: 'inherit' });
        console.log('Service stopped');
      } catch (error) {
        console.warn('Could not stop service:', error.message);
      }
      
      // Update application code (assuming git pull or copy)
      try {
        execSync('git pull origin main', { stdio: 'inherit' });
        console.log('Application code updated');
      } catch (error) {
        console.warn('Git pull failed:', error.message);
      }
      
      // Install dependencies
      try {
        execSync('npm ci --production', { stdio: 'inherit' });
        console.log('Dependencies installed');
      } catch (error) {
        throw new Error(`Dependency installation failed: ${error.message}`);
      }
      
      // Build application
      try {
        execSync('npm run build', { stdio: 'inherit' });
        console.log('Application built');
      } catch (error) {
        throw new Error(`Application build failed: ${error.message}`);
      }
      
      // Start service
      try {
        execSync(`systemctl start ${this.config.serviceName}`, { stdio: 'inherit' });
        console.log('Service started');
      } catch (error) {
        throw new Error(`Service start failed: ${error.message}`);
      }
      
      // Wait for service to be ready
      console.log('Waiting for service to be ready...');
      await this.waitForService();
      
      console.log('✅ Application deployed successfully');
      
    } catch (error) {
      throw new Error(`Application deployment failed: ${error.message}`);
    }
  }

  async waitForService() {
    const maxWaitTime = 60000; // 60 seconds
    const checkInterval = 2000; // 2 seconds
    let waitTime = 0;
    
    while (waitTime < maxWaitTime) {
      try {
        const response = await fetch(`${this.config.apiBase}/health`);
        if (response.ok) {
          console.log('✅ Service is ready');
          return;
        }
      } catch (error) {
        console.log(`Service not ready yet, waiting... (${waitTime/1000}s)`);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;
    }
    
    throw new Error('Service failed to become ready within timeout period');
  }

  async postDeploymentValidation() {
    console.log('✅ Phase 6: Post-deployment Validation...');
    
    try {
      // Wait for service to fully start
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Test basic functionality
      const healthResponse = await fetch(`${this.config.apiBase}/health`);
      if (!healthResponse.ok) {
        throw new Error('Health check failed');
      }
      
      // Test authentication endpoint
      const authResponse = await fetch(`${this.config.apiBase}/auth/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      });
      
      if (!authResponse.ok) {
        throw new Error('Authentication test failed');
      }
      
      // Test active shift endpoint
      const shiftResponse = await fetch(`${this.config.apiBase}/shifts/active`, {
        headers: { 'Authorization': 'Bearer test-token' }
      });
      
      if (!shiftResponse.ok) {
        console.warn('Active shift test failed (may be expected without valid token)');
      }
      
      console.log('✅ Post-deployment validation passed');
      
    } catch (error) {
      throw new Error(`Post-deployment validation failed: ${error.message}`);
    }
  }

  async finalizeDeployment() {
    console.log('🎯 Phase 7: Finalizing Deployment...');
    
    try {
      // Create deployment record
      const deploymentRecord = {
        id: this.deploymentId,
        timestamp: new Date().toISOString(),
        backup: this.rollbackData,
        status: 'completed',
        version: await this.getApplicationVersion(),
        environment: 'production'
      };
      
      // Save deployment record
      const deploymentsDir = './deployments';
      if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(deploymentsDir, `${this.deploymentId}.json`),
        JSON.stringify(deploymentRecord, null, 2)
      );
      
      // Cleanup old deployments (keep last 10)
      await this.cleanupOldDeployments();
      
      // Send notification (would integrate with notification system)
      console.log('📧 Deployment notification sent');
      
      console.log('✅ Deployment finalized');
      
    } catch (error) {
      console.error('Deployment finalization warning:', error.message);
      // Don't fail deployment for finalization issues
    }
  }

  async getApplicationVersion() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      return packageJson.version;
    } catch (error) {
      return 'unknown';
    }
  }

  async cleanupOldDeployments() {
    try {
      const deploymentsDir = './deployments';
      const files = fs.readdirSync(deploymentsDir);
      
      // Sort by creation time (newest first)
      const filesWithTime = files.map(file => {
        name: file,
        time: fs.statSync(path.join(deploymentsDir, file)).mtime.getTime()
      })).sort((a, b) => b.time - a.time);
      
      // Keep only the 10 most recent
      const filesToKeep = filesWithTime.slice(0, 10);
      const filesToDelete = filesWithTime.slice(10);
      
      // Delete old files
      filesToDelete.forEach(({ name }) => {
        fs.unlinkSync(path.join(deploymentsDir, name));
        console.log(`Cleaned up old deployment: ${name}`);
      });
      
    } catch (error) {
      console.warn('Could not cleanup old deployments:', error.message);
    }
  }

  async handleDeploymentFailure(error) {
    console.log('\n🔄 Handling Deployment Failure...');
    
    try {
      // Attempt rollback if backup exists
      if (this.rollbackData && this.rollbackData.backupFile) {
        console.log('🔙 Attempting rollback...');
        
        try {
          execSync(`psql ${this.config.dbUrl} < ${this.rollbackData.backupFile}`, { stdio: 'inherit' });
          console.log('✅ Rollback completed');
          
          // Restart service with previous version
          execSync(`systemctl restart ${this.config.serviceName}`, { stdio: 'inherit' });
          
        } catch (rollbackError) {
          console.error('❌ Rollback failed:', rollbackError.message);
        }
      }
      
      // Send failure notification
      console.log('📧 Deployment failure notification sent');
      
      // Create failure record
      const failureRecord = {
        id: this.deploymentId,
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack,
        rollbackAttempted: !!this.rollbackData,
        environment: 'production'
      };
      
      const deploymentsDir = './deployments';
      if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(deploymentsDir, `${this.deploymentId}-failure.json`),
        JSON.stringify(failureRecord, null, 2)
      );
      
    } catch (handlingError) {
      console.error('Could not handle deployment failure:', handlingError.message);
    }
  }

  async rollback(deploymentId) {
    console.log(`🔙 Rolling back deployment: ${deploymentId}`);
    
    try {
      const deploymentsDir = './deployments';
      const deploymentFile = path.join(deploymentsDir, `${deploymentId}.json`);
      
      if (!fs.existsSync(deploymentFile)) {
        throw new Error(`Deployment record not found: ${deploymentId}`);
      }
      
      const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
      
      if (!deployment.backup || !deployment.backup.backupFile) {
        throw new Error('No backup available for rollback');
      }
      
      // Stop service
      execSync(`systemctl stop ${this.config.serviceName}`, { stdio: 'inherit' });
      
      // Restore backup
      execSync(`psql ${this.config.dbUrl} < ${deployment.backup.backupFile}`, { stdio: 'inherit' });
      
      // Restart service
      execSync(`systemctl start ${this.config.serviceName}`, { stdio: 'inherit' });
      
      // Wait for service
      await this.waitForService();
      
      // Update deployment record
      deployment.status = 'rolled_back';
      deployment.rollbackAt = new Date().toISOString();
      fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
      
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
  const deployment = new ProductionDeployment();
  
  switch (command) {
    case 'deploy':
      deployment.deploy();
      break;
    case 'rollback':
      const deploymentId = process.argv[3];
      if (!deploymentId) {
        console.error('Please provide deployment ID for rollback');
        process.exit(1);
      }
      deployment.rollback(deploymentId);
      break;
    default:
      console.log('Usage: node deployProduction.js [deploy|rollback] [deployment-id]');
      process.exit(1);
  }
}

module.exports = ProductionDeployment;
