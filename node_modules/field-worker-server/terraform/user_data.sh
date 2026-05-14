#!/bin/bash
# User data script for EC2 instances
# Sets up the attendance API application

set -e

# Log everything
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2) 2>&1

echo "Starting user data script..."

# Update system
yum update -y

# Install Docker
yum install -y docker

# Start Docker service
systemctl start docker
systemctl enable docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create application directory
mkdir -p /opt/attendance-api
cd /opt/attendance-api

# Download application code from S3
echo "Downloading application code from S3..."
aws s3 cp s3://${s3_bucket}/${s3_key} ./attendance-api.tar.gz

# Extract application
echo "Extracting application..."
tar -xzf attendance-api.tar.gz
rm attendance-api.tar.gz

# Create environment file
echo "Creating environment file..."
cat > .env <<EOF
NODE_ENV=production
PORT=3000
AWS_REGION=${region}

# Database
DATABASE_URL=postgresql://attendance_user:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/attendance

# Redis
REDIS_URL=redis://${REDIS_AUTH_TOKEN}@${REDIS_ENDPOINT}:6379

# JWT
JWT_SECRET=${JWT_SECRET}

# Logging
LOG_LEVEL=info

# Performance
MAX_CONNECTIONS=200
CACHE_TTL=3600
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
EOF

# Build Docker image
echo "Building Docker image..."
docker build -t attendance-api:latest .

# Run Docker container
echo "Starting Docker container..."
docker run -d \
  --name attendance-api \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  attendance-api:latest

# Wait for application to start
echo "Waiting for application to start..."
sleep 30

# Health check
echo "Performing health check..."
if curl -f http://localhost:3000/health; then
    echo "Application is healthy"
else
    echo "Application health check failed"
    exit 1
fi

echo "User data script completed successfully"
