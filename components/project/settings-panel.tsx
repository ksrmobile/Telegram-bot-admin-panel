"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useToast } from "../ui/toast";

type GitInfo = {
  isRepo: boolean;
  branch?: string | null;
  remoteUrl?: string | null;
  lastCommitHash?: string | null;
  lastCommitMessage?: string | null;
  lastCommitAt?: string | null;
};

type StorageInfo = {
  workspaceBytes: number;
  buildBytes: number;
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${units[i]}`;
}

function getCsrfToken() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )ksr_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function SettingsPanel({ slug }: { slug: string }) {
  const { push } = useToast();
  const [git, setGit] = useState<GitInfo | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [loadingGit, setLoadingGit] = useState(false);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneBranch, setCloneBranch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(slug)}/git`
        );
        if (!res.ok) return;
        const json = await res.json();
        setGit(json);
      } catch {
        // ignore
      }
    })();
    (async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(slug)}/storage`
        );
        if (!res.ok) return;
        const json = await res.json();
        setStorage(json);
      } catch {
        // ignore
      }
    })();
  }, [slug]);

  async function gitAction(
    action: "pull" | "pull_rebuild" | "pull_rebuild_restart"
  ) {
    setLoadingGit(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(
          slug
        )}/git?action=${action}`,
        {
          method: "POST",
          headers: {
            "x-csrf-token": getCsrfToken()
          }
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Git action failed");
      }
      push({
        title: "Git updated",
        description:
          action === "pull"
            ? "Pulled latest changes."
            : action === "pull_rebuild"
            ? "Pulled latest changes and queued rebuild."
            : "Pulled latest changes, queued rebuild, and will restart on success."
      });
    } catch (err: any) {
      push({
        title: "Git error",
        description: err?.message || "Unable to run git operation",
        variant: "destructive"
      });
    } finally {
      setLoadingGit(false);
    }
  }

  async function storageAction(action: "cleanup-build-contexts" | "cleanup-backups") {
    setLoadingStorage(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(
          slug
        )}/storage?action=${action}`,
        {
          method: "POST",
          headers: {
            "x-csrf-token": getCsrfToken()
          }
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Storage action failed");
      }
      push({
        title: "Cleanup completed",
        description:
          action === "cleanup-build-contexts"
            ? "Build contexts removed for this project."
            : "Temporary backup files cleaned up."
      });
      const refreshed = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/storage`
      );
      if (refreshed.ok) {
        const json = await refreshed.json();
        setStorage(json);
      }
    } catch (err: any) {
      push({
        title: "Cleanup failed",
        description: err?.message || "Unable to run cleanup",
        variant: "destructive"
      });
    } finally {
      setLoadingStorage(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Git repository
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          {git?.isRepo ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span>Remote</span>
                <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">
                  {git.remoteUrl || "origin"}
                </code>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Branch</span>
                <Badge variant="outline">
                  {git.branch || "unknown"}
                </Badge>
              </div>
              <div className="flex flex-col gap-1">
                <span>Last commit</span>
                <div className="rounded bg-secondary/40 px-2 py-1 text-[11px]">
                  <div className="truncate">
                    {git.lastCommitHash || "—"}
                  </div>
                  {git.lastCommitMessage && (
                    <div className="text-muted-foreground">
                      {git.lastCommitMessage}
                    </div>
                  )}
                  {git.lastCommitAt && (
                    <div className="text-[10px] text-muted-foreground">
                      {git.lastCommitAt}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingGit}
                  onClick={() => gitAction("pull")}
                >
                  Pull updates
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingGit}
                  onClick={() => gitAction("pull_rebuild")}
                >
                  Pull + rebuild
                </Button>
                <Button
                  size="sm"
                  disabled={loadingGit}
                  onClick={() => gitAction("pull_rebuild_restart")}
                >
                  Pull + rebuild + restart
                </Button>
              </div>
            </>
          ) : (
            <p>
              This workspace is not a git repository yet. You can clone a bot
              repo directly into it using the form below.
            </p>
          )}

          <div className="mt-3 space-y-2">
            <p className="text-[11px]">
              Clone a remote repository into this workspace. The workspace must
              be empty and not already contain a git repo.
            </p>
            <div className="space-y-1">
              <label className="text-[11px] font-medium">
                Repository URL
              </label>
              <input
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                placeholder="https://github.com/user/bot.git or git@github.com:user/bot.git"
                value={cloneUrl}
                onChange={(e) => setCloneUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium">
                Branch (optional)
              </label>
              <input
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                placeholder="main"
                value={cloneBranch}
                onChange={(e) => setCloneBranch(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              disabled={loadingGit || !cloneUrl.trim()}
              onClick={async () => {
                setLoadingGit(true);
                try {
                  const res = await fetch(
                    `/api/projects/${encodeURIComponent(
                      slug
                    )}/git-clone`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "x-csrf-token": getCsrfToken()
                      },
                      body: JSON.stringify({
                        repoUrl: cloneUrl,
                        branch: cloneBranch || undefined
                      })
                    }
                  );
                  const body = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    throw new Error(body.error || "Unable to clone repo");
                  }
                  push({
                    title: "Repository cloned",
                    description: "Workspace now contains the remote bot repo."
                  });
                  const infoRes = await fetch(
                    `/api/projects/${encodeURIComponent(slug)}/git`
                  );
                  if (infoRes.ok) {
                    const json = await infoRes.json();
                    setGit(json);
                  }
                } catch (err: any) {
                  push({
                    title: "Clone failed",
                    description:
                      err?.message || "Unable to clone repository",
                    variant: "destructive"
                  });
                } finally {
                  setLoadingGit(false);
                }
              }}
            >
              Clone repository
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span>Workspace</span>
            <span>{storage ? formatBytes(storage.workspaceBytes) : "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Build contexts</span>
            <span>{storage ? formatBytes(storage.buildBytes) : "—"}</span>
          </div>
          <p className="pt-1">
            Use these tools to reclaim disk space. Build contexts and temporary
            backup zips can be safely removed; they will be recreated on demand.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              disabled={loadingStorage}
              onClick={() => {
                if (
                  window.confirm(
                    "Delete build contexts for this project? The next build will recreate them."
                  )
                ) {
                  storageAction("cleanup-build-contexts");
                }
              }}
            >
              Delete build contexts
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loadingStorage}
              onClick={() => {
                if (
                  window.confirm(
                    "Delete temporary backup files for this project (keeping last 3)?"
                  )
                ) {
                  storageAction("cleanup-backups");
                }
              }}
            >
              Delete temp backups
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

