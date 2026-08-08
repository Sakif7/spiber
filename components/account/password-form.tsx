"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";

const field = { display: "grid", gap: 6 } as const;

/**
 * Change password for a signed-in user. On success every OTHER device is
 * signed out (tokenVersion bump); this session receives rotated cookies and
 * stays signed in.
 */
export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setState("saving");
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(
          json?.error?.code === "invalid_current"
            ? "Your current password is incorrect."
            : "Could not change the password. Please try again.",
        );
        setState("idle");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setState("saved");
      window.setTimeout(() => setState("idle"), 4000);
    } catch {
      setError("Network error. Please try again.");
      setState("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "var(--s-4)" }}>
      <div style={field}>
        <Label htmlFor="pw-current">Current password</Label>
        <Input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div style={field}>
        <Label htmlFor="pw-new">New password</Label>
        <Input
          id="pw-new"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <span
          style={{
            fontSize: "var(--fs-caption)",
            color: "var(--color-text-subtle)",
          }}
        >
          At least 8 characters. Changing it signs out your other devices.
        </span>
      </div>
      <div style={field}>
        <Label htmlFor="pw-confirm">Confirm new password</Label>
        <Input
          id="pw-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && (
        <p style={{ color: "var(--color-error)", fontSize: "var(--fs-small)" }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4)" }}>
        <CtaButton type="submit" variant="secondary">
          {state === "saving" ? "Changing…" : "Change password"}
        </CtaButton>
        {state === "saved" && (
          <span
            style={{
              color: "var(--color-success)",
              fontSize: "var(--fs-small)",
            }}
          >
            Password changed. Other devices were signed out.
          </span>
        )}
      </div>
    </form>
  );
}
