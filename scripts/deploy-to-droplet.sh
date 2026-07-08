#!/usr/bin/env bash
set -euo pipefail

# Local helper to deploy code to a droplet using password or SSH key.
# Usage (local machine):
#  ./scripts/deploy-to-droplet.sh <user>@<ip> [path=/home/<user>/questionnaire] [branch=master]
# This script uses git on the droplet to pull the repo. Ensure the droplet can access the repository.

REMOTE=${1:?Please provide user@host}
TARGET_DIR=${2:-/home/${REMOTE%%@*}/questionnaire}
BRANCH=${3:-master}

echo "Deploying to ${REMOTE} -> ${TARGET_DIR} (branch ${BRANCH})"

ssh ${REMOTE} bash -s <<EOF
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
docker compose up -d --build
EOF

echo "Deployment complete."
