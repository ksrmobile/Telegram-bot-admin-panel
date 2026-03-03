import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { ShieldAlert } from "lucide-react";
import { ChangePasswordForm } from "../../../components/settings/ChangePasswordForm";
import { NotificationSettings } from "../../../components/settings/NotificationSettings";

export default function SettingsPage() {
  const dataDir = process.env.PROJECTS_ROOT || "/data/projects";
  const panelPort = process.env.PANEL_PORT || "3000";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Panel configuration, security, and maintenance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Panel</CardTitle>
          <CardDescription>Base URL and paths (read-only)</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Data directory</span>
            <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{dataDir}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Port</span>
            <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{panelPort}</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Security</CardTitle>
          <CardDescription>Change admin password</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Notifications</CardTitle>
          <CardDescription>
            Optional Telegram crash notifications for all projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationSettings />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Session</CardTitle>
          <CardDescription>
            Rotating SESSION_SECRET in .env logs everyone out. Session duration is 7 days.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-amber-400 bg-amber-50/80 dark:border-amber-500/40 dark:bg-transparent">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4" />
            Danger zone
          </CardTitle>
          <CardDescription>
            Deleting all projects removes workspaces and cannot be undone. Use with caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            To delete all projects, use the database or remove project folders from the data directory manually.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
