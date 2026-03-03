import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Server, HardDrive, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { SystemHealthWidget } from "../../../components/system/SystemHealthWidget";
import { HostAgentStatus } from "../../../components/system/HostAgentStatus";
import { StoragePanel } from "../../../components/system/StoragePanel";

export default async function SystemPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System</h1>
        <p className="text-sm text-muted-foreground">
          Host health, Docker connectivity, and security status.
        </p>
      </div>

      <SystemHealthWidget />

      <HostAgentStatus />

      <StoragePanel />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              Docker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              The panel uses the Docker API to build and run bot containers. Ensure{" "}
              <code className="rounded bg-secondary px-1 py-0.5 text-xs">DOCKER_HOST</code> is set
              (e.g. <code className="rounded bg-secondary px-1 py-0.5 text-xs">unix:///var/run/docker.sock</code>)
              and the socket is mounted if running in a container.
            </p>
            <p className="text-xs">
              If docker.sock is mounted, the panel has full Docker access on the host (single-tenant use).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              Data directory
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Project workspaces and backups are stored under the panel data directory.
              Low disk space can cause build and backup failures.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-400 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4" />
            Security & TLS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            For production, run the panel behind HTTPS (reverse proxy or Cloudflare Tunnel).
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><strong>Reverse proxy:</strong> Caddy or Nginx with TLS; proxy to the panel port.</li>
            <li><strong>Cloudflare Tunnel:</strong> Run cloudflared and expose the panel without opening ports.</li>
          </ul>
          <p className="text-xs">
            Copy-paste your reverse proxy or tunnel config from your provider&apos;s docs; the panel does not generate TLS certificates.
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Link href="/">
          <Button size="sm" variant="outline">Dashboard</Button>
        </Link>
        <Link href="/projects/new">
          <Button size="sm">Create project</Button>
        </Link>
      </div>
    </div>
  );
}
