"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useToast } from "../ui/toast";

function getCsrfToken() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )ksr_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function NotificationSettings() {
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [maskedToken, setMaskedToken] = useState<string | null>(null);
  const [maskedChatId, setMaskedChatId] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [chatIdInput, setChatIdInput] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings/notifications");
        if (!res.ok) return;
        const data = await res.json();
        setMaskedToken(data.notifyBotTokenMasked ?? null);
        setMaskedChatId(data.notifyChatIdMasked ?? null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken()
        },
        body: JSON.stringify({
          notifyBotToken: tokenInput,
          notifyChatId: chatIdInput
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Unable to update notifications");
      }
      if (tokenInput.trim()) {
        setMaskedToken("****" + tokenInput.trim().slice(-4));
      }
      if (chatIdInput.trim()) {
        setMaskedChatId("****" + chatIdInput.trim().slice(-4));
      }
      setTokenInput("");
      setChatIdInput("");
      push({
        title: "Notification settings saved",
        description: "Crash notifications are now configured."
      });
    } catch (err: any) {
      push({
        title: "Save failed",
        description: err.message || "Unable to update notifications",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-md">
      <p className="text-xs text-muted-foreground">
        When enabled, the panel sends a Telegram message when a bot container exits
        with a non-zero code. Leave fields blank to disable notifications.
      </p>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div>
          <span className="font-semibold">Current bot token:</span>{" "}
          {maskedToken || "not set"}
        </div>
        <div>
          <span className="font-semibold">Current chat ID:</span>{" "}
          {maskedChatId || "not set"}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notify-bot-token">Notification bot token</Label>
        <Input
          id="notify-bot-token"
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Leave blank to keep existing or disable"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notify-chat-id">Notification chat ID</Label>
        <Input
          id="notify-chat-id"
          type="password"
          value={chatIdInput}
          onChange={(e) => setChatIdInput(e.target.value)}
          placeholder="Leave blank to keep existing or disable"
          autoComplete="off"
        />
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Saving…" : "Save notifications"}
      </Button>
    </form>
  );
}

