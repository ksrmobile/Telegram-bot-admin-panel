"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Server, HardDrive, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { useToast } from "../ui/toast";

type Health = {
  docker: { connected: boolean; version?: string | null; apiVersion?: string | null; error?: string | null };
  disk: { path: string; freeMb?: number | null; totalMb?: number | null; usedMb?: number };
  https?: string;
  inContainer?: boolean;
  socketPath?: string;
  socketPathExists?: boolean;
  dockerHost?: string | null;
};

export function SystemHealthWidget() {
  const { push } = useToast();
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(test?: boolean) {
    setLoading(true);
    try {
      const res = await fetch("/api/system/health" + (test ? "?t=1" : ""));
      const data = await res.json();
      setHealth(data);
      if (test) {
        if (data.docker?.connected) {
          push({
            title: "Docker connected",
            description: `Version ${data.docker.version || "unknown"} (API ${data.docker.apiVersion || "n/a"})`
          });
        } else {
          push({
            title: "Docker not reachable",
            description: data.docker?.error || "Unable to reach Docker daemon",
            variant: "destructive"
          });
        }
      }
    } catch {
      setHealth(null);
      if (test) {
        push({
          title: "Docker check failed",
          description: "Unable to call /api/system/health",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const dockerOk = health?.docker?.connected ?? false;
  const freeMb = health?.disk?.freeMb;
  const lowDisk = freeMb != null && freeMb < 500;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-sm font-medium">System health</CardTitle>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => load(true)} disabled={loading}>
          {loading ? "Testing…" : "Test Docker connection"}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Server className={`h-4 w-4 ${dockerOk ? "text-emerald-400" : "text-muted-foreground"}`} />
            <span className="text-sm font-medium">Docker</span>
          </div>
          {health?.docker ? (
            dockerOk ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge variant="destructive">Not connected</Badge>
            )
          ) : (
            <Badge variant="outline">—</Badge>
          )}
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <HardDrive className={`h-4 w-4 ${lowDisk ? "text-amber-400" : "text-primary"}`} />
            <span className="text-sm font-medium">Disk</span>
          </div>
          {health?.disk?.freeMb != null ? (
            <span className={`text-xs ${lowDisk ? "text-amber-400" : "text-muted-foreground"}`}>
              {health.disk.freeMb} MB free
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 px-4 py-3">
          <div className="flex items-center gap-2">
            {typeof window !== "undefined" && window.location.protocol !== "https:" ? (
              <ShieldAlert className="h-4 w-4 text-amber-400" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            )}
            <span className="text-sm font-medium">HTTPS</span>
          </div>
          {typeof window !== "undefined" ? (
            window.location.protocol === "https:" ? (
              <Badge variant="success">On</Badge>
            ) : (
              <Badge variant="warning">Off</Badge>
            )
          ) : (
            <Badge variant="outline">—</Badge>
          )}
        </div>
      </CardContent>
      {health?.docker && !health.docker.connected && (
        <CardContent className="border-t border-border/60 pt-4 text-xs text-muted-foreground">
          Docker: {health.docker.error}. Ensure DOCKER_HOST or socket is configured and mounted.
        </CardContent>
      )}
      {lowDisk && (
        <CardContent className="border-t border-border/60 pt-4 text-xs text-amber-200">
          Low disk space. Free at least 500 MB for builds and backups.
        </CardContent>
      )}
      {health && !dockerOk && (
        <CardContent className="border-t border-border/60 pt-4 space-y-3 text-xs text-muted-foreground">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground">
              Docker connection setup
            </div>
            <p>
              The panel cannot reach Docker. Choose one of the supported modes:
            </p>
            <ol className="mt-1 list-decimal list-inside space-y-1">
              <li>
                <strong>Mode 1 (recommended single-tenant)</strong>: mount{" "}
                <code className="rounded bg-secondary px-1">/var/run/docker.sock</code>{" "}
                into the panel container.
              </li>
              <li>
                <strong>Mode 2 (remote Docker API)</strong>: set{" "}
                <code className="rounded bg-secondary px-1">DOCKER_HOST</code>{" "}
                to a reachable Docker TCP endpoint (e.g.{" "}
                <code className="rounded bg-secondary px-1">tcp://docker:2375</code>).
              </li>
            </ol>
          </div>
          {health.inContainer && !health.socketPathExists && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <div className="flex items-center gap-2 text-amber-100">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span className="font-semibold text-[11px] uppercase tracking-wide">
                  Quick fix for local Docker
                </span>
              </div>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>
                  Edit your <code className="rounded bg-secondary px-1">docker-compose.yml</code> for
                  the panel service.
                </li>
                <li>
                  Add a volume:{" "}
                  <code className="rounded bg-secondary px-1">/var/run/docker.sock:/var/run/docker.sock</code>
                </li>
                <li>Recreate the panel container and click “Test Docker connection”.</li>
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

