"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useToast } from "../ui/toast";

function getCsrfToken() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )ksr_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function ChangePasswordForm() {
  const { push } = useToast();
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPass.length < 8) {
      push({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPass !== confirm) {
      push({ title: "Passwords don't match", description: "Confirm your new password.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken()
        },
        body: JSON.stringify({ currentPassword: current, newPassword: newPass })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to change password");
      }
      push({ title: "Password updated", description: "Sign in again with your new password." });
      setCurrent("");
      setNewPass("");
      setConfirm("");
    } catch (err: any) {
      push({ title: "Error", description: err.message || "Could not change password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div className="space-y-2">
        <Label htmlFor="current">Current password</Label>
        <Input
          id="current"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new">New password</Label>
        <Input
          id="new"
          type="password"
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Updating…" : "Change password"}
      </Button>
    </form>
  );
}
