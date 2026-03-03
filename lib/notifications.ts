import { getPanelSettings } from "./panel-settings";
import { getContainerStatus, getRecentLogs } from "./docker";

type ProjectLike = {
  id: number;
  name: string;
  slug: string;
};

const watching = new Set<string>();

async function sendCrashNotification(
  project: ProjectLike,
  containerName: string,
  exitCode: number
) {
  const settings = await getPanelSettings();
  const token = settings.notifyBotToken;
  const chatId = settings.notifyChatId;

  if (!token || !chatId) return;

  const lines = await getRecentLogs(containerName, 50);
  const lastLines = lines.slice(-50);

  const text =
    `Bot container crashed\n` +
    `Project: ${project.name} (${project.slug})\n` +
    `Exit code: ${exitCode}\n` +
    `Time: ${new Date().toISOString()}\n\n` +
    (lastLines.length ? `Last log lines:\n${lastLines.join("\n")}` : "");

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });
  } catch {
    // Swallow errors; do not log secrets.
  }
}

export function watchContainerForCrashes(
  project: ProjectLike,
  containerName: string
) {
  const key = `${project.id}:${containerName}`;
  if (watching.has(key)) return;
  watching.add(key);

  (async () => {
    try {
      // Poll until container stops; send notification on non-zero exit.
      // 15s cadence is sufficient for crash alerts.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const status = await getContainerStatus(containerName);
        if (!status) break;
        if (!status.running) {
          if (status.exitCode != null && status.exitCode !== 0) {
            await sendCrashNotification(project, containerName, status.exitCode);
          }
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 15_000));
      }
    } catch {
      // ignore
    } finally {
      watching.delete(key);
    }
  })();
}

