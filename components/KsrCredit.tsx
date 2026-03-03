"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";

export function KsrCredit() {
  const links = [
    { href: "https://www.ksrteam.org/", label: "Website" },
    { href: "https://t.me/ksr_kdet", label: "Telegram" },
    { href: "https://t.me/ksr_team", label: "Channel" }
  ];

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground/70 dark:text-foreground/80">
        Built by KSR
      </span>
      <span className="text-muted-foreground/60">•</span>
      <div className="flex flex-wrap items-center gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="underline-offset-2 hover:underline">
              {link.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

