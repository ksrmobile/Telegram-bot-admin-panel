"use client";

import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";
import { Download, UploadCloud } from "lucide-react";

function getCsrfToken() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )ksr_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function BackupsPanel({ slug }: { slug: string }) {
  const { push } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function exportBackup() {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/backup`
      );
      if (!res.ok) throw new Error("Unable to create backup");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-backup.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      push({
        title: "Backup failed",
        description: err.message || "Unable to create backup",
        variant: "destructive"
      });
    }
  }

  async function importBackup(file: File) {
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/backup`,
        {
          method: "POST",
          headers: {
            "x-csrf-token": getCsrfToken()
          },
          body: form
        }
      );
      if (!res.ok) throw new Error("Unable to restore backup");
      push({
        title: "Backup restored",
        description: "Project files have been replaced from the archive."
      });
    } catch (err: any) {
      push({
        title: "Restore failed",
        description: err.message || "Unable to restore backup",
        variant: "destructive"
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Manual backups
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <p>
            Export the entire project workspace as a ZIP archive or restore from
            a previous backup. Restores use the same safe extraction rules as
            uploads (no symlinks, no path traversal, size limits).
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={exportBackup}
            >
              <Download className="h-3.5 w-3.5" />
              Export ZIP
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Restore from ZIP
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".zip"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importBackup(file);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

