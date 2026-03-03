#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Please run this installer as root (sudo)." >&2
  exit 1
fi

TARGET_DIR="/opt/ksr-tg-bot-panel"
DATA_DIR="/var/lib/ksr-tg-panel/data"

echo "==> Ensuring Docker and Docker Compose are installed..."
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker engine..."
  apt-get update
  apt-get install -y ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "Docker already installed."
  if ! docker compose version >/dev/null 2>&1; then
    echo "Installing Docker Compose plugin..."
    apt-get update
    apt-get install -y docker-compose-plugin
  fi
fi

echo "==> Creating panel directories..."
mkdir -p "$TARGET_DIR"
mkdir -p "$DATA_DIR/projects"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Copying project files to $TARGET_DIR..."
cp -a "$PROJECT_ROOT"/. "$TARGET_DIR"/

cd "$TARGET_DIR"

ENV_FILE="$TARGET_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "==> Creating .env for panel..."
  read -rp "Panel HTTP port [8080]: " PANEL_PORT_INPUT || true
  PANEL_PORT="${PANEL_PORT_INPUT:-8080}"

  read -rp "Admin username [admin]: " ADMIN_USER_INPUT || true
  ADMIN_USER="${ADMIN_USER_INPUT:-admin}"

  echo "Set initial admin password (leave empty to auto-generate):"
  read -rs ADMIN_PASS_INPUT || true
  echo

  if [[ -z "${ADMIN_PASS_INPUT:-}" ]]; then
    ADMIN_PASS="$(openssl rand -base64 18)"
    echo "Generated admin password: $ADMIN_PASS"
  else
    ADMIN_PASS="$ADMIN_PASS_INPUT"
  fi

  SESSION_SECRET="$(openssl rand -hex 32)"

  cat >"$ENV_FILE" <<EOF
NODE_ENV=production
PANEL_PORT=$PANEL_PORT
ADMIN_USER=$ADMIN_USER
ADMIN_PASS=$ADMIN_PASS
SESSION_SECRET=$SESSION_SECRET
DATABASE_URL=file:/data/ksr-panel.db
PROJECTS_ROOT=/data/projects
DOCKER_SOCKET=/var/run/docker.sock
EOF
else
  echo "==> Existing .env found at $ENV_FILE (leaving unchanged)."
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  PANEL_PORT="${PANEL_PORT:-8080}"
  ADMIN_USER="${ADMIN_USER:-admin}"
  ADMIN_PASS="${ADMIN_PASS:-<existing in .env>}"
fi

echo "==> Building and starting KSR TG Bot Panel via Docker Compose..."
docker compose -f docker/docker-compose.yml up -d --build

SERVER_IP=$(hostname -I | awk '{print $1}')
SERVER_IP=${SERVER_IP:-"YOUR_SERVER_IP"}

echo
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
PANEL_BG='\033[48;5;236m'
PANEL_BORDER='\033[38;5;105m'
LABEL_COLOR='\033[38;5;110m'
VALUE_COLOR='\033[38;5;252m'
TITLE_COLOR='\033[38;5;183m'

echo -e "${PANEL_BORDER}============================================================${RESET}"
echo -e "${PANEL_BG}${TITLE_COLOR}${BOLD}  Telegram Bot Admin Panel installed successfully${RESET}"
echo -e "${PANEL_BORDER}------------------------------------------------------------${RESET}"
echo -e "${PANEL_BG}  ${LABEL_COLOR}URL  ${RESET}${PANEL_BG}${DIM}:${RESET}${PANEL_BG} ${VALUE_COLOR}http://$SERVER_IP:${PANEL_PORT:-8080}${RESET}"
echo -e "${PANEL_BG}  ${LABEL_COLOR}User ${RESET}${PANEL_BG}${DIM}:${RESET}${PANEL_BG} ${VALUE_COLOR}${ADMIN_USER:-admin}${RESET}"
echo -e "${PANEL_BG}  ${LABEL_COLOR}Pass ${RESET}${PANEL_BG}${DIM}:${RESET}${PANEL_BG} ${VALUE_COLOR}$ADMIN_PASS${RESET}"
echo -e "${PANEL_BORDER}============================================================${RESET}"
echo
echo "Security tips:"
echo "- Consider placing the panel behind an HTTPS reverse proxy (nginx, Caddy, Traefik)."
echo "- On Ubuntu UFW, you can run:"
echo "    sudo ufw allow 22/tcp    # SSH"
echo "    sudo ufw allow ${PANEL_PORT:-8080}/tcp"
echo "    sudo ufw enable"
echo
echo "Docker socket is mounted into the panel container for bot management."
echo "This is a powerful capability and assumes a single-tenant, trusted host."
echo
echo "==> Installing host runner agent (systemd helper)..."
AGENT_TOKEN="${KSR_AGENT_TOKEN:-$(openssl rand -hex 16)}"
cat >/usr/local/bin/ksr-host-runner-agent.js <<'AGENTEOF'
#!/usr/bin/env node
const http = require("http");
const PORT = parseInt(process.env.KSR_AGENT_PORT || "5678", 10);
const TOKEN = process.env.KSR_AGENT_TOKEN;
if (!TOKEN) {
  console.error("[host-runner-agent] KSR_AGENT_TOKEN is not set. Refusing to start.");
  process.exit(1);
}
function sendJson(res, statusCode, body) {
  const json = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Length", Buffer.byteLength(json, "utf8"));
  res.end(json);
}
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const path = url.pathname;
    const auth = req.headers["x-agent-token"];
    if (auth !== TOKEN) {
      return sendJson(res, 401, { ok: false, error: "unauthorized" });
    }
    if (req.method === "GET" && path === "/health") {
      return sendJson(res, 200, { ok: true, uptimeSeconds: process.uptime() });
    }
    return sendJson(res, 404, { ok: false, error: "not_found" });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: "internal_error" });
  }
});
server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[host-runner-agent] Listening on http://127.0.0.1:${PORT} (health only)`
  );
});
AGENTEOF
chmod +x /usr/local/bin/ksr-host-runner-agent.js

cat >/etc/systemd/system/ksr-host-runner-agent.service <<EOFAGENTUNIT
[Unit]
Description=KSR TG Bot Panel Host Runner Agent
After=network.target

[Service]
ExecStart=/usr/bin/env node /usr/local/bin/ksr-host-runner-agent.js
Environment=KSR_AGENT_PORT=5678
Environment=KSR_AGENT_TOKEN=$AGENT_TOKEN
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOFAGENTUNIT

systemctl daemon-reload
systemctl enable --now ksr-host-runner-agent.service

echo "Host runner agent installed."
echo "Shared secret (KSR_AGENT_TOKEN): $AGENT_TOKEN"
echo "Add this to the panel container environment so it can talk to the agent securely."
echo "==============================================="

