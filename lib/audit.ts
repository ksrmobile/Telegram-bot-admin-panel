import { prisma } from "./prisma";

export async function logAudit(action: string, projectId: number | null = null) {
  try {
    await prisma.auditLog.create({
      data: { action, projectId }
    });
  } catch (e) {
    console.error("Audit log error", e);
  }
}
