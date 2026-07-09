#!/usr/bin/env bash
set -euo pipefail

# Local helper to deploy an already-built image to a droplet using SSH.
# Usage (local machine):
#  ./scripts/deploy-to-droplet.sh <user>@<ip> [path=/home/<user>/questionnaire] [branch=master] [app_image=localhost:5000/questionnaire:latest]
# This script uses git on the droplet to pull the compose file and then starts the pushed image.

REMOTE=${1:?Please provide user@host}
TARGET_DIR=${2:-/home/${REMOTE%%@*}/questionnaire}
BRANCH=${3:-master}
APP_IMAGE=${4:-${APP_IMAGE:-localhost:5000/questionnaire:latest}}

echo "Deploying to ${REMOTE} -> ${TARGET_DIR} (branch ${BRANCH}, image ${APP_IMAGE})"

ssh ${REMOTE} APP_IMAGE='${APP_IMAGE}' bash -s <<EOF
set -euo pipefail
mkdir -p ${TARGET_DIR}
if [ ! -d "${TARGET_DIR}/.git" ]; then
  git clone https://github.com/<your-org-or-username>/questionnaire.git ${TARGET_DIR}
fi
cd ${TARGET_DIR}
git fetch origin
git checkout ${BRANCH}
git pull origin ${BRANCH}
docker compose pull || true
docker compose up -d --no-build
EOF

echo "Deployment complete."
