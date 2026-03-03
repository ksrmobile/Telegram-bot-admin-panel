"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Server, Loader2 } from "lucide-react";
import { useToast } from "../ui/toast";

type AgentStatus =
  | { connected: false; error?: string }
  | { connected: true; info?: any };

export function HostAgentStatus() {
  const { push } = useToast();
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(showToast = false) {
    setLoading(true);
    try {
      const res = await fetch("/api/host-runner/health", {
        cache: "no-store"
      });
      const json = await res.json();
      setStatus(json);
      if (showToast) {
        if (json.connected) {
          push({
            title: "Host runner agent connected",
            description: "Local agent is reachable on 127.0.0.1."
          });
        } else {
          push({
            title: "Host runner agent unreachable",
            description: json.error || "Unable to reach local agent.",
            variant: "destructive"
          });
        }
      }
    } catch (e: any) {
      setStatus({ connected: false, error: e?.message || "Fetch failed" });
      if (showToast) {
        push({
          title: "Host runner agent unreachable",
          description: e?.message || "Unable to reach local agent.",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(false);
  }, []);

  const connected = status?.connected ?? false;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          Host runner agent
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => load(true)}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Test"}
        </Button>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Local systemd helper running as root on the VPS.
        </span>
        <Badge variant={connected ? "success" : "destructive"}>
          {connected ? "Connected" : "Not connected"}
        </Badge>
      </CardContent>
    </Card>
  );
}

