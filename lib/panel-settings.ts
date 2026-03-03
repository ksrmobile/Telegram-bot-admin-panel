import { prisma } from "./prisma";

export type PanelSettings = {
  notifyBotToken: string | null;
  notifyChatId: string | null;
};

async function ensureRow() {
  let row = await prisma.panelSettings.findUnique({
    where: { id: 1 }
  });
  if (!row) {
    row = await prisma.panelSettings.create({
      data: { id: 1 }
    });
  }
  return row;
}

export async function getPanelSettings(): Promise<PanelSettings> {
  const row = await ensureRow();
  return {
    notifyBotToken: row.notifyBotToken ?? null,
    notifyChatId: row.notifyChatId ?? null
  };
}

export async function updatePanelSettings(input: {
  notifyBotToken?: string | null;
  notifyChatId?: string | null;
}): Promise<PanelSettings> {
  await ensureRow();
  const row = await prisma.panelSettings.update({
    where: { id: 1 },
    data: {
      ...(input.notifyBotToken !== undefined && {
        notifyBotToken: input.notifyBotToken
      }),
      ...(input.notifyChatId !== undefined && {
        notifyChatId: input.notifyChatId
      })
    }
  });
  return {
    notifyBotToken: row.notifyBotToken ?? null,
    notifyChatId: row.notifyChatId ?? null
  };
}

