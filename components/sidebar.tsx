"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, FolderTree, LayoutDashboard, Settings, ShieldAlert, Server } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderTree },
  { href: "/system", label: "System", icon: Server },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();
  const [insecure, setInsecure] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setInsecure(window.location.protocol !== "https:");
    }
  }, []);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-[hsl(var(--sidebar))] dark:bg-[#050509]/90 dark:border-border/60 backdrop-blur">
      <div className="flex h-16 items-center gap-2 border-b border-border/80 dark:border-border/60 px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">
            Telegram Bot Admin Panel
          </div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Control Center
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {insecure && (
          <div className="mx-3 mt-3 flex items-start gap-2 rounded-lg border border-amber-400 bg-amber-100 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <p>
              HTTPS is not enabled. For production, place this panel behind a TLS
              reverse proxy.
            </p>
          </div>
        )}

        <nav className="mt-4 space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-foreground dark:shadow-inner dark:shadow-primary/40"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border/80 dark:border-border/60 p-3">
        <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/70 dark:text-foreground/80">
            Built by KSR
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-xs text-muted-foreground hover:text-foreground"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
        >
          Sign out
        </Button>
      </div>
    </aside>
  );
}

