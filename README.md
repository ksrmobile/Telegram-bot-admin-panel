# Telegram Bot Admin Panel

Premium, self‑hosted admin panel for managing your Telegram bot fleet on an Ubuntu VPS. Built on **Next.js + TypeScript + Prisma + Docker**, with a modern SaaS‑style UI, Template Mode for non‑Docker repos, and deep Docker integration.

> Production‑ready control panel for cloning, configuring, building, and running Telegram bots — without SSHing into the server.

---

## ✨ Highlights

- **Modern dashboard UI**  
  - Dark + light themes with purple accents  
  - Sidebar layout, responsive down to mobile  
  - Command palette (`Ctrl+K`) for fast navigation

- **Secure authentication**  
  - Admin user with bcrypt‑hashed password  
  - HttpOnly session cookie, CSRF token, basic rate limiting

- **Project workspaces for each bot**  
  - Per‑bot workspace under `/data/projects/<slug>`  
  - File manager with ZIP upload, extract, and inline editor  
  - Config editor for `.env` (BOT_TOKEN, API keys, ports, etc.)

- **Docker‑native runner**  
  - Template Mode for repos **without** Dockerfile (Python/Node/Custom)  
  - Dockerfile Mode for repos with their own Dockerfile  
  - Build, rebuild (no cache), start, stop, restart with resource limits  
  - Optional auto‑restart after successful build jobs

- **Real‑time logs & diagnostics**  
  - SSE streaming logs with search, copy, and download  
  - Clean UTF‑8 text (control chars + ANSI stripped)  
  - Diagnose card for common failures (ffmpeg missing, wheel build errors, missing BOT_TOKEN, wrong start command)

- **Git workflow**  
  - Clone repo into workspace from URL (`https://...` or `git@...`)  
  - Git status card: remote URL, branch, last commit hash/time  
  - Actions: **Pull**, **Pull + rebuild**, **Pull + rebuild + restart**

- **Storage & backups**  
  - Per‑project view: workspace size + build‑contexts size  
  - Cleanup tools: delete build contexts, delete temp backups  
  - System Storage card: total projects + build contexts; prune dangling images  
  - Backup/restore project ZIPs

---

## 🧱 Tech Stack

- **Frontend**: Next.js App Router, React, TypeScript, TailwindCSS, shadcn‑style components, `next-themes`
- **Backend**: Next.js Route Handlers & Server Components
- **Data**: Prisma ORM with SQLite
- **Runtime**: Docker Engine (panel + bot containers)

Data layout (inside panel container):

- Panel DB: `DATABASE_URL=file:./prisma/dev.db` (or mapped volume in Docker)
- Project workspaces: `/data/projects/<slug>`
- Build contexts: `/data/build-contexts/<projectId>`

---

## 🚀 Quick start (development)

```bash
git clone https://github.com/your-org/telegram-bot-admin-panel.git
cd telegram-bot-admin-panel

cp .env.example .env   # adjust ports / DB if needed
npm install
npx prisma db push
npm run dev
```

Then open `http://localhost:3000/login` and sign in with the admin credentials configured in `.env`.

> The panel expects access to Docker. On local dev, either run Docker Desktop or have `DOCKER_HOST` / `/var/run/docker.sock` available.

---

## 🏗️ Production (Ubuntu VPS + Docker)

High‑level steps:

1. **Provision Ubuntu VPS** (22.04 or 24.04 recommended).
2. **Install Docker & Docker Compose plugin**.
3. **Clone this repo onto the server** (e.g., `/opt/telegram-bot-admin-panel`).
4. Configure `.env` for production:
   - `PANEL_PORT=8080`
   - `ADMIN_USER=admin`
   - `ADMIN_PASSWORD_HASH=...` (bcrypt hash)
   - `PROJECTS_ROOT=/data/projects`
5. Use the provided `docker-compose.yml` (or your own) to run:
   - Panel container
   - SQLite volume + `/data/projects` volume
   - Mount Docker socket: `/var/run/docker.sock:/var/run/docker.sock`
6. Put the panel **behind HTTPS** via reverse proxy (Caddy / Nginx) or Cloudflare Tunnel.

For detailed installation notes, see [`docs/README.md`](./docs/README.md).

---

## 💡 Usage overview

### 1. Create a project

1. Go to **Projects → New project**.
2. Choose:
   - **Empty workspace**
   - **Upload ZIP**
   - **Template starter**
3. The panel creates a workspace under `/data/projects/<slug>`.

### 2. Import code

- Option A – **Git clone** (recommended for real projects):
  - Open the project → **Settings → Git repository**.
  - Paste your repo URL and optional branch.
  - Click **Clone repository**.

- Option B – **Upload ZIP**:
  - Go to **Files** tab.
  - Upload a ZIP and extract into workspace.

### 3. Configure Template Mode (for repos without Dockerfile)

1. Open **Runner** tab.
2. Set **Mode: Template mode**.
3. Choose runtime (Python / Node / Custom).
4. Select a **toolkit preset**:
   - Python Basic
   - Python + Build Tools
   - Python + FFmpeg
   - Node Basic
   - Node + FFmpeg
   - Downloader Kit
5. The panel will auto‑suggest a start command based on files:
   - Python: `bot.py` → `python bot.py`, etc.
   - Node: `package.json` `scripts.start` → `npm run start`, else `node index.js`.
6. Apply the suggestion, then click **Build**.

Builds run as background jobs with logs and diagnostics visible in the Runner tab.

### 4. Configure environment

- Go to **Config** tab.
- Edit `.env` (e.g. `BOT_TOKEN`, DB credentials, API keys).
- Save and restart container when ready.

### 5. Run and monitor

- **Runner**:
  - Start / Stop / Restart container.
  - See container status, last exit code, resource limits.
  - View build jobs + tail logs + suggested fixes.

- **Logs**:
  - Live streaming logs (SSE).
  - Filter by text, copy last 200 lines, or download `.log` snapshot.

---

## 🧪 Health & storage tools

- **System → Storage**:
  - Total size of all project workspaces.
  - Total size of build contexts.
  - One‑click prune of dangling Docker images.

- **Per‑project → Settings → Storage**:
  - Workspace size + build‑context size.
  - Actions:
    - Delete build contexts (safe; rebuilt on next build).
    - Delete temporary backup ZIPs (keeps last N).

---

## 🤝 Contributing

Contributions and feedback are welcome:

- Open issues for bugs, feature requests, or UX improvements.
- Submit PRs with focused, well‑described changes.

Please keep security in mind — this panel controls Docker and production bot workloads.

---

## 💜 Support & donations

If this project saves you time or you use it in production, you can support ongoing development with a donation.

**Binance ID**

- `447496775`

**TRON (TRC20)**

- `TBXb83fU1sLfHFSLis9W5c3xhYw3YAbVsb`

**ABA**

- `003 665 448`

Every contribution helps keep **Telegram Bot Admin Panel** maintained and evolving. Thank you for your support!

---

## 🔗 Built by KSR

- Website: <https://www.ksrteam.org/>
- Telegram: <https://t.me/ksr_kdet>
- Channel: <https://t.me/ksr_team>

