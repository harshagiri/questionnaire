Production deployment runbook (single Ubuntu droplet)

This file contains the detailed deployment flow. For the quick path, use README.md.

## 1. Recommended path

Run this from your local machine:

```bash
./scripts/deploy-one-command.sh
```

This command does all of the following:
1. Builds a linux/amd64 image locally.
2. Streams that image to the droplet.
3. Publishes it to droplet-local registry as localhost:5000/questionnaire:latest.
4. Deploys with docker compose in no-build mode.
5. Optionally configures HTTPS/firewall.

## 2. One-time setup

1. Create deploy secrets file:

```bash
cp .deploy.secrets.example .deploy.secrets
```

2. Update .deploy.secrets values.

Required:
- DEPLOY_REMOTE
- DEPLOY_SSH_PASSWORD

Important optional values:
- DEPLOY_CONFIGURE_HTTPS='true' to run HTTPS setup each deploy
- DEPLOY_HTTPS_DOMAIN='your.domain.com' for Let's Encrypt
- DEPLOY_HTTPS_DOMAIN_ALIASES='www.your.domain.com' for additional hostnames

## 3. Repeat deploy

```bash
./scripts/deploy-one-command.sh
```

## 4. Script reference

Primary wrapper:
- scripts/deploy-one-command.sh

Low-level deploy (image-based):

```bash
./scripts/deploy-with-sshpass.sh user@ip 'password' [branch] [remote_dir] [env_file] [run_doctor_migration] [app_image]
```

HTTPS/firewall setup:

```bash
./scripts/configure-https-firewall.sh user@ip 'password' [domain] [domain_aliases]
```

## 5. Verification

HTTP redirect:

```bash
curl -I http://YOUR_DROPLET_IP
```

HTTPS root:

```bash
curl -k -I https://YOUR_DROPLET_IP
```

Health endpoint:

```bash
curl -k https://YOUR_DROPLET_IP/api/health
```

## 6. Troubleshooting

If deploy hangs or fails:
1. Check SSH service on droplet: systemctl status ssh --no-pager
2. Check registry port: ss -lntp | grep :5000
3. Check registry container: docker ps | grep registry

Start registry if missing:

```bash
docker run -d --restart unless-stopped -p 5000:5000 --name registry registry:2
```

## 7. Security note

Password-based SSH is supported for quick setup. For production, move to SSH keys and disable password auth.

## 8. Demo users

- doctor@spinexpert.local / Doctor@123
- reception@spinexpert.local / Reception@123
- admin@spinexpert.local / Admin@123

## 9. Domain cutover checklist (spinexperts.in)

Use this when DNS may still be propagating and you want to continue droplet setup now.

1. In `.deploy.secrets`, set:

```bash
DEPLOY_REMOTE='root@YOUR_DROPLET_IP'
DEPLOY_SSH_PASSWORD='your_password'
DEPLOY_CONFIGURE_HTTPS='true'
DEPLOY_HTTPS_DOMAIN='spinexperts.in'
DEPLOY_HTTPS_DOMAIN_ALIASES='www.spinexperts.in'
```

2. Deploy app + droplet config in one run:

```bash
./scripts/deploy-one-command.sh
```

3. If DNS is not live yet, HTTPS provisioning may warn and continue. Re-run only HTTPS setup once records resolve:

```bash
./scripts/configure-https-firewall.sh "$DEPLOY_REMOTE" "$DEPLOY_SSH_PASSWORD" "$DEPLOY_HTTPS_DOMAIN" "$DEPLOY_HTTPS_DOMAIN_ALIASES"
```

4. Verify DNS and cutover:

```bash
dig +short spinexperts.in
dig +short www.spinexperts.in
```

5. Verify web + TLS:

```bash
curl -I http://spinexperts.in
curl -I https://spinexperts.in
curl -I https://www.spinexperts.in
```
