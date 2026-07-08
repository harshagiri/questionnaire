#!/usr/bin/env bash
set -euo pipefail

# One-shot deploy to a droplet using password-based SSH (sshpass).
# WARNING: Using password-based SSH is less secure than SSH keys. Use this only for quick testing.
# Usage: ./scripts/deploy-with-sshpass.sh user@ip 'password' [branch] [remote_dir] [env_file] [run_doctor_migration]
# Example:
#   ./scripts/deploy-with-sshpass.sh ubuntu@168.144.67.25 'P@ssw0rd' main /home/ubuntu/questionnaire ./.env.production true

REMOTE=${1:?Please specify user@host}
PASS=${2:?Please specify SSH password (careful, this will be visible in your shell history)}
BRANCH=${3:-main}
TARGET_DIR=${4:-/home/${REMOTE%%@*}/questionnaire}
ENV_FILE=${5:-}
RUN_DOCTOR_MIGRATION=${6:-false}

if [[ "$RUN_DOCTOR_MIGRATION" != "true" && "$RUN_DOCTOR_MIGRATION" != "false" ]]; then
  echo "run_doctor_migration must be 'true' or 'false'" >&2
  exit 1
fi

if ! command -v sshpass >/dev/null 2>&1; then
  echo "sshpass not found on local machine. Install it and re-run. On macOS: brew install hudochenkov/sshpass/sshpass, on Ubuntu: sudo apt install -y sshpass" >&2
  exit 1
fi

if [[ -n "$ENV_FILE" && ! -f "$ENV_FILE" ]]; then
  echo "env_file not found: $ENV_FILE" >&2
  exit 1
fi

echo "Deploying branch '${BRANCH}' to ${REMOTE}:${TARGET_DIR}"

if [[ -n "$ENV_FILE" ]]; then
  echo "Uploading env file: $ENV_FILE"
  sshpass -p "$PASS" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$ENV_FILE" "$REMOTE:/tmp/questionnaire.env"
fi

sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$REMOTE" bash -s <<EOF
set -euo pipefail

echo "[remote] Updating packages"
sudo apt update -y

echo "[remote] Installing prerequisites"
sudo apt install -y ca-certificates curl gnupg lsb-release git

echo "[remote] Installing Docker (if absent)"
if ! command -v docker >/dev/null 2>&1; then
  sudo mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt update -y
  sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  sudo systemctl enable --now docker
fi

echo "[remote] Ensure target dir exists: ${TARGET_DIR}"
mkdir -p "${TARGET_DIR}"
cd "${TARGET_DIR}"

if [ ! -d ".git" ]; then
  echo "[remote] Cloning repository"
  git clone https://github.com/harshagiri/questionnaire.git .
else
  echo "[remote] Fetching latest"
  git fetch origin
fi

git checkout -f "${BRANCH}" || git checkout -b "${BRANCH}" origin/"${BRANCH}" || true
git reset --hard origin/"${BRANCH}" || true

echo "[remote] Preparing environment"
if [ -f /tmp/questionnaire.env ]; then
  mv /tmp/questionnaire.env .env
  chmod 600 .env
elif [ ! -f .env ]; then
  cp .env.example .env
fi

# Ensure SESSION_SECRET is set and random
if ! grep -q '^SESSION_SECRET=' .env 2>/dev/null || grep -q '^SESSION_SECRET="change-me-before-production"' .env 2>/dev/null; then
  SECRET=$(openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | base64)
  sed -i "/^SESSION_SECRET=/d" .env || true
  echo "SESSION_SECRET=\"${SECRET}\"" >> .env
fi

# Ensure DOCTORS_STORAGE_MODE defaults to auto if not set
if ! grep -q '^DOCTORS_STORAGE_MODE=' .env 2>/dev/null; then
  echo 'DOCTORS_STORAGE_MODE="auto"' >> .env
fi

echo "[remote] Starting containers with docker compose"
docker compose down || true
docker compose pull || true
docker compose up -d --build

if [ "${RUN_DOCTOR_MIGRATION}" = "true" ]; then
  echo "[remote] Running doctors migration inside app container"
  docker compose exec -T app npm run db:migrate:doctors
fi

echo "[remote] Deployment finished. Containers:"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'

EOF

echo "Deployment to ${REMOTE} complete. Visit your server's IP or domain to verify the app." 

echo "Security reminder: remove any temporary passwords and consider switching to SSH keys." 
