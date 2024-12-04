#!/bin/bash

# Set bash to exit script and return error if any command fails
set -e

# Log file location
LOG_FILE="/var/log/deployment.log"
echo "Starting script execution..." > "$LOG_FILE"

# Update and install initial dependencies
sudo apt-get update && sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common nginx docker.io unzip >> "$LOG_FILE" 2>&1

# Start and enable Docker
sudo systemctl start docker >> "$LOG_FILE" 2>&1
sudo systemctl enable docker >> "$LOG_FILE" 2>&1

# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip" >> "$LOG_FILE" 2>&1
unzip awscliv2.zip >> "$LOG_FILE" 2>&1
sudo ./aws/install >> "$LOG_FILE" 2>&1

# Authenticate with AWS ECR
aws_region=${aws_region}
aws_account_id=${aws_account_id}

sudo aws ecr get-login-password --region $aws_region | sudo docker login --username AWS --password-stdin $aws_account_id.dkr.ecr.$aws_region.amazonaws.com >> "$LOG_FILE" 2>&1

# Pull the Docker image from ECR
ecr_repository=${ecr_repository}
image_tag=${image_tag}
sudo docker pull $aws_account_id.dkr.ecr.$aws_region.amazonaws.com/$ecr_repository:$image_tag >> "$LOG_FILE" 2>&1


# Mapping environment variables to the Docker container
db_username=${db_username}
db_password=${db_password}
db_host=${db_host}  
db_name=${db_name}
db_driver=${db_driver}
trust_server_certificate=${trust_server_certificate}
aws_access_key=${aws_access_key}
aws_secret_key=${aws_secret_key}
flask_env=${flask_env}
port=${port}
source_email=${source_email}
documents_bucket_name=${documents_bucket_name}
cloudfront_domain_name=${cloudfront_domain_name}
domain_name=${domain_name}
frontend_subdomain=${frontend_subdomain}
backend_subdomain=${backend_subdomain}

sudo docker run --restart always -d -p 4000:4000 \
  --env PROD_MSSQL_DB_USER=$db_username \
  --env PROD_MSSQL_DB_PASS=$db_password \
  --env PROD_MSSQL_DB_HOST=$db_host \
  --env PROD_MSSQL_DB_NAME=$db_name \
  --env PROD_MSSQL_DB_DRIVER=$db_driver \
  --env PROD_MSSQL_DB_TRUST_SERVER_CERTIFICATE=$trust_server_certificate \
  --env PROD_AWS_ACCESS_KEY_ID=$aws_access_key \
  --env PROD_AWS_SECRET_ACCESS_KEY=$aws_secret_key \
  --env PROD_AWS_REGION=$aws_region \
  --env FLASK_ENV=$flask_env \
  --env PORT=$port \
  --env DOCUMENTS_BUCKET_NAME=$documents_bucket_name \
  --env AWS_SES_SOURCE_EMAIL=$source_email \
  --env CLOUDFRONT_DOMAIN_NAME=$cloudfront_domain_name \
  --env DOMAIN_NAME=$domain_name \
  --env FRONTEND_SUBDOMAIN=$frontend_subdomain \
  --env BACKEND_SUBDOMAIN=$backend_subdomain \
  --name rada-svr-test \
  $aws_account_id.dkr.ecr.$aws_region.amazonaws.com/$ecr_repository >> "$LOG_FILE" 2>&1

echo "Verifying Docker container status:" >> "$LOG_FILE"
sudo docker ps -a | grep rada-svr-test >> "$LOG_FILE"

sudo tee /etc/nginx/sites-available/redirect <<EOF
server {
    listen 80;
    server_name $backend_subdomain.$domain_name;

    location / {
        proxy_pass http://127.0.0.1:4000;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/redirect /etc/nginx/sites-enabled/

sudo systemctl restart nginx >> "$LOG_FILE" 2>&1

echo "*** Setup completed successfully. ***" >> "$LOG_FILE"
