variable "node_env" {
  description = "Node.js environment"
  type        = string
  default     = "development"
}

variable "aws_region" {
  description = "The AWS region to deploy resources."
  type        = string
  default     = "us-west-2"
}

variable "hummingbird_app_port" {
  description = "Port the application listens on"
  type        = number
}

variable "media_s3_bucket_name" {
  description = "S3 bucket for media files"
  type        = string
}

variable "media_dynamo_table_name" {
  description = "Name of the DynamoDB table for media metadata"
  type        = string
}

variable "application_environment" {
  description = "Environment the application is running on. It's either LocalStack or AWS"
  type        = string
}

variable "desired_task_count" {
  description = "Number of tasks to run"
  type        = number
}
