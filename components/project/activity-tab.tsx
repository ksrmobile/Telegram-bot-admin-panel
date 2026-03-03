"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Loader2 } from "lucide-react";

type Entry = {
  id: number;
  action: string;
  createdAt: string;
  projectId: number | null;
};

export function ActivityTab({ slug }: { slug: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${slug}/activity`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Activity</CardTitle>
        <p className="text-xs text-muted-foreground">
          Audit timeline for this project: who did what and when.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
              >
                <span className="font-medium text-primary">{e.action}</span>
                <span className="text-muted-foreground text-xs shrink-0">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
