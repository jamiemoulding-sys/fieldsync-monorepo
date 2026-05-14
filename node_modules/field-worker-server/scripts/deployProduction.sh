#!/bin/bash

# Production Deployment Script
# For single-region attendance system with horizontal API scaling

set -e

# Configuration
REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-production}"
PROJECT_NAME="${PROJECT_NAME:-fieldsync-attendance}"
DOMAIN="${DOMAIN:-api.fieldsync.com}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed"
        exit 1
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Build application
build_application() {
    log_info "Building application..."
    
    # Create build directory
    mkdir -p build
    
    # Create tar.gz file
    tar -czf build/attendance-api.tar.gz \
        --exclude=.git \
        --exclude=node_modules \
        --exclude=build \
        --exclude=terraform \
        --exclude=k8s \
        --exclude=scripts \
        --exclude=docs \
        --exclude=*.log \
        .
    
    log_success "Application built successfully"
}

# Deploy infrastructure
deploy_infrastructure() {
    log_info "Deploying infrastructure with Terraform..."
    
    cd terraform
    
    # Initialize Terraform
    terraform init -input=false
    
    # Plan deployment
    terraform plan -input=false -out=tfplan
    
    # Apply deployment
    terraform apply -input=false -auto-approve tfplan
    
    # Get outputs
    ALB_DNS=$(terraform output -raw alb_dns_name)
    RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
    REDIS_ENDPOINT=$(terraform output -raw redis_endpoint)
    API_ASG_NAME=$(terraform output -raw api_asg_name)
    
    cd ..
    
    log_success "Infrastructure deployed successfully"
    log_info "ALB DNS: $ALB_DNS"
    log_info "RDS Endpoint: $RDS_ENDPOINT"
    log_info "Redis Endpoint: $REDIS_ENDPOINT"
}

# Configure DNS
configure_dns() {
    log_info "Configuring DNS..."
    
    # Get hosted zone ID
    ZONE_ID=$(aws route53 list-hosted-zones \
        --query "HostedZones[?Name=='${DOMAIN}.'].Id" \
        --output text)
    
    if [ -z "$ZONE_ID" ]; then
        log_error "Hosted zone not found for $DOMAIN"
        exit 1
    fi
    
    # Create A record
    aws route53 change-resource-record-sets \
        --hosted-zone-id "$ZONE_ID" \
        --change-batch '{
            "Comment": "Create A record for API",
            "Changes": [
                {
                    "Action": "UPSERT",
                    "ResourceRecordSet": {
                        "Name": "'$DOMAIN'",
                        "Type": "A",
                        "TTL": 60,
                        "ResourceRecords": [
                            {
                                "Value": "'$(dig +short $ALB_DNS | head -1)'"
                            }
                        ]
                    }
                }
            ]
        }'
    
    log_success "DNS configured successfully"
}

# Deploy application to Kubernetes
deploy_kubernetes() {
    log_info "Deploying application to Kubernetes..."
    
    # Create namespace
    kubectl create namespace attendance --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply secrets
    kubectl apply -f k8s/deployment.yaml
    
    # Wait for deployment
    kubectl rollout status deployment/attendance-api -n attendance --timeout=600s
    
    # Check pod status
    kubectl get pods -n attendance -l app=attendance-api
    
    log_success "Kubernetes deployment completed"
}

# Run health checks
run_health_checks() {
    log_info "Running health checks..."
    
    # Wait for ALB to be ready
    log_info "Waiting for ALB to be ready..."
    for i in {1..30}; do
        if curl -f -s "https://$DOMAIN/health" > /dev/null; then
            log_success "ALB is ready"
            break
        fi
        sleep 10
        if [ $i -eq 30 ]; then
            log_error "ALB not ready after 5 minutes"
            exit 1
        fi
    done
    
    # Check API health
    log_info "Checking API health..."
    HEALTH_RESPONSE=$(curl -s "https://$DOMAIN/health")
    if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
        log_success "API health check passed"
    else
        log_error "API health check failed"
        log_error "Response: $HEALTH_RESPONSE"
        exit 1
    fi
    
    # Check database connectivity
    log_info "Checking database connectivity..."
    DB_HEALTH=$(curl -s "https://$DOMAIN/health" | jq -r '.checks.database')
    if [ "$DB_HEALTH" = "ok" ]; then
        log_success "Database connectivity check passed"
    else
        log_error "Database connectivity check failed"
        exit 1
    fi
    
    # Check Redis connectivity
    log_info "Checking Redis connectivity..."
    REDIS_HEALTH=$(curl -s "https://$DOMAIN/health" | jq -r '.checks.redis')
    if [ "$REDIS_HEALTH" = "ok" ]; then
        log_success "Redis connectivity check passed"
    else
        log_error "Redis connectivity check failed"
        exit 1
    fi
    
    log_success "All health checks passed"
}

