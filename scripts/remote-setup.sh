#!/usr/bin/env bash
set -euo pipefail

# Usage (on droplet as sudo-capable user):
#   curl -sL https://raw.githubusercontent.com/<you>/<repo>/main/scripts/remote-setup.sh | sudo bash
# Or copy this file to the droplet and run: sudo bash remote-setup.sh

apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg lsb-release git nginx

# Install Docker
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable --now docker

echo "Docker installed and started. Add your user to the docker group if you plan to use docker without sudo."

echo "Setup complete. Next: clone the project, copy .env, then run the local image build-and-push deploy script."
