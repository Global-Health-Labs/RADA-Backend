terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variable Definitions
variable "db_username" {}
variable "db_password" {}
variable "db_driver" {}
variable "db_name" {}
variable "trust_server_certificate" {}
variable "db_instance_identifier" {}
variable "aws_access_key" {}
variable "aws_secret_key" {}
variable "aws_region" {}
variable "aws_account_id" {}
variable "ssh_public_key" {}
variable "local_ip_address" {}
variable "ami_id" {}
variable "instance_type" {}
variable "key_name" {}
variable "repository_name" {}
variable "image_tag" {}
variable "username" {}
variable "frontend_bucket_name" {}
variable "documents_bucket_name" {}
variable "flask_env" {}
variable "port" {}
variable "source_email" {}
variable "domain_name" {}
variable "frontend_subdomain" {}
variable "backend_subdomain" {}

# Providers Configuration
provider "aws" {
  region     = var.aws_region # Main region (us-east-2)
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
}

provider "aws" {
  alias      = "us-east-1" # For ACM CloudFront SSL certificates
  region     = "us-east-1"
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
}

# IAM Roles and Policies (as previously defined)
resource "aws_iam_policy" "s3_modify_acl_policy" {
  name        = "ModifyS3BucketAclPolicy"
  description = "Allow modification of S3 bucket ACLs"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = "s3:PutBucketAcl",
        Resource = [
          "arn:aws:s3:::*"
        ]
      }
    ]
  })
}

resource "aws_iam_role" "ec2_s3_access_role" {
  name = "ec2_s3_access_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "s3_full_access_policy" {
  name        = "s3_full_access_policy"
  description = "Policy for full access to S3 bucket"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ],
        Resource = "${aws_s3_bucket.documents_bucket.arn}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "s3_full_access_policy_attachment" {
  role       = aws_iam_role.ec2_s3_access_role.name
  policy_arn = aws_iam_policy.s3_full_access_policy.arn
}

resource "aws_iam_role_policy_attachment" "s3_acl_policy_attachment" {
  role       = aws_iam_role.ec2_s3_access_role.name
  policy_arn = aws_iam_policy.s3_modify_acl_policy.arn
}

resource "aws_iam_policy" "ecr_access_policy" {
  name        = "ecr_access_policy"
  description = "Policy for EC2 roles to access ECR"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action   = "ecr:GetAuthorizationToken",
        Effect   = "Allow",
        Resource = "*"
      },
      {
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
        ],
        Effect   = "Allow",
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecr_access" {
  role       = aws_iam_role.ec2_s3_access_role.name
  policy_arn = aws_iam_policy.ecr_access_policy.arn
}

resource "aws_iam_instance_profile" "ec2_s3_profile" {
  name = "ec2_s3_instance_profile"
  role = aws_iam_role.ec2_s3_access_role.name
}

# MSSQL DB Instance
resource "aws_db_instance" "mssql_db_instance" {
  allocated_storage         = 20
  identifier                = var.db_instance_identifier
  engine                    = "sqlserver-ex"
  engine_version            = "15.00.4043.16.v1"
  instance_class            = "db.t3.micro"
  username                  = var.db_username
  password                  = var.db_password
  skip_final_snapshot       = false
  vpc_security_group_ids    = [aws_security_group.db_sg.id]
  publicly_accessible       = true
  final_snapshot_identifier = "ghlabs-db-instance-tf-final-snapshot"
  tags = {
    Name = "ghlabs-db-instance-tf"
  }
}

