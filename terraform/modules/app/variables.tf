variable "additional_tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "app_port" {
  description = "Port the application listens on"
  type        = number
}

variable "ecr_repository_arn" {
  description = "ARN of the ECR repository"
  type        = string
}

variable "hummingbird_image_uri" {
  description = "URI of the Docker image to run"
  type        = string
}

variable "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  type        = string
}

variable "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table"
  type        = string
}

variable "media_bucket_arn" {
  description = "ARN of the S3 bucket for media files"
  type        = string
}

variable "media_management_topic_arn" {
  description = "ARN of the SNS topic for media management"
  type        = string
}

variable "node_env" {
  description = "Node.js environment"
  type        = string
}

variable "media_s3_bucket_name" {
  description = "S3 bucket for media files"
  type        = string
}

variable "public_subnet_ids" {
  description = "IDs of the public subnets"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "IDs of the private subnets"
  type        = list(string)
}

variable "application_environment" {
  description = "Environment the application is running on. It's either LocalStack or AWS"
  type        = string
}

variable "app_log_group_name" {
  description = "Name of the CloudWatch log group for the app container"
  type        = string
}

variable "alb_sg_id" {
  description = "ID of the security group for the ALB"
  type        = string
}

variable "container_sg_id" {
  description = "ID of the security group for the container"
  type        = string
}

variable "desired_task_count" {
  description = "Initial number of tasks to run"
  type        = number
}
