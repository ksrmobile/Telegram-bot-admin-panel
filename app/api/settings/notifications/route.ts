import { NextResponse } from "next/server";
import { z } from "zod";
import { getPanelSettings, updatePanelSettings } from "@/lib/panel-settings";
import { maskSecret } from "@/lib/secrets";
import { requireSession, verifyCsrfToken } from "@/lib/auth";

const bodySchema = z.object({
  notifyBotToken: z.string().max(200).optional(),
  notifyChatId: z.string().max(64).optional()
});

export async function GET() {
  const settings = await getPanelSettings();
  return NextResponse.json({
    hasNotifyBotToken: !!settings.notifyBotToken,
    notifyBotTokenMasked: settings.notifyBotToken
      ? maskSecret("NOTIFY_BOT_TOKEN", settings.notifyBotToken)
      : null,
    hasNotifyChatId: !!settings.notifyChatId,
    notifyChatIdMasked: settings.notifyChatId
      ? maskSecret("NOTIFY_CHAT_ID", settings.notifyChatId)
      : null
  });
}

export async function POST(req: Request) {
  if (!verifyCsrfToken(req.headers)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { notifyBotToken, notifyChatId } = parsed.data;

  const updated = await updatePanelSettings({
    notifyBotToken:
      notifyBotToken !== undefined
        ? notifyBotToken.trim() || null
        : undefined,
    notifyChatId:
      notifyChatId !== undefined ? notifyChatId.trim() || null : undefined
  });

  return NextResponse.json({
    ok: true,
    hasNotifyBotToken: !!updated.notifyBotToken,
    hasNotifyChatId: !!updated.notifyChatId
  });
}

