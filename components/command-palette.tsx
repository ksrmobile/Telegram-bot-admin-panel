"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderTree,
  Plus,
  UploadCloud,
  Server,
  Settings
} from "lucide-react";
import { cn } from "../lib/utils";

const ACTIONS: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderTree },
  { label: "New project", href: "/projects/new", icon: Plus },
  { label: "Upload bot ZIP", href: "/projects/new", icon: UploadCloud },
  { label: "System", href: "/system", icon: Server },
  { label: "Settings", href: "/settings", icon: Settings }
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const filtered = ACTIONS.filter(
    (a) => !query.trim() || a.label.toLowerCase().includes(query.toLowerCase())
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelected(0);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
        if (!open) setSelected(0);
      }
      if (!open) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => (s + 1) % Math.max(1, filtered.length));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => (s - 1 + filtered.length) % Math.max(1, filtered.length));
      }
      if (e.key === "Enter" && filtered[selected]) {
        e.preventDefault();
        router.push(filtered[selected].href);
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, filtered, selected, router]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-border px-3">
          <span className="text-muted-foreground text-sm">⌘K</span>
          <input
            type="text"
            placeholder="Search or run..."
            className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <ul className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
          ) : (
            filtered.map((action, idx) => {
              const Icon = action.icon;
              return (
                <li key={action.href + action.label}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                      idx === selected ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-secondary/50"
                    )}
                    onClick={() => {
                      router.push(action.href);
                      close();
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
