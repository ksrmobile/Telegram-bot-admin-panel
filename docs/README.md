## KSR TG Bot Panel

Self-hosted, single-tenant control panel for managing Telegram bot projects on an Ubuntu VPS. Bots are run in Docker containers, and the panel itself is deployed via Docker Compose.

### Features

- **Modern premium UI** with dark/light themes (dark default), purple accents, and sidebar layout
- **Authentication** with bcrypt-hashed admin user, httpOnly session cookie, and basic rate limiting
- **Projects** for each bot workspace with runtime metadata
- **File manager** with safe root restriction, ZIP upload/extract, and inline editor
- **Config editor** for `.env` (BOT_TOKEN, API keys, webhooks, ports)
- **Per-bot Docker runner** with image build, container start/stop/restart
- **Real-time logs** via SSE for each bot container
- **Backups** to export/restore project ZIPs

### High-level architecture

- **Frontend**: Next.js App Router (Node runtime) + TailwindCSS + shadcn-style components + `next-themes`
- **Backend**: Next.js route handlers & server components, Prisma ORM with SQLite
- **Bot runner**: Docker Engine on host; panel container mounts `/var/run/docker.sock`
- **Data**:
  - Panel DB: `DATABASE_URL=file:/data/ksr-panel.db`
  - Project workspaces: `/data/projects/<slug>` (inside container), mapped to `/var/lib/ksr-tg-panel/data/projects/<slug>` on host

### Requirements

- Ubuntu 22.04 or 24.04 VPS
- Root or sudo access
- Open outbound internet (for Docker and package downloads)

---

## Installation (recommended)

1. **Copy project to server**

Upload this repository to the server, e.g. to `/root/ksr-tg-bot-panel-src`:

- Using `scp`:

```bash
scp -r ./ksr-tg-bot-panel-src root@SERVER_IP:/root/ksr-tg-bot-panel-src
```

2. **Run the installer**

```bash
cd /root/ksr-tg-bot-panel-src
sudo bash scripts/install.sh
```

The installer will:

- Install Docker & Docker Compose plugin if needed
- Create:
  - `/opt/ksr-tg-bot-panel` (panel code, Dockerfile, prisma schema)
  - `/var/lib/ksr-tg-panel/data` (panel DB + project workspaces)
- Generate `.env` with:
  - `PANEL_PORT` (default 8080)
  - `ADMIN_USER` (default `admin`)
  - `ADMIN_PASS` (prompt / auto-generate)
  - `SESSION_SECRET` random hex
  - `DATABASE_URL=file:/data/ksr-panel.db`
  - `PROJECTS_ROOT=/data/projects`
  - `DOCKER_SOCKET=/var/run/docker.sock`
- Run:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

3. **Access the panel**

- Visit `http://SERVER_IP:8080` (or your chosen `PANEL_PORT`)
- Log in with the credentials printed by the installer

4. **Optional: Configure UFW**

```bash
sudo ufw allow 22/tcp
sudo ufw allow 8080/tcp   # or your PANEL_PORT
sudo ufw enable
```

> For production, strongly consider placing the panel behind an HTTPS reverse proxy and only exposing TLS externally.

---

## Local development

1. Install dependencies:

```bash
npm install
```

2. Set up `.env` in project root:

```bash
cp .env.example .env   # if present, else create manually
```

Minimal variables:

```bash
PANEL_PORT=8080
ADMIN_USER=admin
ADMIN_PASS=changeme
SESSION_SECRET=dev-secret-please-change
DATABASE_URL="file:./prisma/dev.db"
PROJECTS_ROOT="./data/projects"
DOCKER_SOCKET="/var/run/docker.sock"
```

3. Run migrations and dev server:

```bash
npx prisma migrate dev --name init
npm run dev
```

Open `http://localhost:3000/login`.

> For Docker-controlled bots on your dev machine, ensure your user can access `/var/run/docker.sock` or run Docker Desktop with the socket exposed.

---

## Operational notes

### Docker socket

