"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QtyStepper } from "@/components/shop/qty-stepper";
import { useQuoteList } from "@/components/shop/use-quote-list";

type InitialContact = {
  name?: string;
  email?: string;
  organization?: string;
  phone?: string;
};

export function QuoteForm({
  initialContact,
}: {
  initialContact?: InitialContact;
}) {
  const t = useTranslations("quotation");
  const qc = useQueryClient();
  const { list, update, remove } = useQuoteList();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = list?.items ?? [];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (items.length === 0) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/instruments/quotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact: {
          name: fd.get("name"),
          email: fd.get("email"),
          organization: (fd.get("organization") as string) || undefined,
          phone: (fd.get("phone") as string) || undefined,
        },
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId ?? undefined,
          quantity: i.qty,
        })),
        deliveryLocation: {
          district: fd.get("district"),
          city: (fd.get("city") as string) || undefined,
        },
        timeline: (fd.get("timeline") as string) || undefined,
        notes: (fd.get("notes") as string) || undefined,
      }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) {
      setRef(json.data.quotationNumber);
      setDone(true);
      qc.setQueryData(["quote-list"], { items: [], count: 0 });
    } else {
      setError(t("error"));
    }
  }

  if (done) {
    return (
      <div style={panel}>
        <h2
          style={{
            color: "var(--color-text-strong)",
            fontSize: "var(--fs-h4)",
          }}
        >
          {t("successTitle")}
        </h2>
        <p style={{ color: "var(--color-text-muted)", maxWidth: "52ch" }}>
          {t("successNote")}
        </p>
        {ref && (
          <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--color-text-muted)" }}>
              {t("reference")}:
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
              {ref}
            </span>
          </p>
        )}
        <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap" }}>
          <CtaButton href="/account/quotations" variant="secondary">
            {t("viewMyQuotations")}
          </CtaButton>
          <CtaButton href="/medtrade">{t("continueBrowsing")}</CtaButton>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={panel}>
        <p
          style={{
            fontSize: "var(--fs-body-lg)",
            color: "var(--color-text-strong)",
          }}
        >
          {t("emptyTitle")}
        </p>
        <p style={{ color: "var(--color-text-muted)", maxWidth: "48ch" }}>
          {t("emptyNote")}
        </p>
        <CtaButton href="/medtrade">{t("browseCatalog")}</CtaButton>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "var(--s-8)",
        gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
        alignItems: "start",
      }}
      className="quote-form-grid"
    >
      {/* Items */}
      <div style={{ ...panel, gap: "var(--s-3)" }}>
        <h2 style={sectionTitle}>{t("itemsTitle")}</h2>
        {items.map((it) => (
          <div
            key={`${it.productId}:${it.variantId ?? ""}`}
            style={{
              display: "flex",
              gap: "var(--s-3)",
              alignItems: "center",
              padding: "var(--s-3) 0",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <div
              style={{
                position: "relative",
                width: 56,
                height: 56,
                flexShrink: 0,
                borderRadius: "var(--r-sm)",
                overflow: "hidden",
                background: "var(--color-surface-2)",
              }}
            >
              {it.image && (
                <Image
                  src={it.image}
                  alt=""
                  fill
                  style={{ objectFit: "cover" }}
                  sizes="56px"
                />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link
                href={`/medtrade/product/${it.slug}`}
                style={{
                  color: "var(--color-text-strong)",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                {it.name}
              </Link>
              <div
                style={{
                  fontSize: "var(--fs-caption)",
                  color: "var(--color-text-muted)",
                }}
              >
                {it.variantLabel ? `${it.variantLabel} · ` : ""}
                {it.sku}
              </div>
            </div>
            <QtyStepper
              value={it.qty}
              onChange={(q) =>
                update.mutate({
                  productId: it.productId,
                  variantId: it.variantId,
                  qty: q,
                })
              }
              max={9999}
            />
            <button
              type="button"
              onClick={() =>
                remove.mutate({
                  productId: it.productId,
                  variantId: it.variantId,
                })
              }
              aria-label={t("remove")}
              style={{
                border: "none",
                background: "none",
                color: "var(--color-text-muted)",
                cursor: "pointer",
                fontSize: "var(--fs-body)",
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={submit} style={{ ...panel, gap: "var(--s-4)" }}>
        <h2 style={sectionTitle}>{t("detailsTitle")}</h2>
        <div style={twoCol}>
          <Field label={t("name")}>
            <Input
              name="name"
              required
              maxLength={120}
              defaultValue={initialContact?.name ?? ""}
            />
          </Field>
          <Field label={t("email")}>
            <Input
              name="email"
              type="email"
              required
              defaultValue={initialContact?.email ?? ""}
            />
          </Field>
        </div>
        <div style={twoCol}>
          <Field label={t("organization")}>
            <Input
              name="organization"
              maxLength={160}
              defaultValue={initialContact?.organization ?? ""}
            />
          </Field>
          <Field label={t("phone")}>
            <Input
              name="phone"
              maxLength={40}
              defaultValue={initialContact?.phone ?? ""}
            />
          </Field>
        </div>
        <div style={twoCol}>
          <Field label={t("district")}>
            <Input name="district" required maxLength={100} />
          </Field>
          <Field label={t("city")}>
            <Input name="city" maxLength={100} />
          </Field>
        </div>
        <Field label={t("timeline")}>
          <Input
            name="timeline"
            maxLength={120}
            placeholder={t("timelinePlaceholder")}
          />
        </Field>
        <Field label={t("notes")}>
          <textarea
            name="notes"
            rows={4}
            maxLength={5000}
            style={{
              font: "inherit",
              padding: "8px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-sm)",
              background: "var(--color-surface)",
              width: "100%",
              resize: "vertical",
            }}
          />
        </Field>
        {error && (
          <span
            style={{ color: "var(--color-error)", fontSize: "var(--fs-sm)" }}
          >
            {error}
          </span>
        )}
        <CtaButton type="submit" style={{ opacity: busy ? 0.7 : 1 }}>
          {busy ? t("submitting") : t("submitRequest")}
        </CtaButton>
      </form>
    </div>
  );
}

const panel: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
  padding: "var(--s-6)",
  display: "grid",
  gap: "var(--s-4)",
};

const sectionTitle: CSSProperties = {
  fontSize: "var(--fs-h6)",
  color: "var(--color-text-strong)",
  fontWeight: 700,
};

const twoCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "var(--s-4)",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
