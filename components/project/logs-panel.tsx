"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useToast } from "../ui/toast";
import { Pause, Play, Download, Search, Copy } from "lucide-react";
import { cleanLogText } from "../../lib/log-sanitize";

export function LogsPanel({ slug }: { slug: string }) {
  const { push } = useToast();
  const [lines, setLines] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [copying, setCopying] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(
      `/api/projects/${encodeURIComponent(slug)}/logs`
    );
    eventSourceRef.current = es;

    es.onmessage = (ev) => {
      if (paused) return;
      const raw = typeof ev.data === "string" ? ev.data : "";
      const cleaned = cleanLogText(raw, { stripAnsi: false });
      setLines((prev) => {
        const next = [...prev, cleaned];
        if (next.length > 1000) next.shift();
        return next;
      });
    };

    es.onerror = () => {
      push({
        title: "Log stream error",
        description: "Unable to stream Docker logs.",
        variant: "destructive"
      });
      es.close();
    };

    return () => {
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (!paused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, paused]);

  const filteredLines = search
    ? lines.filter((l) =>
        l.toLowerCase().includes(search.toLowerCase())
      )
    : lines;

  const COPY_LIMIT = 200;

  async function copyLogs(lastOnly: boolean) {
    if (lines.length === 0) {
      push({
        title: "Nothing to copy",
        description: "No log lines have been received yet."
      });
      return;
    }
    setCopying(true);
    try {
      const base = lastOnly ? lines.slice(-COPY_LIMIT) : lines;
      const text = cleanLogText(base.join("\n"), { stripAnsi: true });
      await navigator.clipboard.writeText(text);
      push({
        title: "Logs copied",
        description: lastOnly
          ? `Last ${Math.min(COPY_LIMIT, lines.length)} lines copied to clipboard.`
          : "All visible log lines copied to clipboard."
      });
    } catch (err: any) {
      push({
        title: "Copy failed",
        description: err?.message || "Unable to copy logs",
        variant: "destructive"
      });
    } finally {
      setCopying(false);
    }
  }

  async function downloadLogs() {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(
          slug
        )}/logs/download?lines=5000&stripAnsi=1`
      );
      if (!res.ok) {
        throw new Error("Unable to download logs");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // filename comes from Content-Disposition; browser will use it.
      a.download = "";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      push({
        title: "Download failed",
        description: err?.message || "Unable to download logs",
        variant: "destructive"
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter logs…"
            className="h-8 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => copyLogs(true)}
            disabled={copying}
            title="Copy last 200 lines"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={downloadLogs}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="h-80 overflow-y-auto rounded-lg border border-border/60 bg-black/80 p-3 font-mono text-[11px] text-emerald-100">
        {filteredLines.map((line, idx) => (
          <div key={idx} className="whitespace-pre-wrap">
            {line}
          </div>
        ))}
        {filteredLines.length === 0 && (
          <div className="text-xs text-muted-foreground">
            Waiting for log data from Docker…
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