# Run load test
run_load_test() {
    log_info "Running load test..."
    
    # Install Apache Bench if not present
    if ! command -v ab &> /dev/null; then
        log_info "Installing Apache Bench..."
        sudo apt-get update && sudo apt-get install -y apache2-utils
    fi
    
    # Run load test
    log_info "Running load test with 100 concurrent requests..."
    ab -n 1000 -c 100 "https://$DOMAIN/health" > load_test_results.txt
    
    # Check results
    FAILED_REQUESTS=$(grep "Failed requests" load_test_results.txt | awk '{print $3}')
    REQUESTS_PER_SECOND=$(grep "Requests per second" load_test_results.txt | awk '{print $4}')
    
    if [ "$FAILED_REQUESTS" = "0" ]; then
        log_success "Load test passed"
        log_info "Requests per second: $REQUESTS_PER_SECOND"
    else
        log_error "Load test failed"
        log_error "Failed requests: $FAILED_REQUESTS"
        exit 1
    fi
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Create CloudWatch alarms
    aws cloudwatch put-metric-alarm \
        --alarm-name "attendance-api-high-cpu" \
        --alarm-description "High CPU usage" \
        --metric-name CPUUtilization \
        --namespace AWS/EC2 \
        --statistic Average \
        --period 300 \
        --threshold 70 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 2 \
        --alarm-actions arn:aws:sns:us-east-1:123456789012:attendance-alerts \
        --unit Percent
    
    aws cloudwatch put-metric-alarm \
        --alarm-name "attendance-api-high-memory" \
        --alarm-description "High memory usage" \
        --metric-name MemoryUtilization \
        --namespace CWAgent \
        --statistic Average \
        --period 300 \
        --threshold 80 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 2 \
        --alarm-actions arn:aws:sns:us-east-1:123456789012:attendance-alerts \
        --unit Percent
    
    aws cloudwatch put-metric-alarm \
        --alarm-name "attendance-api-high-error-rate" \
        --alarm-description "High error rate" \
        --metric-name ErrorRate \
        --namespace AttendanceAPI \
        --statistic Average \
        --period 300 \
        --threshold 5 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 2 \
        --alarm-actions arn:aws:sns:us-east-1:123456789012:attendance-alerts \
        --unit Percent
    
    log_success "Monitoring setup completed"
}

# Create backup
create_backup() {
    log_info "Creating backup..."
    
    # Create database snapshot
    SNAPSHOT_ID="attendance-db-snapshot-$(date +%Y%m%d%H%M%S)"
    
    aws rds create-db-snapshot \
        --db-instance-identifier "${PROJECT_NAME}-${ENVIRONMENT}-db" \
        --db-snapshot-identifier "$SNAPSHOT_ID" \
        --tags Key=Backup,Value=Automated
    
    log_success "Database snapshot created: $SNAPSHOT_ID"
    
    # Create EBS snapshot
    VOLUME_ID=$(aws ec2 describe-volumes \
        --filters "Name=tag:Name,Values=${PROJECT_NAME}-${ENVIRONMENT}-data-volume" \
        --query "Volumes[0].VolumeId" \
        --output text)
    
    if [ -n "$VOLUME_ID" ]; then
        EBS_SNAPSHOT_ID="attendance-ebs-snapshot-$(date +%Y%m%d%H%M%S)"
        
        aws ec2 create-snapshot \
            --volume-id "$VOLUME_ID" \
            --description "Automated backup" \
            --tag-specifications "ResourceType=snapshot,Tags=[{Key=Backup,Value=Automated}]" \
            --snapshot-id "$EBS_SNAPSHOT_ID"
        
        log_success "EBS snapshot created: $EBS_SNAPSHOT_ID"
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    
    # Remove temporary files
    rm -rf build
    
    # Clean up Terraform
    cd terraform
    terraform plan -destroy -input=false -out=tfplan
    if [ "$1" = "--destroy" ]; then
        terraform apply -input=false -auto-approve tfplan
        log_success "Infrastructure destroyed"
    fi
    cd ..
}

# Main deployment function
main() {
    log_info "Starting production deployment..."
    log_info "Region: $REGION"
    log_info "Environment: $ENVIRONMENT"
    log_info "Domain: $DOMAIN"
    
    # Check prerequisites
    check_prerequisites
    
    # Build application
    build_application
    
    # Deploy infrastructure
    deploy_infrastructure
    
    # Configure DNS
    configure_dns
    
    # Deploy to Kubernetes
    deploy_kubernetes
    
    # Run health checks
    run_health_checks
    
    # Run load test
    run_load_test
    
    # Setup monitoring
    setup_monitoring
    
    # Create backup
    create_backup
    
    log_success "Production deployment completed successfully!"
    log_info "API is available at: https://$DOMAIN"
    log_info "Health check: https://$DOMAIN/health"
    log_info "Metrics: https://$DOMAIN/metrics"
    
    # Display deployment summary
    echo ""
    echo "=== Deployment Summary ==="
    echo "API Endpoint: https://$DOMAIN"
    echo "Health Check: https://$DOMAIN/health"
    echo "Metrics: https://$DOMAIN/metrics"
    echo "Database: $RDS_ENDPOINT"
    echo "Redis: $REDIS_ENDPOINT"
    echo "Auto Scaling Group: $API_ASG_NAME"
    echo "=========================="
}

# Handle script interruption
trap cleanup EXIT

# Parse command line arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    destroy)
        cleanup --destroy
        ;;
    health-check)
        run_health_checks
        ;;
    load-test)
        run_load_test
        ;;
    backup)
        create_backup
        ;;
    *)
        echo "Usage: $0 {deploy|destroy|health-check|load-test|backup}"
        exit 1
        ;;
esac
