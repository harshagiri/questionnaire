Production deployment instructions for a single Droplet (password or SSH-key)

This document explains how to deploy the repository to a Linux droplet (Ubuntu 22.04+) at a public IP.
It does NOT contain any secrets. You must run the commands yourself on your local machine and on the droplet.

Overview
- Prepare the droplet: create a non-root user, install Docker and Docker Compose plugin, optionally set up an SSH key.
- Push your code to a Git remote accessible from the droplet (GitHub/GitLab) or copy the project using scp/rsync.
- On the droplet, create a `.env` file (copy from `.env.example`), run `docker compose up -d --build`.
- Configure an Nginx reverse proxy and obtain TLS via Certbot if you want a public HTTPS site.

Security note
- Password-based SSH is convenient for first-time access but is less secure than key-based authentication. After you finish setup, strongly consider adding an SSH key and disabling PasswordAuthentication in `/etc/ssh/sshd_config`.

Quick commands (assumes Ubuntu, run as your remote sudo-capable user)

1) Update & install dependencies on the droplet

  sudo apt update && sudo apt upgrade -y
  sudo apt install -y ca-certificates curl gnupg lsb-release git nginx

2) Install Docker (official guide)

  sudo mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt update
  sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  sudo usermod -aG docker $USER

3) Clone repo on droplet (example)

  # on the droplet
  git clone https://github.com/<your-org-or-username>/questionnaire.git /home/$USER/questionnaire
  cd /home/$USER/questionnaire

4) Create environment and run docker compose

  cp .env.example .env
  # edit .env and set SESSION_SECRET and any production DATABASE_URL if used
  docker compose up -d --build

5) Configure Nginx as reverse proxy (example config included in repo `deploy/nginx/questionnaire.conf`)

  sudo ln -s /etc/nginx/sites-available/questionnaire /etc/nginx/sites-enabled/questionnaire
  sudo nginx -t && sudo systemctl reload nginx

6) (Optional) Obtain TLS certificate using Certbot

  sudo apt install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d your.domain.example

Rolling updates
- To deploy a new version: on droplet `git pull origin master` and `docker compose up -d --build`.

If you want an automated script that does everything from your workstation using password SSH (insecure) or using an SSH key (recommended), see `scripts/deploy-to-droplet.sh` and `scripts/remote-setup.sh` in this repo. You must run those locally — I cannot run them for you.

One-shot deploy with sshpass (includes Docker install + optional env upload + optional doctors migration)

- Script: `scripts/deploy-with-sshpass.sh`
- Signature:

  `./scripts/deploy-with-sshpass.sh user@ip 'password' [branch] [remote_dir] [env_file] [run_doctor_migration]`

- Example 1 (deploy with generated/existing remote `.env`, no migration):

  `./scripts/deploy-with-sshpass.sh ubuntu@168.144.67.25 'YourPassword' main /home/ubuntu/questionnaire`

- Example 2 (upload local env file and run doctors migration):

  `./scripts/deploy-with-sshpass.sh ubuntu@168.144.67.25 'YourPassword' main /home/ubuntu/questionnaire ./.env.production true`

Notes:
- If `env_file` is provided, it is uploaded to the droplet and used as `.env`.
- If `run_doctor_migration=true`, the script runs `npm run db:migrate:doctors` inside the app container after `docker compose up -d --build`.

HTTPS + firewall + proxy hardening

- Script: `scripts/configure-https-firewall.sh`
- Signature:

  `./scripts/configure-https-firewall.sh user@ip 'password' [domain]`

- Example 1 (IP-only HTTPS, self-signed certificate):

  `./scripts/configure-https-firewall.sh root@168.144.67.25 'YourPassword'`

- Example 2 (trusted HTTPS with domain via Let's Encrypt):

  `./scripts/configure-https-firewall.sh root@168.144.67.25 'YourPassword' app.yourdomain.com`

This script does the following on the droplet:
- Installs/ensures `nginx`, `ufw`, and TLS tools.
- Opens firewall ports `22`, `80`, and `443`.
- Configures nginx reverse proxy to `http://127.0.0.1:3000`.
- Enables HTTPS:
  - self-signed cert when no domain is provided, or
  - trusted cert (Let's Encrypt) when a domain is provided and DNS points to droplet.

Staff credentials and user management

- Default demo users:
  - `doctor@spinexpert.local / Doctor@123`
  - `reception@spinexpert.local / Reception@123`
  - `admin@spinexpert.local / Admin@123`
- Admin can create additional `doctor`, `receptionist`, and `admin` users from the Admin panel.
