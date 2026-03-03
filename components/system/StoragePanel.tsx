"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";

type SystemStorage = {
  projectsBytes: number;
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

export function StoragePanel() {
  const { push } = useToast();
  const [data, setData] = useState<SystemStorage | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/system/storage");
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function pruneImages() {
    setLoading(true);
    try {
      const res = await fetch("/api/system/storage?action=prune-images", {
        method: "POST",
        headers: {
          "x-csrf-token": getCsrfToken()
        }
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Unable to prune images");
      }
      push({
        title: "Docker images pruned",
        description: `Reclaimed ${formatBytes(
          body.result?.reclaimedBytes || 0
        )} of space.`
      });
      await load();
    } catch (err: any) {
      push({
        title: "Prune failed",
        description: err?.message || "Unable to prune images",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Storage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <span>Projects root</span>
          <span>{data ? formatBytes(data.projectsBytes) : "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>Build contexts</span>
          <span>{data ? formatBytes(data.buildBytes) : "—"}</span>
        </div>
        <p className="pt-1">
          Use these tools to keep disk usage under control on your VPS. Pruning
          dangling Docker images is safe and will not remove running containers.
        </p>
        <div className="pt-1">
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => {
              if (
                window.confirm(
                  "Prune dangling Docker images? This removes unused image layers."
                )
              ) {
                pruneImages();
              }
            }}
          >
            Remove dangling images
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

