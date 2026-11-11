#!/usr/bin/env bash
# Hard stop for AWS cost: deletes bucket (and ALL files in it) + the skystore-app IAM user.
set -euo pipefail

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
BUCKET="skystore-${ACCOUNT}-aps1"
IAM_USER=skystore-app

read -r -p "Delete s3://$BUCKET with all contents and IAM user $IAM_USER? [y/N] " ok
[[ "$ok" == "y" ]] || exit 1

if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  aws s3 rb "s3://$BUCKET" --force
fi

if aws iam get-user --user-name "$IAM_USER" >/dev/null 2>&1; then
  for k in $(aws iam list-access-keys --user-name "$IAM_USER" --query 'AccessKeyMetadata[].AccessKeyId' --output text); do
    aws iam delete-access-key --user-name "$IAM_USER" --access-key-id "$k"
  done
  aws iam delete-user-policy --user-name "$IAM_USER" --policy-name skystore-s3 2>/dev/null || true
  aws iam delete-user --user-name "$IAM_USER"
fi
echo "AWS resources removed."
