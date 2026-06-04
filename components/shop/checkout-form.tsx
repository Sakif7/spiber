"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { formatBDT } from "@/lib/money";
import type { Locale } from "@/i18n/routing";

const schema = z.object({
  fullName: z.string().min(1),
  email: z.email(),
  phone: z.string().min(3),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  district: z.string().min(1),
  postalCode: z.string().optional(),
  note: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

type Totals = {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
};

export function CheckoutForm() {
  const t = useTranslations("shop.checkout");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const qc = useQueryClient();

  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Server-priced summary; refetches automatically when the applied coupon changes.
  const quoteQuery = useQuery({
    queryKey: ["checkout-quote", appliedCoupon],
    queryFn: async () => {
      const res = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: appliedCoupon ?? undefined }),
      });
      const json = await res.json();
      return json.ok
        ? (json.data as { totals: Totals; couponValid?: boolean })
        : null;
    },
  });
  const totals = quoteQuery.data?.totals ?? null;
  const couponStatus: "idle" | "applied" | "invalid" = !appliedCoupon
    ? "idle"
    : quoteQuery.data?.couponValid
      ? "applied"
      : "invalid";

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: values.email,
        shippingAddress: {
          label: values.fullName,
          line1: values.line1,
          line2: values.line2,
          city: values.city,
          district: values.district,
          postalCode: values.postalCode,
          phone: values.phone,
        },
        couponCode:
          couponStatus === "applied" ? (appliedCoupon ?? undefined) : undefined,
        note: values.note,
        idempotencyKey,
      }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      qc.setQueryData(["cart"], { items: [], subtotalMinor: 0, count: 0 });
      router.push(
        `/marketplace/order/${json.data.orderNumber}?email=${encodeURIComponent(json.data.email)}`,
      );
      return;
    }
    setSubmitError(
      json?.error?.code === "out_of_stock" ? t("outOfStock") : t("error"),
    );
  }

  const field = { display: "grid", gap: 6 } as const;
  const row = {
    display: "grid",
    gap: "var(--s-4)",
    gridTemplateColumns: "1fr 1fr",
  } as const;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      style={{
        display: "grid",
        gap: "var(--s-6)",
        gridTemplateColumns: "minmax(0, 1fr) 320px",
        alignItems: "start",
      }}
    >
      <div style={{ display: "grid", gap: "var(--s-5)" }}>
        <h2 style={{ fontSize: "var(--fs-h4)" }}>{t("contact")}</h2>
        <div style={row}>
          <div style={field}>
            <Label htmlFor="fullName">{t("fullName")}</Label>
            <Input
              id="fullName"
              {...register("fullName")}
              aria-invalid={!!errors.fullName}
            />
          </div>
          <div style={field}>
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input
              id="phone"
              {...register("phone")}
              aria-invalid={!!errors.phone}
            />
          </div>
        </div>
        <div style={field}>
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            {...register("email")}
            aria-invalid={!!errors.email}
          />
        </div>

        <h2 style={{ fontSize: "var(--fs-h4)", marginTop: "var(--s-4)" }}>
          {t("shipping")}
        </h2>
        <div style={field}>
          <Label htmlFor="line1">{t("line1")}</Label>
          <Input
            id="line1"
            {...register("line1")}
            aria-invalid={!!errors.line1}
          />
        </div>
        <div style={field}>
          <Label htmlFor="line2">{t("line2")}</Label>
          <Input id="line2" {...register("line2")} />
        </div>
        <div style={row}>
          <div style={field}>
            <Label htmlFor="city">{t("city")}</Label>
            <Input
              id="city"
              {...register("city")}
              aria-invalid={!!errors.city}
            />
          </div>
          <div style={field}>
            <Label htmlFor="district">{t("district")}</Label>
            <Input
              id="district"
              {...register("district")}
              aria-invalid={!!errors.district}
            />
          </div>
        </div>
        <div style={field}>
          <Label htmlFor="postalCode">{t("postalCode")}</Label>
          <Input id="postalCode" {...register("postalCode")} />
        </div>
        <div style={field}>
          <Label htmlFor="note">{t("note")}</Label>
          <Input id="note" {...register("note")} />
        </div>
      </div>

      <aside
        style={{
          display: "grid",
          gap: "var(--s-3)",
          padding: "var(--s-5)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          background: "var(--color-surface)",
        }}
      >
        <strong style={{ fontFamily: "var(--font-display)" }}>
          {t("summary")}
        </strong>

        <div style={{ display: "flex", gap: 8 }}>
          <Input
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            placeholder={t("coupon")}
          />
          <button
            type="button"
            onClick={() => setAppliedCoupon(coupon)}
            style={{
              whiteSpace: "nowrap",
              padding: "0 12px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface-2)",
              cursor: "pointer",
            }}
          >
            {t("applyCoupon")}
          </button>
        </div>
        {couponStatus === "applied" && (
          <span
            style={{
              color: "var(--color-success)",
              fontSize: "var(--fs-small)",
            }}
          >
            {t("couponApplied")}
          </span>
        )}
        {couponStatus === "invalid" && (
          <span
            style={{ color: "var(--color-error)", fontSize: "var(--fs-small)" }}
          >
            {t("couponInvalid")}
          </span>
        )}

        {totals && (
          <div
            style={{
              display: "grid",
              gap: 6,
              marginTop: "var(--s-3)",
              fontSize: "var(--fs-body-sm)",
            }}
          >
            <Row
              label={t("summary")}
              value={formatBDT(totals.subtotalMinor, locale)}
            />
            {totals.discountMinor > 0 && (
              <Row
                label={t("discount")}
                value={`− ${formatBDT(totals.discountMinor, locale)}`}
              />
            )}
            <Row
              label={t("shippingFee")}
              value={
                totals.shippingMinor === 0
                  ? t("free")
                  : formatBDT(totals.shippingMinor, locale)
              }
            />
            <div
              style={{
                borderTop: "1px solid var(--color-hairline)",
                marginTop: 4,
                paddingTop: 8,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <strong>{t("total")}</strong>
              <strong>{formatBDT(totals.totalMinor, locale)}</strong>
            </div>
          </div>
        )}

        <p
          style={{
            fontSize: "var(--fs-caption)",
            color: "var(--color-text-muted)",
          }}
        >
          {t("paymentNote")}
        </p>
        {submitError && (
          <p
            style={{ color: "var(--color-error)", fontSize: "var(--fs-small)" }}
          >
            {submitError}
          </p>
        )}
        <CtaButton type="submit" style={{ width: "100%" }}>
          {isSubmitting ? t("placing") : t("placeOrder")}
        </CtaButton>
        <Link
          href="/marketplace/cart"
          style={{
            textAlign: "center",
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
          }}
        >
          {t("backToCart")}
        </Link>
      </aside>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        color: "var(--color-text-muted)",
      }}
    >
      <span>{label}</span>
      <span style={{ color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}
