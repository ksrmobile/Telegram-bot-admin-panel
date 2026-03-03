## Troubleshooting KSR TG Bot Panel

### Panel does not start

- Check Docker status:

```bash
sudo systemctl status docker
```

- Check panel container:

```bash
cd /opt/ksr-tg-bot-panel
docker compose -f docker/docker-compose.yml ps
docker logs -f ksr-tg-bot-panel
```

- Validate `.env`:
  - Ensure `SESSION_SECRET` is set
  - Ensure `DATABASE_URL` points to a writeable location (default: `file:/data/ksr-panel.db`)
  - Ensure `PROJECTS_ROOT` is `/data/projects`

### Cannot log in

- Confirm the credentials printed by `scripts/install.sh`
- If you changed `ADMIN_PASS` in `.env`, restart the panel:

```bash
cd /opt/ksr-tg-bot-panel
docker compose -f docker/docker-compose.yml up -d --build
```

- If the database got out of sync, you can delete it (this resets users and projects):

```bash
sudo rm /var/lib/ksr-tg-panel/data/ksr-panel.db
cd /opt/ksr-tg-bot-panel
docker compose -f docker/docker-compose.yml up -d --build
```

> This is destructive. Only do this if you intentionally want a clean slate.

### Bots are not starting

- Open the project and:
  - Verify `Files` tab: your bot code is present
  - Verify `Config` tab: `BOT_TOKEN` and other required vars are set
- Check **Runner** tab for exit code and timestamps
- Check container logs in **Logs** tab

On the host:

```bash
docker ps
docker logs -f ksr-bot-<project-slug>
```

### SSE logs not streaming

- Ensure the bot container is running
- Check browser dev tools:
  - Network → `logs` SSE endpoint should be connected
- Check CORS/proxy settings if you put a reverse proxy in front of the panel

### File uploads or backups fail

- Size limits:
  - ZIP extraction enforces a max file count and total size (~500MB by default)
  - Very large projects may need manual copy over SSH instead of ZIP upload
- Permission issues on host:

```bash
sudo chown -R root:root /var/lib/ksr-tg-panel
sudo chmod -R 755 /var/lib/ksr-tg-panel
```

The panel container runs as root by default to simplify file management under `/data`.

### Docker socket security warning

Mounting `/var/run/docker.sock` allows the panel to control Docker on the host. If an attacker gains access to the panel, they can gain root on the host.

Mitigations:

- Only run the panel on a **single-tenant VPS you control**
- Restrict network access:
  - Bind panel behind a reverse proxy on `127.0.0.1`
  - Use firewall rules (UFW, security groups) to limit access
- Rotate `SESSION_SECRET` and `ADMIN_PASS` periodically

### Upgrading the panel

1. Copy the new version of the project to the server
2. Re-run the installer or `scripts/update.sh`:

```bash
cd /opt/ksr-tg-bot-panel
sudo bash scripts/update.sh
```

This keeps the data directory (`/var/lib/ksr-tg-panel/data`) intact.

