#!/usr/bin/env bash
set -euo pipefail

# One-command production deploy using a droplet-local image registry.
# Steps:
# 1) Build linux/amd64 app image locally.
# 2) Stream image to droplet and push into droplet-local registry.
# 3) Deploy app using scripts/deploy-with-sshpass.sh (no server-side build).
# 4) Optionally configure HTTPS/firewall.
#
# Usage:
#   ./scripts/deploy-one-command.sh
#
# Required secrets (in ./.deploy.secrets or environment):
#   DEPLOY_REMOTE=root@168.144.67.25
#   DEPLOY_SSH_PASSWORD='your_password'
#
# Optional:
#   DEPLOY_BRANCH=main
#   DEPLOY_TARGET_DIR=/root/questionnaire
#   DEPLOY_ENV_FILE=./.env
#   DEPLOY_RUN_DOCTOR_MIGRATION=false
#   DEPLOY_LOCAL_IMAGE=questionnaire:latest
#   DEPLOY_APP_IMAGE=localhost:5000/questionnaire:latest
#   DEPLOY_CONFIGURE_HTTPS=false
#   DEPLOY_HTTPS_DOMAIN=
#   DEPLOY_HTTPS_DOMAIN_ALIASES=

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

if [[ -f ./.deploy.secrets ]]; then
  # shellcheck disable=SC1091
  source ./.deploy.secrets
fi

DEPLOY_REMOTE=${DEPLOY_REMOTE:-}
DEPLOY_SSH_PASSWORD=${DEPLOY_SSH_PASSWORD:-}
DEPLOY_BRANCH=${DEPLOY_BRANCH:-main}
DEPLOY_TARGET_DIR=${DEPLOY_TARGET_DIR:-/root/questionnaire}
DEPLOY_ENV_FILE=${DEPLOY_ENV_FILE:-./.env}
DEPLOY_RUN_DOCTOR_MIGRATION=${DEPLOY_RUN_DOCTOR_MIGRATION:-false}
DEPLOY_RESET_DATABASE=${DEPLOY_RESET_DATABASE:-false}
DEPLOY_CONFIGURE_HTTPS=${DEPLOY_CONFIGURE_HTTPS:-false}
DEPLOY_HTTPS_DOMAIN=${DEPLOY_HTTPS_DOMAIN:-}
DEPLOY_HTTPS_DOMAIN_ALIASES=${DEPLOY_HTTPS_DOMAIN_ALIASES:-}

IMAGE_TAG=${DEPLOY_IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)-$(date +%Y%m%d%H%M%S)}
DEPLOY_LOCAL_IMAGE=${DEPLOY_LOCAL_IMAGE:-questionnaire:${IMAGE_TAG}}
DEPLOY_APP_IMAGE=${DEPLOY_APP_IMAGE:-localhost:5000/questionnaire:${IMAGE_TAG}}

if [[ -z "$DEPLOY_REMOTE" ]]; then
  echo "Missing DEPLOY_REMOTE. Set it in ./.deploy.secrets or env." >&2
  exit 1
fi

if [[ -z "$DEPLOY_SSH_PASSWORD" ]]; then
  echo "Missing DEPLOY_SSH_PASSWORD. Set it in ./.deploy.secrets or env." >&2
  exit 1
fi

if [[ "$DEPLOY_RESET_DATABASE" == "true" ]]; then
  echo "[local] Pruning unused Docker data on droplet before pushing the new image"
  sshpass -p "$DEPLOY_SSH_PASSWORD" ssh \
    -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$DEPLOY_REMOTE" \
    "docker system prune -af --volumes || true"
fi

echo "[local] Recreating droplet-local registry"
sshpass -p "$DEPLOY_SSH_PASSWORD" ssh \
  -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$DEPLOY_REMOTE" \
  "docker rm -f registry >/dev/null 2>&1 || true && docker run -d --restart unless-stopped -p 5000:5000 --name registry registry:2 >/dev/null"

if [[ "$DEPLOY_RUN_DOCTOR_MIGRATION" != "true" && "$DEPLOY_RUN_DOCTOR_MIGRATION" != "false" ]]; then
  echo "DEPLOY_RUN_DOCTOR_MIGRATION must be true or false." >&2
  exit 1
fi

if [[ "$DEPLOY_CONFIGURE_HTTPS" != "true" && "$DEPLOY_CONFIGURE_HTTPS" != "false" ]]; then
  echo "DEPLOY_CONFIGURE_HTTPS must be true or false." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required on local machine." >&2
  exit 1
fi

if ! command -v sshpass >/dev/null 2>&1; then
  echo "sshpass is required on local machine." >&2
  exit 1
fi

chmod +x ./scripts/deploy-with-sshpass.sh ./scripts/configure-https-firewall.sh

echo "[local] Building linux/amd64 image: ${DEPLOY_LOCAL_IMAGE}"
docker buildx build --platform linux/amd64 --load -t "$DEPLOY_LOCAL_IMAGE" .

echo "[local] Streaming image to droplet and publishing to ${DEPLOY_APP_IMAGE}"
docker save "$DEPLOY_LOCAL_IMAGE" | sshpass -p "$DEPLOY_SSH_PASSWORD" ssh \
  -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$DEPLOY_REMOTE" \
  "docker load && docker tag ${DEPLOY_LOCAL_IMAGE} ${DEPLOY_APP_IMAGE} && docker push ${DEPLOY_APP_IMAGE}"

echo "[local] Deploying application stack"
./scripts/deploy-with-sshpass.sh \
  "$DEPLOY_REMOTE" \
  "$DEPLOY_SSH_PASSWORD" \
  "$DEPLOY_BRANCH" \
  "$DEPLOY_TARGET_DIR" \
  "$DEPLOY_ENV_FILE" \
  "$DEPLOY_RUN_DOCTOR_MIGRATION" \
  "$DEPLOY_APP_IMAGE"

if [[ "$DEPLOY_CONFIGURE_HTTPS" == "true" ]]; then
  echo "[local] Configuring HTTPS/firewall"
  ./scripts/configure-https-firewall.sh "$DEPLOY_REMOTE" "$DEPLOY_SSH_PASSWORD" "$DEPLOY_HTTPS_DOMAIN" "$DEPLOY_HTTPS_DOMAIN_ALIASES"
fi

echo "[local] Done."
