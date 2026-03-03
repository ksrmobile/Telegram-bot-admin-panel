import Link from "next/link";
import fs from "fs";
import path from "path";
import { prisma } from "../../../lib/prisma";
import { Button } from "../../../components/ui/button";
import { Plus } from "lucide-react";
import { ProjectsListClient } from "../../../components/project/projects-list-client";

// Avoid static generation for this page so Prisma runs only at runtime
// inside the container where the SQLite database file is available.
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getProjectsWithMeta() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 20
      },
      buildJobs: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  const results = [];
  for (const project of projects) {
    let port: number | null = null;
    try {
      const envPath =
        project.envFilePath ||
        path.join(project.workspacePath, ".env");
      const raw = await fs.promises.readFile(envPath, "utf8");
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (key.toUpperCase() === "PORT") {
          const n = Number(value);
          if (!Number.isNaN(n)) port = n;
        }
      }
    } catch {
      // ignore missing env
    }

    const lastEvent = project.auditLogs[0] ?? null;
    const lastStart =
      project.auditLogs.find((e) =>
        ["runner_started", "runner_restarted"].includes(e.action)
      ) || null;
    const lastError =
      project.auditLogs.find((e) => e.action === "runner_error") || null;

    const lastBuild = project.buildJobs[0] ?? null;

    results.push({
      id: project.id,
      name: project.name,
      slug: project.slug,
      runtimeType: project.runtimeType,
      startCommand: project.startCommand,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      workspacePath: project.workspacePath,
      dockerContainerName: project.dockerContainerName,
      lastEventAt: lastEvent?.createdAt.toISOString() ?? null,
      lastStartAt: lastStart?.createdAt.toISOString() ?? null,
      lastErrorAt: lastError?.createdAt.toISOString() ?? null,
      port,
      lastBuildStatus: lastBuild?.status ?? null
    });
  }

  return results;
}

export default async function ProjectsPage() {
  const projects = await getProjectsWithMeta();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Projects
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage Telegram bot workspaces, runtimes, and lifecycle.
          </p>
        </div>
        <Link href="/projects/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New project
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
            Create your first bot workspace. Start from an empty project, upload a ZIP, or clone an existing bot repo.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Link href="/projects/new">
              <Button className="w-full justify-center gap-2">
                <Plus className="h-4 w-4" />
                New project
              </Button>
            </Link>
            <Link href="/projects/new">
              <Button variant="outline" className="w-full justify-center gap-2">
                <Plus className="h-4 w-4" />
                Upload bot ZIP
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <ProjectsListClient projects={projects} />
      )}
    </div>
  );
}


