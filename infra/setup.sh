#!/usr/bin/env bash
# Idempotent: creates S3 bucket + least-privilege IAM user, wires creds into Convex.
# Usage: BUDGET_EMAIL=you@example.com ./infra/setup.sh   (BUDGET_EMAIL optional)
set -euo pipefail

REGION=ap-south-1
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
BUCKET="skystore-${ACCOUNT}-aps1"
IAM_USER=skystore-app

echo "==> Bucket $BUCKET"
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
fi

aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration '{
  "CORSRules":[{
    "AllowedOrigins":["http://localhost:5173","http://localhost","http://localhost:8081"],
    "AllowedMethods":["GET","PUT","DELETE","HEAD"],
    "AllowedHeaders":["*"],
    "ExposeHeaders":["ETag"],
    "MaxAgeSeconds":3000
  }]}'

# cost guard: orphaned multipart parts are billed silently
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{
  "Rules":[{"ID":"abort-multipart","Status":"Enabled","Filter":{},
    "AbortIncompleteMultipartUpload":{"DaysAfterInitiation":1}}]}'

echo "==> IAM user $IAM_USER"
aws iam get-user --user-name "$IAM_USER" >/dev/null 2>&1 || aws iam create-user --user-name "$IAM_USER"
aws iam put-user-policy --user-name "$IAM_USER" --policy-name skystore-s3 --policy-document "{
  \"Version\":\"2012-10-17\",
  \"Statement\":[{\"Effect\":\"Allow\",
    \"Action\":[\"s3:PutObject\",\"s3:GetObject\",\"s3:DeleteObject\"],
    \"Resource\":\"arn:aws:s3:::${BUCKET}/*\"}]}"

echo "==> Convex env"
cd "$(dirname "$0")/.."
npx convex env set CONVEX_AWS_REGION "$REGION"
npx convex env set CONVEX_AWS_S3_BUCKET "$BUCKET"

if npx convex env list 2>/dev/null | grep -q '^CONVEX_AWS_ACCESS_KEY_ID='; then
  echo "access key already set in Convex, skipping (delete it there to rotate)"
else
  # IAM allows max 2 keys/user; drop stale ones so rerun after failure works
  for k in $(aws iam list-access-keys --user-name "$IAM_USER" --query 'AccessKeyMetadata[].AccessKeyId' --output text); do
    aws iam delete-access-key --user-name "$IAM_USER" --access-key-id "$k"
  done
  read -r KEY_ID SECRET < <(aws iam create-access-key --user-name "$IAM_USER" \
    --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)
  npx convex env set CONVEX_AWS_ACCESS_KEY_ID "$KEY_ID"
  npx convex env set CONVEX_AWS_SECRET_ACCESS_KEY "$SECRET"
fi

if [[ -n "${BUDGET_EMAIL:-}" ]]; then
  echo "==> \$5 budget alert -> $BUDGET_EMAIL"
  aws budgets create-budget --account-id "$ACCOUNT" \
    --budget '{"BudgetName":"skystore-5usd","BudgetLimit":{"Amount":"5","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}' \
    --notifications-with-subscribers "[{\"Notification\":{\"NotificationType\":\"ACTUAL\",\"ComparisonOperator\":\"GREATER_THAN\",\"Threshold\":60,\"ThresholdType\":\"PERCENTAGE\"},\"Subscribers\":[{\"SubscriptionType\":\"EMAIL\",\"Address\":\"$BUDGET_EMAIL\"}]}]" \
    2>&1 | grep -v DuplicateRecord || true
fi
echo "done"
