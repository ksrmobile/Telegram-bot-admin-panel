"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Play,
  Square,
  RotateCcw,
  ScrollText,
  ExternalLink,
  Filter,
  Clock,
  Cpu,
  Activity as ActivityIcon
} from "lucide-react";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import { useToast } from "../ui/toast";

type ProjectListItem = {
  id: number;
  name: string;
  slug: string;
  runtimeType: string;
  startCommand: string;
  status: string;
  createdAt: string;
  workspacePath: string;
  dockerContainerName?: string | null;
  lastStartAt?: string | null;
  lastErrorAt?: string | null;
  lastEventAt?: string | null;
  port?: number | null;
  lastBuildStatus?: string | null;
};

function formatDateTimeUtc(input: string | null | undefined) {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss} UTC`;
}

function formatTimeUtc(input: string | null | undefined) {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} UTC`;
}

function getCsrfToken() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )ksr_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

const STATUS_FILTERS = ["ALL", "RUNNING", "STOPPED", "ERROR"] as const;
const RUNTIME_FILTERS = ["ALL", "NODE", "PYTHON", "DOCKERFILE"] as const;

export function ProjectsListClient({ projects }: { projects: ProjectListItem[] }) {
  const { push } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [runtimeFilter, setRuntimeFilter] =
    useState<(typeof RUNTIME_FILTERS)[number]>("ALL");
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (
        statusFilter !== "ALL" &&
        p.status.toUpperCase() !== statusFilter
      ) {
        return false;
      }
      if (
        runtimeFilter !== "ALL" &&
        p.runtimeType.toUpperCase() !== runtimeFilter
      ) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.runtimeType.toLowerCase().includes(q)
      );
    });
  }, [projects, search, statusFilter, runtimeFilter]);

  async function runnerAction(
    slug: string,
    action: "start" | "stop" | "restart"
  ) {
    setLoadingSlug(slug);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(
          slug
        )}/runner?action=${action}`,
        {
          method: "POST",
          headers: {
            "x-csrf-token": getCsrfToken()
          }
        }
      );
      if (!res.ok) throw new Error("Unable to perform action");
      push({
        title: `Container ${action}ed`,
        description: `Runner action '${action}' queued.`
      });
    } catch (err: any) {
      push({
        title: "Runner error",
        description: err.message || "Unable to control container",
        variant: "destructive"
      });
    } finally {
      setLoadingSlug(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <Input
            placeholder="Search projects…"
            className="h-8 border-none bg-transparent text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" />
            <span>Status</span>
            <div className="flex overflow-hidden rounded-md border border-border/60 bg-card text-[11px]">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={cn(
                    "px-2 py-1 hover:bg-secondary/60",
                    statusFilter === s && "bg-primary/20 text-foreground"
                  )}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "ALL" ? "All" : s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Cpu className="h-3.5 w-3.5" />
            <span>Runtime</span>
            <div className="flex overflow-hidden rounded-md border border-border/60 bg-card text-[11px]">
              {RUNTIME_FILTERS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={cn(
                    "px-2 py-1 hover:bg-secondary/60",
                    runtimeFilter === r && "bg-primary/20 text-foreground"
                  )}
                  onClick={() => setRuntimeFilter(r)}
                >
                  {r === "ALL" ? "All" : r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <p>No projects match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((project) => {
            const running = project.status === "RUNNING";
            const error = project.status === "ERROR";

            return (
              <Card key={project.id} className="border-border/70">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      {project.name}
                      <Badge
                        variant={
                          running
                            ? "success"
                            : error
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {project.status}
                      </Badge>
                      {project.lastBuildStatus && (
                        <Badge
                          variant={
                            project.lastBuildStatus === "SUCCESS"
                              ? "success"
                              : project.lastBuildStatus === "RUNNING" ||
                                project.lastBuildStatus === "QUEUED"
                              ? "outline"
                              : "destructive"
                          }
                        >
                          {project.lastBuildStatus === "RUNNING" ||
                          project.lastBuildStatus === "QUEUED"
                            ? "BUILDING"
                            : project.lastBuildStatus}
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                      <span>{project.runtimeType}</span>
                      <span>•</span>
                      <code className="rounded bg-secondary/70 px-1.5 py-0.5 text-[11px]">
                        {project.slug}
                      </code>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {project.lastStartAt
                          ? `Restarted ${formatDateTimeUtc(
                              project.lastStartAt
                            )}`
                          : `Created ${formatDateTimeUtc(project.createdAt)}`}
                      </span>
                    </div>
                    {project.port != null && (
                      <div className="flex items-center gap-1">
                        <ActivityIcon className="h-3.5 w-3.5" />
                        <span>Port {project.port}</span>
                      </div>
                    )}
                    {error && project.lastErrorAt && (
                      <span className="text-[11px] text-rose-300">
                        Last error {formatTimeUtc(project.lastErrorAt)}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      Start command:{" "}
                      <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">
                        {project.startCommand}
                      </code>
                    </span>
                    <span>
                      Workspace:{" "}
                      <code className="rounded bg-secondary/70 px-1.5 py-0.5 text-[11px]">
                        {project.workspacePath}
                      </code>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-1">
                      <Link href={`/projects/${project.slug}`}>
                        <Button size="sm" variant="outline" className="gap-1.5">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </Button>
                      </Link>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Start"
                        onClick={() => runnerAction(project.slug, "start")}
                        disabled={loadingSlug === project.slug || running}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Stop"
                        onClick={() => runnerAction(project.slug, "stop")}
                        disabled={loadingSlug === project.slug || !running}
                      >
                        <Square className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Restart"
                        onClick={() => runnerAction(project.slug, "restart")}
                        disabled={loadingSlug === project.slug}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Link href={`/projects/${project.slug}?tab=logs`}>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Logs"
                        >
                          <ScrollText className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

