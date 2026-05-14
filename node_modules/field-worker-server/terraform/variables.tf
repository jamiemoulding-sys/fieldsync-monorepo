# Terraform Variables

variable "domain_name" {
  description = "Domain name for SSL certificate"
  type        = string
  default     = "api.fieldsync.com"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "redis_auth_token" {
  description = "Redis auth token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch logs"
  type        = bool
  default     = true
}

variable "enable_cloudwatch_metrics" {
  description = "Enable CloudWatch metrics"
  type        = bool
  default     = true
}

variable "enable_rds_encryption" {
  description = "Enable RDS encryption"
  type        = bool
  default     = true
}

variable "enable_redis_encryption" {
  description = "Enable Redis encryption"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Database backup retention in days"
  type        = number
  default     = 30
}

variable "enable_auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades for RDS"
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Enable deletion protection for RDS"
  type        = bool
  default     = false
}

variable "performance_insights_retention_period" {
  description = "Performance Insights retention period"
  type        = string
  default     = "7"
}

variable "storage_type" {
  description = "Storage type for RDS"
  type        = string
  default     = "gp2"
}

variable "iops" {
  description = "IOPS for RDS (only for io1 storage type)"
  type        = number
  default     = 0
}

variable "enable_monitoring" {
  description = "Enable enhanced monitoring"
  type        = bool
  default     = false
}

variable "monitoring_interval" {
  description = "Monitoring interval in seconds"
  type        = number
  default     = 60
}

variable "enable_backup" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}

variable "enable_dns_support" {
  description = "Enable DNS support in VPC"
  type        = bool
  default     = true
}

variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames in VPC"
  type        = bool
  default     = true
}

variable "assign_generated_ipv6_cidr_block" {
  description = "Assign IPv6 CIDR block to VPC"
  type        = bool
  default     = false
}

variable "enable_ipv6" {
  description = "Enable IPv6 support"
  type        = bool
  default     = false
}

variable "private_subnets_per_az" {
  description = "Number of private subnets per availability zone"
  type        = number
  default     = 1
}

variable "public_subnets_per_az" {
  description = "Number of public subnets per availability zone"
  type        = number
  default     = 1
}

variable "enable_nat_gateway" {
  description = "Enable NAT gateway"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT gateway"
  type        = bool
  default     = false
}

variable "one_nat_gateway_per_az" {
  description = "One NAT gateway per availability zone"
  type        = bool
  default     = true
}

variable "enable_vpn_gateway" {
  description = "Enable VPN gateway"
  type        = bool
  default     = false
}

variable "enable_dhcp_options" {
  description = "Enable custom DHCP options"
  type        = bool
  default     = false
}

variable "dhcp_options_domain_name" {
  description = "DHCP options domain name"
  type        = string
  default     = ""
}

variable "dhcp_options_domain_name_servers" {
  description = "DHCP options domain name servers"
  type        = list(string)
  default     = []
}

variable "dhcp_options_ntp_servers" {
  description = "DHCP options NTP servers"
  type        = list(string)
  default     = []
}

variable "dhcp_options_netbios_name_servers" {
  description = "DHCP options NetBIOS name servers"
  type        = list(string)
  default     = []
}

variable "dhcp_options_netbios_node_type" {
  description = "DHCP options NetBIOS node type"
  type        = number
  default     = 2
}

variable "enable_flow_log" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = false
}

variable "flow_log_destination_type" {
  description = "Flow log destination type"
  type        = string
  default     = "cloud-watch-logs"
}

variable "flow_log_traffic_type" {
  description = "Flow log traffic type"
  type        = string
  default     = "ALL"
}

variable "flow_log_log_format" {
  description = "Flow log format"
  type        = string
  default     = "plain-text"
}

variable "enable_s3_bucket_policy" {
  description = "Enable S3 bucket policy"
  type        = bool
  default     = true
}

variable "s3_bucket_force_destroy" {
  description = "Force destroy S3 bucket"
  type        = bool
  default     = false
}

variable "s3_bucket_versioning" {
  description = "Enable S3 bucket versioning"
  type        = bool
  default     = true
}

variable "s3_bucket_server_side_encryption" {
  description = "S3 bucket server side encryption"
  type        = string
  default     = "AES256"
}

variable "s3_bucket_kms_master_key_id" {
  description = "S3 bucket KMS master key ID"
  type        = string
  default     = ""
}

variable "s3_bucket_acl" {
  description = "S3 bucket ACL"
  type        = string
  default     = "private"
}

variable "s3_bucket_policy" {
  description = "S3 bucket policy"
  type        = string
  default     = ""
}

variable "s3_bucket_lifecycle_rule" {
  description = "S3 bucket lifecycle rule"
  type        = list(object({
    id     = string
    status = string
    tags   = map(string)
    transition = list(object({
      days          = number
      storage_class = string
    }))
    expiration = object({
      days = number
    })
  }))
  default = []
}

variable "s3_bucket_object_lock_enabled" {
  description = "S3 bucket object lock enabled"
  type        = bool
  default     = false
}

variable "s3_bucket_object_lock_mode" {
  description = "S3 bucket object lock mode"
  type        = string
  default     = ""
}

variable "s3_bucket_object_lock_days" {
  description = "S3 bucket object lock days"
  type        = number
  default     = 0
}

variable "s3_bucket_object_lock_years" {
  description = "S3 bucket object lock years"
  type        = number
  default     = 0
}

variable "s3_bucket_intelligent_tiering" {
  description = "S3 bucket intelligent tiering"
  type        = bool
  default     = false
}

