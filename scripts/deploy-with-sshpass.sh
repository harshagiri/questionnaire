#!/usr/bin/env bash
set -euo pipefail

# One-shot deploy to a droplet using password-based SSH (sshpass).
# WARNING: Using password-based SSH is less secure than SSH keys. Use this only for quick testing.
# Usage: ./scripts/deploy-with-sshpass.sh user@ip [password] [branch] [remote_dir] [env_file] [run_doctor_migration] [app_image]
# Example:
#   ./scripts/deploy-with-sshpass.sh ubuntu@168.144.67.25 'P@ssw0rd' main /home/ubuntu/questionnaire ./.env.production true localhost:5000/questionnaire:latest

REMOTE=${1:?Please specify user@host}
PASS=${2:-${DEPLOY_SSH_PASSWORD:-}}
BRANCH=${3:-main}
TARGET_DIR=${4:-/home/${REMOTE%%@*}/questionnaire}
ENV_FILE=${5:-}
RUN_DOCTOR_MIGRATION=${6:-false}
APP_IMAGE=${7:-}
RESET_DATABASE=${DEPLOY_RESET_DATABASE:-false}

# Optional local secrets file (never commit secrets):
#   ./.deploy.secrets containing: DEPLOY_SSH_PASSWORD='your_password'
if [[ -z "$PASS" && -f ./.deploy.secrets ]]; then
  # shellcheck disable=SC1091
  source ./.deploy.secrets
  PASS=${DEPLOY_SSH_PASSWORD:-}
fi

if [[ -z "$PASS" ]]; then
  read -r -s -p "SSH password for ${REMOTE}: " PASS
  echo
fi

if [[ "$RUN_DOCTOR_MIGRATION" != "true" && "$RUN_DOCTOR_MIGRATION" != "false" ]]; then
  echo "run_doctor_migration must be 'true' or 'false'" >&2
  exit 1
fi

if [[ "$RESET_DATABASE" != "true" && "$RESET_DATABASE" != "false" ]]; then
  echo "DEPLOY_RESET_DATABASE must be true or false." >&2
  exit 1
fi

if [[ -z "$APP_IMAGE" ]]; then
  echo "app_image is required. Pass the pushed image tag from the local build step." >&2
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

sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$REMOTE" "TARGET_DIR='${TARGET_DIR}' BRANCH='${BRANCH}' RUN_DOCTOR_MIGRATION='${RUN_DOCTOR_MIGRATION}' RESET_DATABASE='${RESET_DATABASE}' APP_IMAGE='${APP_IMAGE}' bash -s" <<'EOF'
set -euo pipefail

if command -v sudo >/dev/null 2>&1 && [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
else
  SUDO=""
fi

run() {
  if [ -n "$SUDO" ]; then
    $SUDO "$@"
  else
    "$@"
  fi
}

echo "[remote] Updating packages"
run apt update -y

echo "[remote] Installing prerequisites"
run apt install -y ca-certificates curl gnupg lsb-release git

echo "[remote] Installing Docker (if absent)"
if ! command -v docker >/dev/null 2>&1; then
  run mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | run gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | run tee /etc/apt/sources.list.d/docker.list > /dev/null
  run apt update -y
  run apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  run systemctl enable --now docker
fi

echo "[remote] Ensure target dir exists: ${TARGET_DIR}"
mkdir -p "${TARGET_DIR}"
cd "${TARGET_DIR}"

if [ ! -d ".git" ]; then
  echo "[remote] Cloning repository"
  git clone https://github.com/harshagiri/questionnaire.git .
else
  echo "[remote] Fetching latest compose/config"
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
if [ "${RESET_DATABASE}" = "true" ]; then
  echo "[remote] Resetting database volume"
  docker compose down -v || true
else
  docker compose down || true
fi
docker compose pull || true
docker compose up -d --no-build --force-recreate

echo "[remote] Syncing Prisma schema"
docker compose exec -T app npm run db:push

if [ "${RUN_DOCTOR_MIGRATION}" = "true" ]; then
  echo "[remote] Applying Prisma schema to database"
  echo "[remote] Running doctors migration inside app container"
  docker compose exec -T app npm run db:migrate:doctors
fi

echo "[remote] Deployment finished. Containers:"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'

EOF

echo "Deployment to ${REMOTE} complete. Visit your server's IP or domain to verify the app." 

echo "Security reminder: remove any temporary passwords and consider switching to SSH keys." 
