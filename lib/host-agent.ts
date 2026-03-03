import "server-only";

const AGENT_URL =
  process.env.HOST_RUNNER_AGENT_URL || "http://127.0.0.1:5678";
const AGENT_TOKEN = process.env.KSR_AGENT_TOKEN || "";

export async function checkHostAgentHealth() {
  if (!AGENT_TOKEN) {
    return {
      connected: false,
      error: "KSR_AGENT_TOKEN is not configured in the panel environment."
    };
  }

  try {
    const res = await fetch(`${AGENT_URL}/health`, {
      method: "GET",
      headers: {
        "x-agent-token": AGENT_TOKEN
      },
      cache: "no-store"
    });
    if (!res.ok) {
      return {
        connected: false,
        error: `Agent responded with status ${res.status}`
      };
    }
    const json = await res.json().catch(() => ({}));
    return {
      connected: !!json.ok,
      info: json
    };
  } catch (e: any) {
    return {
      connected: false,
      error: e?.message || "Unable to reach host runner agent"
    };
  }
}

