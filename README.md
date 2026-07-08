# Questionnaire

SpinExpert Health Screening is a role-based questionnaire app for patients, doctors, receptionists, and admins.

This guide is the step-by-step source of truth for local run and droplet deployment.

## 1. Prerequisites

Local machine:
- Docker Desktop (or Docker Engine with buildx)
- Node.js 20+
- npm
- sshpass (used by deployment scripts)

Droplet:
- Ubuntu with SSH access
- Docker installed (scripts will install if missing)

## 2. Local setup (first time)

1. Copy env template:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm ci
```

3. Generate Prisma client:

```bash
npm run db:generate
```

4. Run database migration:

```bash
npm run db:migrate
```

5. Start app:

```bash
npm run dev
```

App URL: http://localhost:3000

## 3. One-time deploy setup

1. Create deployment secrets file:

```bash
cp .deploy.secrets.example .deploy.secrets
```

2. Edit .deploy.secrets and set at minimum:
- DEPLOY_REMOTE
- DEPLOY_SSH_PASSWORD

Optional but useful defaults are already included in .deploy.secrets.example.

## 4. Deploy to droplet (repeatable one command)

Run:

```bash
./scripts/deploy-one-command.sh
```

What this command does:
1. Builds linux/amd64 image locally.
2. Streams image to droplet.
3. Publishes to droplet-local registry (localhost:5000).
4. Deploys with docker compose using no-build mode.

## 5. HTTPS mode

Default behavior:
- Deploy script only updates app stack.

To auto-configure HTTPS + firewall during deploy, set in .deploy.secrets:

```bash
DEPLOY_CONFIGURE_HTTPS='true'
DEPLOY_HTTPS_DOMAIN=''
```

Notes:
- Empty DEPLOY_HTTPS_DOMAIN means self-signed HTTPS on droplet IP.
- Set DEPLOY_HTTPS_DOMAIN to your real domain for Let's Encrypt TLS.

## 6. Useful operational commands

Health check:

```bash
curl -k https://YOUR_DROPLET_IP/api/health
```

HTTP to HTTPS redirect check:

```bash
curl -I http://YOUR_DROPLET_IP
```

## 7. Storage mode note

DOCTORS_STORAGE_MODE controls /api/doctors persistence:
- auto: database if available, fallback to data/doctors.json
- database: require PostgreSQL
- file: always local JSON file

If moving doctors from file to database:
1. Set DOCTORS_STORAGE_MODE=database
2. Run npm run db:migrate:doctors

## 8. Related docs

- Detailed deployment runbook: DEPLOYMENT.md
