"use client";

// This page uses `useSearchParams`, which Next.js expects to be wrapped
// in a Suspense boundary during static generation. We instead opt out of
// static generation and always render it dynamically at runtime.
export const dynamic = "force-dynamic";

import { useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Shield, Lock, Eye, EyeOff, Check } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useToast } from "../../components/ui/toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "../../components/ui/card";
import { Separator } from "../../components/ui/separator";
import { ThemeToggle } from "../../components/theme-toggle";
import { KsrCredit } from "../../components/KsrCredit";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const { push } = useToast();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const successHandledRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    successHandledRef.current = false;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Login failed");
      }

      if (successHandledRef.current) {
        window.location.replace(redirect);
        return;
      }
      successHandledRef.current = true;
      push({
        title: "Welcome back",
        description: "You have been signed in."
      });
      window.location.replace(redirect);
    } catch (err: any) {
      const message = err?.message || "Unable to login";
      setError(message);
      push({
        title: "Login failed",
        description: message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-[#05040A] dark:via-[#0B0B11] dark:to-[#150B23] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-40 -top-40 h-72 w-72 rounded-full bg-purple-400/20 dark:bg-purple-600/20 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-4rem] h-80 w-80 rounded-full bg-purple-300/10 dark:bg-purple-500/10 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4 z-20 flex items-center gap-2 md:right-6 md:top-6">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex w-full max-w-5xl flex-col gap-8 rounded-3xl border border-border/70 bg-card/95 p-6 shadow-2xl shadow-purple-900/20 backdrop-blur-xl md:flex-row md:p-10">

        <div className="flex flex-1 flex-col justify-center gap-6 border-b border-border/50 pb-6 md:border-b-0 md:border-r md:pb-0 md:pr-8">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-purple-500/10 via-purple-400/5 to-transparent px-3 py-2 ring-1 ring-purple-500/20 dark:from-purple-600/20 dark:via-purple-500/10 dark:ring-purple-500/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-700 dark:bg-purple-600/25 dark:text-purple-200">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-purple-700 dark:text-purple-200/80">
                Telegram Bot Admin Panel
              </p>
              <p className="text-[11px] text-muted-foreground">
                Secure control panel for your Telegram bots
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Welcome back, operator
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Authenticate to access your Telegram bot fleet, manage workspaces,
              environment secrets, and Docker runtimes from a single, secure
              panel.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            <span>Single-tenant, self-hosted, Docker-native control plane.</span>
          </div>
        </div>

        <Card className="flex-1 bg-card/95 shadow-lg shadow-black/40">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold">
              Sign in to continue
            </CardTitle>
            <CardDescription>
              Use your admin credentials to access the panel.
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            {error && (
              <div className="mb-4 rounded-md border border-red-500/50 bg-red-500/5 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-background/80"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background/80 pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-border bg-background text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me on this device</span>
                </label>
              </div>

              <Button
                type="submit"
                className="mt-2 w-full"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in securely"}
              </Button>
            </form>

            <p className="mt-5 text-xs text-muted-foreground">
              Default admin user is <span className="font-mono">admin</span>. The
              installer or local configuration defines the initial password.
            </p>
            <KsrCredit />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

