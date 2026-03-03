"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  ChevronRight,
  Play,
  Square,
  RotateCcw,
  FileText,
  Download,
  FolderOpen,
  FileCode,
  Settings,
  Activity,
  HardDrive,
  ScrollText,
  Trash2
} from "lucide-react";
import { useToast } from "../ui/toast";
import { FileManager } from "./file-manager";
import { ConfigEditor } from "./config-editor";
import { RunnerPanel } from "./runner-panel";
import { LogsPanel } from "./logs-panel";
import { BackupsPanel } from "./backups-panel";
import { SettingsPanel } from "./settings-panel";
import { OverviewTab } from "./overview-tab";
import { ActivityTab } from "./activity-tab";

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

const TAB_IDS = ["overview", "files", "config", "runner", "logs", "backups", "activity", "settings"] as const;

function getCsrfToken() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )ksr_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function ProjectDetailClient({ project }: { project: Project }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { push } = useToast();
  const tabParam = searchParams.get("tab");
  const uploadZip = searchParams.get("upload") === "zip";
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (tabParam && TAB_IDS.includes(tabParam as any)) return tabParam;
    if (uploadZip) return "files";
    return "overview";
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (uploadZip && activeTab !== "files") {
      // On first load with ?upload=zip, direct the user to Files.
      setActiveTab("files");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadZip]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(project.slug)}`,
        {
          method: "DELETE",
          headers: {
            "x-csrf-token": getCsrfToken()
          }
        }
      );
      if (!res.ok) throw new Error("Unable to delete project");
      push({
        title: "Project deleted",
        description: "Workspace and Docker resources removed."
      });
      setDeleteOpen(false);
      router.push("/projects");
    } catch (err: any) {
      push({
        title: "Delete failed",
        description: err.message || "Unable to delete project",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">Projects</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{project.name}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <Badge
            variant={
              project.status === "RUNNING"
                ? "success"
                : project.status === "ERROR"
                ? "destructive"
                : "outline"
            }
          >
            {project.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {project.runtimeType} • {project.slug}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveTab("runner")}
          >
            <Play className="h-3.5 w-3.5" />
            Start
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveTab("runner")}
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveTab("runner")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restart
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveTab("logs")}
          >
            <ScrollText className="h-3.5 w-3.5" />
            Logs
          </Button>
          <a href={`/api/projects/${project.slug}/backup`} download>
            <Button size="sm" variant="outline">
              <Download className="h-3.5 w-3.5" />
              Backup
            </Button>
          </a>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {uploadZip && (
        <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary">
          Upload your bot ZIP in the Files tab below.
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap gap-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
              <TabsTrigger value="runner">Runner</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="backups">Backups</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab slug={project.slug} project={project} onOpenTab={setActiveTab} />
            </TabsContent>
            <TabsContent value="files">
              <FileManager slug={project.slug} />
            </TabsContent>
            <TabsContent value="config">
              <ConfigEditor slug={project.slug} />
            </TabsContent>
            <TabsContent value="runner">
              <RunnerPanel slug={project.slug} projectId={project.id} />
            </TabsContent>
            <TabsContent value="logs">
              <LogsPanel slug={project.slug} />
            </TabsContent>
            <TabsContent value="backups">
              <BackupsPanel slug={project.slug} />
            </TabsContent>
            <TabsContent value="activity">
              <ActivityTab slug={project.slug} />
            </TabsContent>
            <TabsContent value="settings">
              <SettingsPanel slug={project.slug} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-labelledby="delete-project-title">
          <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl">
            <h2 id="delete-project-title" className="text-sm font-semibold">
              Delete project?
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              This will remove the workspace for{" "}
              <code className="rounded bg-secondary px-1 py-0.5 text-[11px]">{project.slug}</code>, stop and remove any Docker container, and delete the project from the panel. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
