terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.84"
    }
  }

  backend "s3" {
    region         = "us-west-2"
    bucket         = "hummingbird-terraform-state-bucket-v1"
    key            = "hummingbird/terraform.tfstate"
    dynamodb_table = "hummingbird-terraform-state-lock-table"
    encrypt        = true
  }
}

locals {
  common_tags = {
    Scope = "mscs"
    App   = "hummingbird"
    Class = "CS7990"
  }
  vpc_cidr             = "10.0.0.0/24"
  public_subnet_cidrs  = ["10.0.0.0/26", "10.0.0.64/26"]
  private_subnet_cidrs = ["10.0.0.128/26", "10.0.0.192/26"]
}

module "networking" {
  source               = "./modules/networking"
  additional_tags      = local.common_tags
  vpc_cidr             = local.vpc_cidr
  public_subnet_cidrs  = local.public_subnet_cidrs
  private_subnet_cidrs = local.private_subnet_cidrs
}

module "media_bucket" {
  source               = "./modules/media-bucket"
  additional_tags      = local.common_tags
  media_s3_bucket_name = var.media_s3_bucket_name
}

module "ecr" {
  source                  = "./modules/ecr"
  additional_tags         = local.common_tags
  application_environment = var.application_environment
}

module "hummingbird_docker" {
  source               = "./modules/docker"
  docker_build_context = "../hummingbird/app"
  image_tag_prefix     = "hummingbird"
  ecr_repository_url   = module.ecr.repository_url
}

module "cw_hummingbird_app" {
  source          = "./modules/cloudwatch"
  additional_tags = local.common_tags
  log_group_name  = "hummingbird-app"
}

module "app_alb_sg" {
  source          = "./modules/security-group"
  additional_tags = local.common_tags
  vpc_id          = module.networking.vpc_id
  name_prefix     = "app-alb-sg"
  description     = "Hummingbird app ALB security group"
}

module "app_container_sg" {
  source          = "./modules/security-group"
  additional_tags = local.common_tags
  vpc_id          = module.networking.vpc_id
  name_prefix     = "app-container-sg"
  description     = "Hummingbird app container security group"
}

module "process_media_lambda_sg" {
  source          = "./modules/security-group"
  additional_tags = local.common_tags
  vpc_id          = module.networking.vpc_id
  name_prefix     = "media-processing-lambda-sg"
  description     = "Hummingbird media processing lambda security group"
}

module "manage_media_lambda_sg" {
  source          = "./modules/security-group"
  additional_tags = local.common_tags
  vpc_id          = module.networking.vpc_id
  name_prefix     = "manage-media-lambda-sg"
  description     = "Hummingbird manage media lambda security group"
}

module "dynamodb" {
  depends_on = [module.networking]

  source                  = "./modules/dynamodb"
  additional_tags         = local.common_tags
  vpc_id                  = module.networking.vpc_id
  dynamodb_table_name     = var.media_dynamo_table_name
  private_route_table_ids = module.networking.private_route_table_ids
}

module "eventing" {
  depends_on = [module.ecr]

  source          = "./modules/eventing"
  additional_tags = local.common_tags
}

module "app" {
  depends_on = [
    module.dynamodb,
    module.ecr,
    module.media_bucket,
    module.networking,
  ]

  source = "./modules/app"

  additional_tags = local.common_tags

  vpc_id             = module.networking.vpc_id
  desired_task_count = var.desired_task_count

  app_port            = var.hummingbird_app_port
  dynamodb_table_arn  = module.dynamodb.dynamodb_table_arn
  dynamodb_table_name = module.dynamodb.dynamodb_table_name

  ecr_repository_arn    = module.ecr.ecr_repository_arn
  hummingbird_image_uri = module.hummingbird_docker.image_uri

  media_bucket_arn           = module.media_bucket.media_bucket_arn
  media_management_topic_arn = module.eventing.media_management_topic_arn
  media_s3_bucket_name       = var.media_s3_bucket_name

  node_env = var.node_env

  application_environment = var.application_environment

  alb_sg_id          = module.app_alb_sg.id
  container_sg_id    = module.app_container_sg.id
  private_subnet_ids = module.networking.private_subnet_ids
  public_subnet_ids  = module.networking.public_subnet_ids

  app_log_group_name = module.cw_hummingbird_app.log_group_name
}

module "lambdas" {
  depends_on = [
    module.dynamodb,
    module.media_bucket,
    module.networking,
  ]

  source = "./modules/lambda"

  additional_tags = local.common_tags

  lambdas_src_path = "../hummingbird/lambdas"

  dynamodb_table_arn  = module.dynamodb.dynamodb_table_arn
  dynamodb_table_name = module.dynamodb.dynamodb_table_name

  media_bucket_arn               = module.media_bucket.media_bucket_arn
  media_bucket_id                = module.media_bucket.media_bucket_id
  media_management_sqs_queue_arn = module.eventing.media_management_sqs_queue_arn
  media_s3_bucket_name           = var.media_s3_bucket_name

  process_media_lambda_sg = module.process_media_lambda_sg.id
  manage_media_lambda_sg  = module.manage_media_lambda_sg.id

  private_subnet_ids = module.networking.private_subnet_ids
}