# MSSQL DB Security Group
resource "aws_security_group" "db_sg" {
  name        = "mssql_db_sg"
  description = "Security group for MSSQL database instance"
  ingress {
    from_port       = 1433
    to_port         = 1433
    protocol        = "tcp"
    security_groups = [aws_security_group.instance.id]
  }
  ingress {
    from_port   = 1433
    to_port     = 1433
    protocol    = "tcp"
    cidr_blocks = ["${var.local_ip_address}/32"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# EC2 Instance
resource "aws_instance" "rada_server_instance" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.generated_key.key_name
  vpc_security_group_ids = [aws_security_group.instance.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_s3_profile.name
  user_data = templatefile("${path.module}/setup.sh.tpl", {
    aws_region               = var.aws_region,
    aws_account_id           = var.aws_account_id,
    aws_access_key           = var.aws_access_key,
    aws_secret_key           = var.aws_secret_key,
    ecr_repository           = var.repository_name,
    image_tag                = var.image_tag,
    db_driver                = var.db_driver,
    db_name                  = var.db_name,
    db_username              = var.db_username,
    db_password              = var.db_password,
    db_host                  = aws_db_instance.mssql_db_instance.address,
    flask_env                = var.flask_env,
    port                     = var.port,
    documents_bucket_name    = var.documents_bucket_name,
    source_email             = var.source_email,
    trust_server_certificate = var.trust_server_certificate,
    cloudfront_domain_name   = aws_cloudfront_distribution.react_app_distribution.domain_name,
    domain_name              = var.domain_name,
    frontend_subdomain       = var.frontend_subdomain,
    backend_subdomain        = var.backend_subdomain
  })
  tags = {
    Name = "RADAServer"
  }
}

# Security Group for EC2 Instance
resource "aws_security_group" "instance" {
  name        = "rada_server_sg"
  description = "Allow HTTP, HTTPS and SSH inbound traffic"
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id] # Allow traffic from the ALB
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_key_pair" "generated_key" {
  key_name   = var.key_name
  public_key = var.ssh_public_key
}

## S3 Buckets
resource "aws_s3_bucket" "documents_bucket" {
  bucket = var.documents_bucket_name
}

resource "aws_s3_bucket_ownership_controls" "documents_bucket" {
  bucket = aws_s3_bucket.documents_bucket.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "documents_bucket" {
  depends_on = [aws_s3_bucket_ownership_controls.documents_bucket]
  bucket     = aws_s3_bucket.documents_bucket.id
  acl        = "private"
}

resource "aws_s3_bucket" "front_bucket" {
  bucket = var.frontend_bucket_name
}

resource "aws_s3_bucket_ownership_controls" "front_bucket" {
  bucket = aws_s3_bucket.front_bucket.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "front_bucket" {
  depends_on = [aws_s3_bucket_ownership_controls.front_bucket]
  bucket     = aws_s3_bucket.front_bucket.id
  acl        = "public-read"
}

resource "aws_s3_bucket_public_access_block" "example" {
  bucket = aws_s3_bucket.front_bucket.id

  block_public_acls       = false
  ignore_public_acls      = false
  block_public_policy     = false
  restrict_public_buckets = false
}

## SES Configuration

resource "aws_ses_email_identity" "email_identity" {
  email = var.source_email
}

resource "aws_iam_policy" "ses_send_email_policy" {
  name        = "SES_Send_Email_Policy"
  description = "Allow EC2 instances to send emails via SES"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ],
        Resource = "*",
        Effect   = "Allow"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "attach_ses_to_ec2_s3_access_role" {
  role       = aws_iam_role.ec2_s3_access_role.name
  policy_arn = aws_iam_policy.ses_send_email_policy.arn
}

# CloudFront Distribution for the React App
resource "aws_cloudfront_distribution" "react_app_distribution" {
  origin {
    domain_name = aws_s3_bucket.front_bucket.bucket_regional_domain_name
    origin_id   = "ReactAppS3Origin"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  # aliases with cloudfront url 

  aliases = ["${var.frontend_subdomain}.${var.domain_name}"]

  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate.ghlabs_certificate_frontend.arn
    ssl_support_method  = "sni-only"
  }

  enabled             = true
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "ReactAppS3Origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  custom_error_response {
    error_caching_min_ttl = 0
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
  }

  price_class = "PriceClass_All"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  tags = {
    Environment = "production"
  }
}

resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for React App S3 access"
}

resource "aws_iam_role" "cloudfront" {
  name = "cloudfront_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
      },
    ]
  })
}

### Outputs

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.react_app_distribution.domain_name
  description = "The domain name of the CloudFront distribution"
}

# Output the public IP of the EC2 instance
output "instance_ip_address" {
  value = aws_instance.rada_server_instance.public_ip
}

output "db_instance_endpoint" {
  value = aws_db_instance.mssql_db_instance.endpoint
}

## Route53 Configuration

