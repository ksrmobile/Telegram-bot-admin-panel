import { prisma } from "../../lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Plus, UploadCloud, Activity, HardDrive, Cpu, AlertCircle, Server } from "lucide-react";
import Link from "next/link";
import { SystemHealthWidget } from "../../components/system/SystemHealthWidget";

// Force this page to be rendered dynamically at request time so that
// Prisma never runs during `next build` (when the SQLite file is not available).
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getStats() {
  const [total, running, stopped, errors] = await Promise.all([
    prisma.project.count(),
    prisma.project.count({ where: { status: "RUNNING" } }),
    prisma.project.count({ where: { status: "STOPPED" } }),
    prisma.project.count({ where: { status: "ERROR" } })
  ]);
  return { total, running, stopped, errors };
}

async function getRecentActivity() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { project: { select: { name: true, slug: true } } }
  });
}

export default async function DashboardPage() {
  const [stats, activity] = await Promise.all([getStats(), getRecentActivity()]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            High-level status of your Telegram bot fleet.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/projects/new">
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Create project
            </Button>
          </Link>
          <Link href="/projects/new">
            <Button size="sm" variant="outline" className="gap-2">
              <UploadCloud className="h-4 w-4" />
              Upload bot ZIP
            </Button>
          </Link>
          <Link href="/system">
            <Button size="sm" variant="ghost" className="gap-2">
              <Server className="h-4 w-4" />
              System
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total projects</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Cpu className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold">{stats.running}</span>
              <Badge variant="success">Healthy</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stopped</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.stopped}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.errors}</div>
          </CardContent>
        </Card>
      </div>

      <SystemHealthWidget />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {activity.map((log) => (
                  <li key={log.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{log.action}</span>
                    {log.project ? (
                      <Link href={`/projects/${log.project.slug}`} className="text-primary hover:underline">
                        {log.project.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    <span className="text-muted-foreground shrink-0">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/projects/new">
              <Button size="sm" variant="outline">Create project</Button>
            </Link>
            <Link href="/projects">
              <Button size="sm" variant="outline">All projects</Button>
            </Link>
            <Link href="/system">
              <Button size="sm" variant="outline">System health</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

