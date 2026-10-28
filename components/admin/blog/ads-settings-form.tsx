"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatApiError } from "@/lib/http/form-error";
import { useUnsavedGuard } from "@/components/admin/ui/unsaved-changes";
import type { AdsenseSettings } from "@/lib/ads/adsense";

export function AdsSettingsForm({ initial }: { initial: AdsenseSettings }) {
  const router = useRouter();

  const [enabled, setEnabled] = useState(initial.enabled);
  const [publisherId, setPublisherId] = useState(initial.publisherId);
  const [slot, setSlot] = useState(initial.inArticleSlot);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    enabled !== initial.enabled ||
    publisherId.trim() !== initial.publisherId ||
    slot.trim() !== initial.inArticleSlot;

  async function submit() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const res = await fetch("/api/admin/settings/ads", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, publisherId, inArticleSlot: slot }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);

    if (res.ok && json?.ok) {
      const stored = json.data as AdsenseSettings;
      setPublisherId(stored.publisherId);
      setSlot(stored.inArticleSlot);
      setSaved(true);
      toast.success(
        stored.enabled ? "Ads are on for blog posts." : "Ad settings saved.",
      );
      router.refresh();
    } else {
      const msg = formatApiError(json);
      setError(msg);
      toast.error(msg);
    }
  }

  useUnsavedGuard(dirty, submit);

  return (
    <Card className="grid gap-5 p-6">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <Switch
            id="ads-enabled"
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(v);
              setSaved(false);
            }}
          />
          <Label htmlFor="ads-enabled">Show ads on blog posts</Label>
        </div>
        <span className="text-muted-foreground text-xs">
          Turn on once Google has approved the site. Keep Auto ads off in
          AdSense, or Google adds ads of its own beyond these two slots.
        </span>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ads-publisher">Publisher ID</Label>
        <Input
          id="ads-publisher"
          value={publisherId}
          placeholder="pub-1234567890123456"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setPublisherId(e.target.value);
            setSaved(false);
          }}
        />
        <span className="text-muted-foreground text-xs">
          In AdSense under Account › Settings › Account information. Saving it
          publishes{" "}
          <a
            href="/ads.txt"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            ads.txt
          </a>
          , which Google checks before it approves the site, even with ads off.
        </span>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ads-slot">In-article ad unit ID</Label>
        <Input
          id="ads-slot"
          value={slot}
          placeholder="1234567890"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setSlot(e.target.value);
            setSaved(false);
          }}
        />
        <span className="text-muted-foreground text-xs">
          In AdSense, create an In-article ad unit (Ads › By ad unit) and copy
          the number after data-ad-slot.
        </span>
      </div>

      {error && <p className="text-destructive m-0 text-sm">{error}</p>}
      {saved && !error && (
        <p className="m-0 text-sm text-[var(--tone-success-fg)]">
          Settings saved.
        </p>
      )}

      <div>
        <Button type="button" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save ad settings"}
        </Button>
      </div>
    </Card>
  );
}