resource "aws_route53_zone" "ghlabs_zone" {
  name = var.domain_name
}

output "name_servers" {
  value = aws_route53_zone.ghlabs_zone.name_servers
}

resource "aws_route53_record" "validation_record_frontend" {
  for_each = {
    for dvo in aws_acm_certificate.ghlabs_certificate_frontend.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id = aws_route53_zone.ghlabs_zone.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.record]

}

resource "aws_acm_certificate_validation" "ghlabs_certificate_validation_frontend" {
  provider                = aws.us-east-1
  certificate_arn         = aws_acm_certificate.ghlabs_certificate_frontend.arn
  validation_record_fqdns = [for record in aws_route53_record.validation_record_frontend : record.fqdn]
}

# ACM Certificate for the domain Frontend
resource "aws_acm_certificate" "ghlabs_certificate_frontend" {
  provider          = aws.us-east-1
  domain_name       = "${var.frontend_subdomain}.${var.domain_name}"
  validation_method = "DNS"
  tags = {
    Environment = "production"
  }
  lifecycle {
    create_before_destroy = true
  }

}

## Load Balancer

# Application Load Balancer
resource "aws_lb" "my_alb" {
  name               = "my-application-load-balancer"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = data.aws_subnets.public.ids
}

# Security Group for the ALB
resource "aws_security_group" "alb_sg" {
  name        = "alb-security-group"
  description = "Security group for ALB"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Target Group for HTTP traffic
resource "aws_lb_target_group" "http_target_group" {
  name     = "http-target-group"
  port     = 4000
  protocol = "HTTP"
  vpc_id   = data.aws_vpc.default.id

  health_check {
    protocol            = "HTTP"
    path                = "/"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }
}

# Listener for HTTPS
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.my_alb.arn
  port              = 443
  protocol          = "HTTPS"

  ssl_policy      = "ELBSecurityPolicy-2016-08"
  certificate_arn = aws_acm_certificate.ghlabs_certificate_backend.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.http_target_group.arn
  }
}

# Listener for HTTP (redirect to HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.my_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Data source to fetch the default VPC
data "aws_vpc" "default" {
  default = true
}

# Output the default VPC ID
output "default_vpc_id" {
  value       = data.aws_vpc.default.id
  description = "The ID of the default VPC in the region"
}

# Data source to fetch the public subnets
data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Output the public subnet IDs

output "public_subnet_ids" {
  value       = data.aws_subnets.public.ids
  description = "The IDs of the public subnets in the default VPC"
}

## generate acm_certificate form alb

resource "aws_acm_certificate" "ghlabs_certificate_backend" {
  domain_name       = "${var.backend_subdomain}.${var.domain_name}"
  validation_method = "DNS"
  tags = {
    Environment = "production"
  }
  lifecycle {
    create_before_destroy = true
  }

}

resource "aws_acm_certificate_validation" "ghlabs_certificate_validation_backend" {
  certificate_arn         = aws_acm_certificate.ghlabs_certificate_backend.arn
  validation_record_fqdns = [for record in aws_route53_record.validation_record_backend : record.fqdn]
}

resource "aws_route53_record" "validation_record_backend" {
  for_each = {
    for dvo in aws_acm_certificate.ghlabs_certificate_backend.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id = aws_route53_zone.ghlabs_zone.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.record]
}

## attach alb target group to ec2
resource "aws_lb_target_group_attachment" "ec2" {
  target_group_arn = aws_lb_target_group.http_target_group.arn
  target_id        = aws_instance.rada_server_instance.id
  port             = 80
}

## Routing subdomains to CloudFront and ALB respectively

resource "aws_route53_record" "cloudfront_record" {
  zone_id = aws_route53_zone.ghlabs_zone.zone_id
  name    = "${var.frontend_subdomain}.${var.domain_name}"
  type    = "CNAME"
  records = [aws_cloudfront_distribution.react_app_distribution.domain_name]
  ttl     = 300
}

resource "aws_route53_record" "load_balancer_record" {
  zone_id = aws_route53_zone.ghlabs_zone.zone_id
  name    = "${var.backend_subdomain}.${var.domain_name}"
  type    = "CNAME"
  records = [aws_lb.my_alb.dns_name]
  ttl     = 300
}
