#!/usr/bin/env bash
set -euo pipefail

# Configure firewall + nginx reverse proxy + HTTPS on remote droplet using sshpass.
# Usage:
#   ./scripts/configure-https-firewall.sh user@ip 'password' [domain] [domain_aliases]
# Examples:
#   ./scripts/configure-https-firewall.sh root@168.144.67.25 'YourPassword'
#   ./scripts/configure-https-firewall.sh root@168.144.67.25 'YourPassword' spinexperts.in
#   ./scripts/configure-https-firewall.sh root@168.144.67.25 'YourPassword' spinexperts.in 'www.spinexperts.in'

REMOTE=${1:?Please provide user@host}
PASS=${2:-${DEPLOY_SSH_PASSWORD:-}}
DOMAIN=${3:-}
DOMAIN_ALIASES=${4:-}

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

if ! command -v sshpass >/dev/null 2>&1; then
  echo "sshpass not found. Install it first." >&2
  exit 1
fi

sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$REMOTE" "DOMAIN='${DOMAIN}' DOMAIN_ALIASES='${DOMAIN_ALIASES}' bash -s" <<'EOF'
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

  # Build server_name list from primary domain + aliases.
  SERVER_NAMES="$DOMAIN"
  if [ -n "${DOMAIN_ALIASES:-}" ]; then
    # Accept comma- or space-separated aliases.
    NORMALIZED_ALIASES=$(echo "$DOMAIN_ALIASES" | tr ',' ' ')
    for alias in $NORMALIZED_ALIASES; do
      if [ "$alias" != "$DOMAIN" ]; then
        SERVER_NAMES="$SERVER_NAMES $alias"
      fi
    done
  elif [ "${DOMAIN#www.}" = "$DOMAIN" ]; then
    # If no alias provided and domain is apex, include www automatically.
    SERVER_NAMES="$SERVER_NAMES www.$DOMAIN"
  fi

    cat <<NGINX_CONF | run tee /etc/nginx/sites-available/questionnaire > /dev/null
  # Block direct IP access / unknown hostnames over HTTP.
  server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
  }

  # Block direct IP access / unknown hostnames over HTTPS.
  server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;
    ssl_reject_handshake on;
  }

server {
    listen 80;
    listen [::]:80;
    server_name ${SERVER_NAMES};

    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${SERVER_NAMES};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

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
  # Issue trusted TLS cert (domains must point to droplet IP).
  CERTBOT_DOMAINS_ARGS=""
  for name in $SERVER_NAMES; do
    CERTBOT_DOMAINS_ARGS="$CERTBOT_DOMAINS_ARGS -d $name"
  done

  # Do not abort setup if DNS propagation is still in progress.
  if run certbot certonly --nginx $CERTBOT_DOMAINS_ARGS --non-interactive --agree-tos -m admin@"$DOMAIN"; then
    echo "Let's Encrypt certificate issued for: $SERVER_NAMES"
  else
    echo "WARNING: certbot failed. Most likely DNS has not propagated yet."
    echo "Rerun after DNS is live: certbot certonly --nginx $CERTBOT_DOMAINS_ARGS --non-interactive --agree-tos -m admin@$DOMAIN"

    # Fall back to HTTP-only domain config until certificate is available.
    if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
      cat <<FALLBACK_NGINX_CONF | run tee /etc/nginx/sites-available/questionnaire > /dev/null
# Block direct IP access / unknown hostnames over HTTP.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}

# Block direct IP access / unknown hostnames over HTTPS.
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;
    ssl_reject_handshake on;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${SERVER_NAMES};

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
FALLBACK_NGINX_CONF
    fi
  fi

  run nginx -t
  run systemctl reload nginx
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