variable "s3_bucket_request_payer" {
  description = "S3 bucket request payer"
  type        = string
  default     = "BucketOwner"
}

variable "s3_bucket_expect_100_continue" {
  description = "S3 bucket expect 100 continue"
  type        = bool
  default     = false
}

variable "s3_bucket_object_lock_enabled" {
  description = "S3 bucket object lock enabled"
  type        = bool
  default     = false
}

variable "s3_bucket_object_lock_mode" {
  description = "S3 bucket object lock mode"
  type        = string
  default     = ""
}

variable "s3_bucket_object_lock_days" {
  description = "S3 bucket object lock days"
  type        = number
  default     = 0
}

variable "s3_bucket_object_lock_years" {
  description = "S3 bucket object lock years"
  type        = number
  default     = 0
}

variable "s3_bucket_intelligent_tiering" {
  description = "S3 bucket intelligent tiering"
  type        = bool
  default     = false
}

variable "s3_bucket_request_payer" {
  description = "S3 bucket request payer"
  type        = string
  default     = "BucketOwner"
}

variable "s3_bucket_expect_100_continue" {
  description = "S3 bucket expect 100 continue"
  type        = bool
  default     = false
}

variable "s3_bucket_bucket_level_enabled" {
  description = "S3 bucket bucket level enabled"
  type        = bool
  default     = false
}

variable "s3_bucket_block_public_acls" {
  description = "S3 bucket block public ACLs"
  type        = bool
  default     = true
}

variable "s3_bucket_block_public_policy" {
  description = "S3 bucket block public policy"
  type        = bool
  default     = true
}

variable "s3_bucket_ignore_public_acls" {
  description = "S3 bucket ignore public ACLs"
  type        = bool
  default     = false
}

variable "s3_bucket_restrict_public_buckets" {
  description = "S3 bucket restrict public buckets"
  type        = bool
  default     = true
}

variable "s3_bucket_content_md5" {
  description = "S3 bucket content MD5"
  type        = string
  default     = ""
}

variable "s3_bucket_source_hash" {
  description = "S3 bucket source hash"
  type        = string
  default     = ""
}

variable "s3_bucket_source_hash_algorithm" {
  description = "S3 bucket source hash algorithm"
  type        = string
  default     = ""
}

variable "s3_bucket_etag" {
  description = "S3 bucket etag"
  type        = string
  default     = ""
}

variable "s3_bucket_content_type" {
  description = "S3 bucket content type"
  type        = string
  default     = ""
}

variable "s3_bucket_content_encoding" {
  description = "S3 bucket content encoding"
  type        = string
  default     = ""
}

variable "s3_bucket_content_language" {
  description = "S3 bucket content language"
  type        = string
  default     = ""
}

variable "s3_bucket_cache_control" {
  description = "S3 bucket cache control"
  type        = string
  default     = ""
}

variable "s3_bucket_content_disposition" {
  description = "S3 bucket content disposition"
  type        = string
  default     = ""
}

variable "s3_bucket_content_encoding" {
  description = "S3 bucket content encoding"
  type        = string
  default     = ""
}

variable "s3_bucket_content_language" {
  description = "S3 bucket content language"
  type        = string
  default     = ""
}

variable "s3_bucket_expires" {
  description = "S3 bucket expires"
  type        = string
  default     = ""
}

variable "s3_bucket_metadata" {
  description = "S3 bucket metadata"
  type        = map(string)
  default     = {}
}

variable "s3_bucket_server_side_encryption" {
  description = "S3 bucket server side encryption"
  type        = string
  default     = "AES256"
}

variable "s3_bucket_ssekms_key_id" {
  description = "S3 bucket SSE-KMS key ID"
  type        = string
  default     = ""
}

variable "s3_bucket_kms_key_id" {
  description = "S3 bucket KMS key ID"
  type        = string
  default     = ""
}

variable "s3_bucket_bucket_key_enabled" {
  description = "S3 bucket bucket key enabled"
  type        = bool
  default     = false
}

variable "s3_bucket_object_lock_enabled" {
  description = "S3 bucket object lock enabled"
  type        = bool
  default     = false
}

variable "s3_bucket_object_lock_mode" {
  description = "S3 bucket object lock mode"
  type        = string
  default     = ""
}

variable "s3_bucket_object_lock_days" {
  description = "S3 bucket object lock days"
  type        = number
  default     = 0
}

variable "s3_bucket_object_lock_years" {
  description = "S3 bucket object lock years"
  type        = number
  default     = 0
}

variable "s3_bucket_intelligent_tiering" {
  description = "S3 bucket intelligent tiering"
  type        = bool
  default     = false
}

variable "s3_bucket_request_payer" {
  description = "S3 bucket request payer"
  type        = string
  default     = "BucketOwner"
}

variable "s3_bucket_expect_100_continue" {
  description = "S3 bucket expect 100 continue"
  type        = bool
  default     = false
}

variable "s3_bucket_bucket_level_enabled" {
  description = "S3 bucket bucket level enabled"
  type        = bool
  default     = false
}

variable "s3_bucket_block_public_acls" {
  description = "S3 bucket block public ACLs"
  type        = bool
  default     = true
}

variable "s3_bucket_block_public_policy" {
  description = "S3 bucket block public policy"
  type        = bool
  default     = true
}

variable "s3_bucket_ignore_public_acls" {
  description = "S3 bucket ignore public ACLs"
  type        = bool
  default     = false
}

variable "s3_bucket_restrict_public_buckets" {
  description = "S3 bucket restrict public buckets"
  type        = bool
  default     = true
}
