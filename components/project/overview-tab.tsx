"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Check, Loader2 } from "lucide-react";

type Project = {
  id: number;
  name: string;
  slug: string;
  runtimeType: string;
  startCommand: string;
  workspacePath: string;
  dockerImageName?: string | null;
  dockerContainerName?: string | null;
  status: string;
  runnerMode?: string | null;
  templateRuntime?: string | null;
  templateAptPackages?: string | null;
  templateExposePort?: number | null;
};

type AuditEntry = { id: number; action: string; createdAt: string };

export function OverviewTab({
  slug,
  project: initialProject,
  onOpenTab
}: {
  slug: string;
  project: Project;
  onOpenTab?: (tab: string) => void;
}) {
  const [project, setProject] = useState<Project>(initialProject);
  const [events, setEvents] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${slug}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/projects/${slug}/activity`).then((r) => r.ok ? r.json() : [])
    ]).then(([p, logs]) => {
      if (p) setProject(p);
      setEvents(Array.isArray(logs) ? logs : []);
    }).finally(() => setLoading(false));
  }, [slug]);

  const containerName = project.dockerContainerName || `ksr-bot-${project.slug}`;
  const imageName = project.dockerImageName || "—";
  const isNew = events.length === 0 || events.every((e) => e.action === "project_created");
  const hasEnv = true;
  const hasUpload =
    !isNew ||
    events.some(
      (e) =>
        e.action?.includes("upload") ||
        e.action?.includes("zip") ||
        e.action?.includes("import")
    );
  const hasImage = !!project.dockerImageName;
  const hasStarted = project.status === "RUNNING";
  const usingTemplate =
    (project.runnerMode || "").toUpperCase() === "TEMPLATE";

  const nextSteps = [
    {
      id: "upload",
      label: "Import or upload your bot code",
      done: hasUpload,
      href: "files"
    },
    {
      id: "env",
      label: "Configure environment (.env, BOT_TOKEN)",
      done: hasEnv,
      href: "config"
    },
    {
      id: "build",
      label: usingTemplate
        ? "Build Docker image (Template Mode)"
        : "Build Docker image (Dockerfile mode)",
      done: hasImage,
      href: "runner"
    },
    {
      id: "start",
      label: "Start the bot container",
      done: hasStarted,
      href: "runner"
    },
    {
      id: "logs",
      label: "Verify logs and check for errors",
      done: false,
      href: "logs"
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Runtime</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <span>{project.runtimeType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Workspace path</span>
            <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{project.workspacePath}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Container name</span>
            <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{containerName}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Image</span>
            <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{imageName}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant={
                project.status === "RUNNING" ? "success" : project.status === "ERROR" ? "destructive" : "outline"
              }
            >
              {project.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {isNew && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Next steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="space-y-2">
              {nextSteps.map((step) => (
                <li key={step.id} className="flex items-center gap-2">
                  {step.done ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/50" />
                  )}
                  <span className={step.done ? "text-muted-foreground" : ""}>{step.label}</span>
                  {!step.done && onOpenTab && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => onOpenTab(step.href)}
                    >
                      Go →
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Last 20 events</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {events.slice(0, 20).map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span>{e.action}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
