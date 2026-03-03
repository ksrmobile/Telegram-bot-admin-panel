"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { useEffect, useState } from "react";

type Props = {
  className?: string;
};

export function ThemeToggle({ className }: Props) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Avoid hydration mismatch by not rendering until theme is resolved.
    return null;
  }

  const current = (resolvedTheme || theme || "dark") as "light" | "dark";
  const isDark = current === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      title="Toggle theme"
      className={cn(
        "h-9 w-9 rounded-full border border-border/70 bg-background/60 backdrop-blur-sm hover:bg-accent/40 hover:text-foreground",
        className
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </Button>
  );
}

