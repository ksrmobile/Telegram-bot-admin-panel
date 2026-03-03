#!/usr/bin/env node

// KSR TG Bot Panel Host Runner Agent (MVP - health only)
// Listens on 127.0.0.1 and exposes a /health endpoint protected by a shared token.

const http = require("http");

const PORT = parseInt(process.env.KSR_AGENT_PORT || "5678", 10);
const TOKEN = process.env.KSR_AGENT_TOKEN;

if (!TOKEN) {
  console.error(
    "[host-runner-agent] KSR_AGENT_TOKEN is not set. Refusing to start."
  );
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
      return sendJson(res, 200, {
        ok: true,
        uptimeSeconds: process.uptime()
      });
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

