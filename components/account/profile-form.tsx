"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";

export type ProfileInitial = {
  name: string;
  email: string;
  phone: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    district: string;
    postalCode: string;
  };
};

const field = { display: "grid", gap: 6 } as const;
const row = {
  display: "grid",
  gap: "var(--s-4)",
  gridTemplateColumns: "1fr 1fr",
} as const;

/**
 * Edit name / phone / default shipping address. The default address prefills
 * checkout and quotation forms. Leaving every address field empty clears the
 * saved address.
 */
export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [addr, setAddr] = useState(initial.address);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const setA = (k: keyof ProfileInitial["address"]) => (v: string) =>
    setAddr((a) => ({ ...a, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    const hasAddress = Boolean(
      addr.line1.trim() ||
      addr.city.trim() ||
      addr.district.trim() ||
      addr.postalCode.trim() ||
      addr.line2.trim(),
    );
    if (hasAddress) {
      if (!addr.line1.trim() || !addr.city.trim() || !addr.district.trim()) {
        setError("An address needs at least line 1, city, and district.");
        return;
      }
      if (!phone.trim()) {
        setError("Add a phone number to save an address.");
        return;
      }
    }
    setState("saving");
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
          defaultAddress: hasAddress
            ? {
                label: "Default",
                line1: addr.line1.trim(),
                line2: addr.line2.trim() || undefined,
                city: addr.city.trim(),
                district: addr.district.trim(),
                postalCode: addr.postalCode.trim() || undefined,
                phone: phone.trim(),
              }
            : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError("Could not save your profile. Please try again.");
        setState("idle");
        return;
      }
      setState("saved");
      router.refresh();
      window.setTimeout(() => setState("idle"), 2500);
    } catch {
      setError("Network error. Please try again.");
      setState("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "var(--s-4)" }}>
      <div style={row}>
        <div style={field}>
          <Label htmlFor="pf-name">Full name</Label>
          <Input
            id="pf-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
          />
        </div>
        <div style={field}>
          <Label htmlFor="pf-phone">Phone</Label>
          <Input
            id="pf-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            autoComplete="tel"
          />
        </div>
      </div>
      <div style={field}>
        <Label htmlFor="pf-email">Email</Label>
        <Input id="pf-email" value={initial.email} disabled />
        <span
          style={{
            fontSize: "var(--fs-caption)",
            color: "var(--color-text-subtle)",
          }}
        >
          Email changes aren&apos;t supported yet — contact support if needed.
        </span>
      </div>

      <strong
        style={{
          marginTop: "var(--s-2)",
          fontFamily: "var(--font-display)",
          color: "var(--color-text-strong)",
        }}
      >
        Default shipping address
      </strong>
      <div style={field}>
        <Label htmlFor="pf-line1">Address line 1</Label>
        <Input
          id="pf-line1"
          value={addr.line1}
          onChange={(e) => setA("line1")(e.target.value)}
          maxLength={200}
        />
      </div>
      <div style={field}>
        <Label htmlFor="pf-line2">Address line 2 (optional)</Label>
        <Input
          id="pf-line2"
          value={addr.line2}
          onChange={(e) => setA("line2")(e.target.value)}
          maxLength={200}
        />
      </div>
      <div style={row}>
        <div style={field}>
          <Label htmlFor="pf-city">City</Label>
          <Input
            id="pf-city"
            value={addr.city}
            onChange={(e) => setA("city")(e.target.value)}
            maxLength={100}
          />
        </div>
        <div style={field}>
          <Label htmlFor="pf-district">District</Label>
          <Input
            id="pf-district"
            value={addr.district}
            onChange={(e) => setA("district")(e.target.value)}
            maxLength={100}
          />
        </div>
      </div>
      <div style={field}>
        <Label htmlFor="pf-postal">Postal code (optional)</Label>
        <Input
          id="pf-postal"
          value={addr.postalCode}
          onChange={(e) => setA("postalCode")(e.target.value)}
          maxLength={20}
        />
      </div>

      {error && (
        <p style={{ color: "var(--color-error)", fontSize: "var(--fs-small)" }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4)" }}>
        <CtaButton type="submit">
          {state === "saving" ? "Saving…" : "Save profile"}
        </CtaButton>
        {state === "saved" && (
          <span
            style={{
              color: "var(--color-success)",
              fontSize: "var(--fs-small)",
            }}
          >
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}
