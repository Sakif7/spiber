"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { SingleImageField } from "@/components/admin/upload-fields";

type BankDetails = {
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  branch?: string;
  routingNumber?: string;
  mobileWallet?: string;
};

type Initial = {
  displayName: string;
  bio: string;
  logo: string;
  bankDetails: BankDetails;
};

export function SellerProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();

  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [logo, setLogo] = useState(initial.logo ?? "");
  const [accountName, setAccountName] = useState(
    initial.bankDetails.accountName ?? "",
  );
  const [bankName, setBankName] = useState(initial.bankDetails.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(
    initial.bankDetails.accountNumber ?? "",
  );
  const [branch, setBranch] = useState(initial.bankDetails.branch ?? "");
  const [routingNumber, setRoutingNumber] = useState(
    initial.bankDetails.routingNumber ?? "",
  );
  const [mobileWallet, setMobileWallet] = useState(
    initial.bankDetails.mobileWallet ?? "",
  );

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!displayName.trim()) {
      setError("Store name is required.");
      return;
    }

    const body = {
      displayName: displayName.trim(),
      bio: bio.trim(),
      logo: logo.trim(),
      bankDetails: {
        accountName: accountName.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        branch: branch.trim(),
        routingNumber: routingNumber.trim(),
        mobileWallet: mobileWallet.trim(),
      },
    };

    setBusy(true);
    try {
      const res = await fetch("/api/seller/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(
          json?.error?.message ??
            json?.error?.code ??
            "Could not save your profile. Please try again.",
        );
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "var(--s-5)" }}>
      <Section title="Store details">
        <Field label="Store name" required>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={120}
          />
        </Field>
        <Field label="Bio">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={1000}
            style={textarea}
          />
        </Field>
        <Field label="Logo">
          <SingleImageField
            value={logo}
            onChange={setLogo}
            label="Upload logo"
            endpoint="/api/seller/uploads"
          />
        </Field>
      </Section>

      <Section title="Bank details">
        <div style={twoCol}>
          <Field label="Account name">
            <Input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              maxLength={120}
            />
          </Field>
          <Field label="Bank name">
            <Input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              maxLength={120}
            />
          </Field>
        </div>
        <div style={twoCol}>
          <Field label="Account number">
            <Input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              maxLength={60}
            />
          </Field>
          <Field label="Branch">
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              maxLength={120}
            />
          </Field>
        </div>
        <div style={twoCol}>
          <Field label="Routing number">
            <Input
              value={routingNumber}
              onChange={(e) => setRoutingNumber(e.target.value)}
              maxLength={60}
            />
          </Field>
          <Field label="Mobile wallet">
            <Input
              value={mobileWallet}
              onChange={(e) => setMobileWallet(e.target.value)}
              maxLength={60}
            />
          </Field>
        </div>
      </Section>

      {error && (
        <span style={{ color: "var(--color-error)", fontSize: "var(--fs-sm)" }}>
          {error}
        </span>
      )}
      {saved && (
        <span
          style={{ color: "var(--color-success)", fontSize: "var(--fs-sm)" }}
        >
          Saved.
        </span>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <CtaButton type="submit" style={{ opacity: busy ? 0.7 : 1 }}>
          {busy ? "Saving…" : "Save profile"}
        </CtaButton>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-lg)",
        background: "var(--color-surface)",
        padding: "var(--s-5)",
        display: "grid",
        gap: "var(--s-4)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-h5)",
          color: "var(--color-text-strong)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label>
        {label}
        {required && <span style={{ color: "var(--color-error)" }}> *</span>}
      </Label>
      {children}
    </div>
  );
}

const twoCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "var(--s-4)",
};

const textarea: CSSProperties = {
  font: "inherit",
  padding: "8px 10px",
  border: "1px solid var(--color-border-field)",
  borderRadius: "var(--r-sm)",
  background: "var(--color-surface)",
  width: "100%",
  resize: "vertical",
  color: "var(--color-text)",
};
