#!/bin/bash

# Variables
AWS_REGION=""
AWS_ACCOUNT_ID=""
IMAGE_NAME="rada-server" # Replace with your Docker image name
REPOSITORY_NAME="my-repo" # Replace with your ECR repository name
IMAGE_TAG="latest"

# Check if AWS profile is provided as a parameter
if [ -z "$1" ]; then
  echo "Error: No AWS profile provided. Usage: $0 <aws-profile>"
  exit 1
fi

AWS_PROFILE="$1"

# Create Docker image
docker build -t ${IMAGE_NAME} .

# Authenticate with AWS ECR using the specified profile
aws ecr get-login-password --region ${AWS_REGION} --profile ${AWS_PROFILE} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Check if the ECR repository exists, create if not
if ! aws ecr describe-repositories --repository-names ${REPOSITORY_NAME} --region ${AWS_REGION} --profile ${AWS_PROFILE} >/dev/null 2>&1; then
  echo "Repository ${REPOSITORY_NAME} does not exist. Creating repository..."
  aws ecr create-repository --repository-name ${REPOSITORY_NAME} --region ${AWS_REGION} --profile ${AWS_PROFILE}
  if [ $? -ne 0 ]; then
    echo "Failed to create repository ${REPOSITORY_NAME}. Exiting."
    exit 1
  fi
  echo "Repository ${REPOSITORY_NAME} created."
fi

# Tag the Docker image
docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPOSITORY_NAME}:${IMAGE_TAG}

# Push the Docker image to AWS ECR
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPOSITORY_NAME}:${IMAGE_TAG}

# Optional: Check if the push was successful
if [ $? -eq 0 ]; then
    echo "Docker image pushed successfully to AWS ECR."
else
    echo "Failed to push Docker image to AWS ECR."
fi
