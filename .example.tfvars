## AWS
aws_region     = ""
aws_account_id = ""
aws_access_key = ""
aws_secret_key = ""

## RDS MSSQL Server
db_username              = ""
db_password              = ""
db_name                  = ""
local_ip_address         = "" # to allow remote access from your local machine
db_driver                = "ODBC+Driver+18+for+SQL+Server"
trust_server_certificate = "yes"
db_instance_identifier   = "" 

## EC2 Instance
instance_type  = "t4g.micro" # Optionally, you can increase the instance type
ami_id         = "ami-0000456e99b2b6a9d" # Ubuntu 20.04
key_name       = "" # Create a key pair in the AWS console
ssh_public_key = "" 

## ECR Repository
username        = "AWS"
repository_name = " " # This is the ECR Repository name that you created in the AWS console
image_tag       = "latest"

## S3 Buckjet
frontend_bucket_name  = "" # This is the S3 Bucket name where frontend files will be uploaded.
documents_bucket_name = "" # This is the S3 Bucket name where documents will be uploaded from RADA App. 

## SES Email
# This is the email that will be used to send emails from the backend.
# After creating the email in SES with Terraform, you must verify it.
#  You will receive an email from AWS to verify the email.
source_email = "" 

## Flask Config
flask_env = "prod" # dev or prod
port      = 4000 # The port where the Flask app will run

## Route53
domain_name = ""
frontend_subdomain = "app"
backend_subdomain = "api"