The panel container mounts the host Docker socket:

- `- /var/run/docker.sock:/var/run/docker.sock`

This allows the panel to:

- Build images for each project
- Run/stop/restart containers per project
- Fetch logs for SSE streaming

**Security:** anyone with access to the panel effectively has Docker root on the host. This design assumes **single-tenant** usage on a trusted VPS.

### Data layout

- Panel DB and project workspaces live under:
  - Host: `/var/lib/ksr-tg-panel/data`
  - Container: `/data`
- Each project:
  - Host: `/var/lib/ksr-tg-panel/data/projects/<slug>`
  - Container: `/data/projects/<slug>`

All file operations in the UI are restricted to this root; path traversal is prevented at the server layer.

---

## Core flows

### Create a project

1. Log in and go to **Projects → New project**
2. Enter:
   - Name (used to derive slug)
   - Runtime template: Node / Python / Dockerfile
   - Start command (e.g. `npm start`, `python bot.py`)
3. The panel:
   - Creates the workspace directory under `/data/projects/<slug>`
   - Stores runtime metadata in the Prisma `Project` table

### Upload a bot

1. Open the project detail page
2. Switch to the **Files** tab
3. Use **Upload ZIP**:
   - The ZIP is uploaded to the server
   - Extracted with **safe extraction**:
     - Rejects `..` and absolute paths
     - Rejects symlinks
     - Enforces max file count and total size
4. Edit files, rename, or delete as needed

### Configure environment

1. Switch to **Config** tab
2. Set keys like:
   - `BOT_TOKEN`
   - `WEBHOOK_URL`
   - `PORT`
   - Any other required secrets
3. Click **Apply & Restart**:
   - Writes `.env` into the project workspace
   - Optionally restarts the container using updated env vars

### Run the bot

1. Switch to **Runner** tab
2. Configure CPU and memory limits if desired
3. Click **Start**
4. The panel:
   - Builds an image for the project:
     - Uses project `Dockerfile` if present
     - Otherwise generates a template Dockerfile for Node/Python
   - Starts a container with:
     - Bind mount of workspace directory
     - Restart policy `unless-stopped`
     - Env injected from `.env`
5. Use **Stop** or **Restart** as needed

### Logs

1. Switch to **Logs** tab
2. Logs stream in real time via SSE from the Docker container:
   - Pause/resume streaming
   - Filter by search term
   - Download logs as a text file

### Backups

1. Switch to **Backups** tab
2. **Export ZIP**:
   - Creates a ZIP of the entire project workspace
   - Downloads it to your machine
3. **Restore from ZIP**:
   - Upload a backup ZIP
   - Safely extracts into the project workspace (same protections as uploads)

---

## Security considerations

- **Auth required**: all routes except `/login` and `/api/health` require an authenticated session
- **Sessions**:
  - Signed JWT stored in httpOnly cookie
  - SameSite=Lax to reduce CSRF risk
- **Rate limiting**:
  - In-memory count per IP for login attempts with lockout
- **CSRF**:
  - Uses a CSRF token cookie and `x-csrf-token` header for state-changing API calls (uploads, writes, runner actions, backups)
- **File safety**:
  - All file paths are resolved relative to `/data/projects/<slug>` with normalization and prefix checks
  - ZIP extraction:
    - Rejects `..`, absolute paths, and symlinks
    - Enforces max files and max size
- **Secrets**:
  - Env keys containing `TOKEN`, `SECRET`, `KEY`, `PASS` are masked in the UI by default
  - Admin password is stored hashed in the database (bcrypt)

---

## Docker commands cheat sheet

- Check panel status:

```bash
cd /opt/ksr-tg-bot-panel
docker compose -f docker/docker-compose.yml ps
```

- View panel logs:

```bash
docker logs -f ksr-tg-bot-panel
```

- Restart panel:

```bash
cd /opt/ksr-tg-bot-panel
docker compose -f docker/docker-compose.yml restart
```

For more operational tips, see `docs/TROUBLESHOOTING.md`.

