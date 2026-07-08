#!/usr/bin/env bash
set -euo pipefail

# Configure firewall + nginx reverse proxy + HTTPS on remote droplet using sshpass.
# Usage:
#   ./scripts/configure-https-firewall.sh user@ip 'password' [domain]
# Examples:
#   ./scripts/configure-https-firewall.sh root@168.144.67.25 'YourPassword'
#   ./scripts/configure-https-firewall.sh root@168.144.67.25 'YourPassword' app.example.com

REMOTE=${1:?Please provide user@host}
PASS=${2:-}
DOMAIN=${3:-}

if [[ -z "$PASS" ]]; then
  read -r -s -p "SSH password for ${REMOTE}: " PASS
  echo
fi

if ! command -v sshpass >/dev/null 2>&1; then
  echo "sshpass not found. Install it first." >&2
  exit 1
fi

sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$REMOTE" "DOMAIN='${DOMAIN}' bash -s" <<'EOF'
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

run apt update -y
run apt install -y nginx ufw openssl

# Firewall rules
run ufw allow OpenSSH
run ufw allow 80/tcp
run ufw allow 443/tcp
run ufw --force enable

if [ -n "$DOMAIN" ]; then
  run apt install -y certbot python3-certbot-nginx

  cat <<NGINX_CONF | run tee /etc/nginx/sites-available/questionnaire > /dev/null
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location / {
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX_CONF

  run ln -sf /etc/nginx/sites-available/questionnaire /etc/nginx/sites-enabled/questionnaire
  run rm -f /etc/nginx/sites-enabled/default
  run nginx -t
  run systemctl reload nginx

  # Issue trusted TLS cert (domain must point to droplet IP)
  run certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@"$DOMAIN" --redirect
else
  # Self-signed cert for direct IP HTTPS access (browser warning expected)
  run mkdir -p /etc/ssl/questionnaire
  run openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout /etc/ssl/questionnaire/selfsigned.key \
    -out /etc/ssl/questionnaire/selfsigned.crt \
    -subj "/CN=168.144.67.25"

  cat <<'NGINX_HTTP' | run tee /etc/nginx/sites-available/questionnaire > /dev/null
server {
    listen 80;
    listen [::]:80;
    server_name _;
    return 301 https://$host$request_uri;
}
NGINX_HTTP

  cat <<'NGINX_HTTPS' | run tee /etc/nginx/sites-available/questionnaire-ssl > /dev/null
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name _;

    ssl_certificate /etc/ssl/questionnaire/selfsigned.crt;
    ssl_certificate_key /etc/ssl/questionnaire/selfsigned.key;

    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX_HTTPS

  run ln -sf /etc/nginx/sites-available/questionnaire /etc/nginx/sites-enabled/questionnaire
  run ln -sf /etc/nginx/sites-available/questionnaire-ssl /etc/nginx/sites-enabled/questionnaire-ssl
  run rm -f /etc/nginx/sites-enabled/default
  run nginx -t
  run systemctl reload nginx
fi

echo "HTTPS/proxy/firewall configuration complete"
run ufw status
run systemctl status nginx --no-pager -l | sed -n '1,20p'
EOF
