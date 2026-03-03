"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";
import { Eye, EyeOff } from "lucide-react";

type EnvRow = {
  key: string;
  value: string;
  masked?: string;
};

function getCsrfToken() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )ksr_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function ConfigEditor({ slug }: { slug: string }) {
  const { push } = useToast();
  const [envRows, setEnvRows] = useState<EnvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [envPath, setEnvPath] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/config`);
        if (!res.ok) throw new Error("Unable to load config");
        const data = await res.json();
        setEnvRows(
          data.env && Array.isArray(data.env)
            ? data.env.map((e: any) => ({
                key: e.key,
                value: e.value ?? "",
                masked: e.masked ?? e.value ?? ""
              }))
            : []
        );
        setEnvPath(data.envPath);
      } catch (err: any) {
        push({
          title: "Config load failed",
          description: err.message || "Unable to load config",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, push]);

  function setKeyValue(idx: number, key: string, value: string) {
    setEnvRows((rows) =>
      rows.map((row, i) => (i === idx ? { key, value } : row))
    );
  }

  const SENSITIVE_KEYS = /token|secret|key|pass|auth|cookie/i;

  function addRow(preset?: { key: string; value: string }) {
    if (preset) {
      setEnvRows((rows) => [...rows, { key: preset.key, value: preset.value }]);
    } else {
      setEnvRows((rows) => [...rows, { key: "", value: "" }]);
    }
  }

  const presets = [
    { key: "BOT_TOKEN", value: "" },
    { key: "ADMIN_CHAT_ID", value: "" },
    { key: "WEBHOOK_URL", value: "" },
    { key: "PORT", value: "3000" }
  ];

  async function save(restart: boolean) {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken()
        },
        body: JSON.stringify({
          env: envRows.filter((r) => r.key.trim().length > 0)
        })
      });
      if (!res.ok) throw new Error("Unable to save config");
      push({
        title: "Config saved",
        description: restart
          ? "Configuration updated. Restarting container..."
          : "Environment variables updated."
      });
      if (restart) {
        await fetch(
          `/api/projects/${encodeURIComponent(
            slug
          )}/runner?action=restart`,
          {
            method: "POST",
            headers: {
              "x-csrf-token": getCsrfToken()
            }
          }
        );
      }
    } catch (err: any) {
      push({
        title: "Config save failed",
        description: err.message || "Unable to save config",
        variant: "destructive"
      });
    }
  }

  const hasBotToken =
    !loading &&
    envRows.some(
      (r) => r.key.trim().toUpperCase() === "BOT_TOKEN" && r.value.trim().length > 0
    );

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl =
    origin && slug
      ? `${origin.replace(/\/+$/, "")}/webhook/${encodeURIComponent(slug)}`
      : "";

  async function copyWebhook() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      push({
        title: "Webhook URL copied",
        description: "Paste this into your Telegram bot webhook configuration."
      });
    } catch (err: any) {
      push({
        title: "Copy failed",
        description: err?.message || "Unable to copy webhook URL",
        variant: "destructive"
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Environment variables
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Variables like <code className="rounded bg-secondary px-1 py-0.5 text-[11px]">BOT_TOKEN</code>,
            API keys, and webhooks are stored in{" "}
            <code className="rounded bg-secondary px-1 py-0.5 text-[11px]">
              {envPath || ".env"}
            </code>{" "}
            inside the project workspace. Values are injected into the bot
            container when it starts.
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => addRow(p)}
              >
                + {p.key}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            {envRows.map((row, idx) => {
              const isSecret = SENSITIVE_KEYS.test(row.key);
              const showValue = revealed[idx] || !isSecret;
              const displayValue = showValue ? row.value : (row.masked ?? "****");
              return (
                <div
                  key={idx}
                  className="grid gap-2 md:grid-cols-[2fr,3fr,auto] items-end"
                >
                  <div className="space-y-1">
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Key
                    </Label>
                    <Input
                      value={row.key}
                      onChange={(e) =>
                        setKeyValue(idx, e.target.value, row.value)
                      }
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Value
                    </Label>
                    <div className="flex gap-1">
                      <Input
                        value={displayValue}
                        type={showValue ? "text" : "password"}
                        readOnly={isSecret && !revealed[idx]}
                        onChange={(e) =>
                          setKeyValue(idx, row.key, e.target.value)
                        }
                        className="h-8 font-mono text-xs flex-1"
                      />
                      {isSecret && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => setRevealed((r) => ({ ...r, [idx]: !r[idx] }))}
                          title={revealed[idx] ? "Hide" : "Reveal"}
                        >
                          {revealed[idx] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-red-400 hover:text-red-300"
                    onClick={() => setEnvRows((rows) => rows.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => addRow()}
            >
              Add variable
            </Button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => save(false)}
            >
              Save
            </Button>
            <Button
              size="sm"
              onClick={() => save(true)}
            >
              Apply &amp; Restart
            </Button>
          </div>
          {hasBotToken && webhookUrl && (
            <div className="mt-4 rounded-md border border-border/60 bg-card/70 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[11px] uppercase tracking-wide">
                  Webhook helper
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={copyWebhook}
                >
                  Copy URL
                </Button>
              </div>
              <p className="mt-1">
                Suggested webhook URL for this project. Configure it in your Telegram bot manually.
              </p>
              <code className="mt-1 block rounded bg-secondary px-1.5 py-0.5 text-[11px] break-all">
                {webhookUrl}
              </code>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

