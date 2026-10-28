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
  /** Poisha dropped so the total is whole taka (0 to −99). */
  roundingMinor: number;
  totalMinor: number;
};

export function CheckoutForm({
  initial,
  storefront = "marketplace",
  basePath = "/kart",
  creditEligible = false,
  creditTermsDays = 30,
  creditApplyHref,
  onlineAvailable = false,
}: {
  /** Prefill (logged-in users: profile name/phone + default address). */
  initial?: Partial<FormValues>;
  /** Which cart is being checked out; also selects the tax rules. */
  storefront?: "instruments" | "marketplace";
  /** Keeps every link inside the storefront the shopper is in. */
  basePath?: string;
  /** Medtrade: the signed-in user has an ACTIVE credit account. */
  creditEligible?: boolean;
  creditTermsDays?: number;
  /** Where a non-enlisted shopper can apply (omit to hide the prompt). */
  creditApplyHref?: string;
  /** An online gateway is configured, so "pay now" can be offered. */
  onlineAvailable?: boolean;
}) {
  const t = useTranslations("shop.checkout");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const qc = useQueryClient();
  const isMedtrade = storefront === "instruments";
  // Whether the customer is actually offered a choice. Spiber Kart with no
  // gateway configured shows nothing, and then no method is sent at all, so
  // the order keeps the storefront's existing arrangement rather than being
  // silently recorded as something the customer never picked.
  const showPaymentChoice = onlineAvailable || isMedtrade;

  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // The server re-checks whatever the client sends: it validates the method
  // against the storefront and re-checks credit against an active account.
  const [paymentMethod, setPaymentMethod] = useState<
    "online" | "cod" | "credit"
  >(onlineAvailable ? "online" : "cod");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });

  // Server-priced summary; refetches automatically when the applied coupon changes.
  const quoteQuery = useQuery({
    queryKey: ["checkout-quote", storefront, appliedCoupon],
    queryFn: async () => {
      const res = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couponCode: appliedCoupon ?? undefined,
          storefront,
        }),
      });
      const json = await res.json();
      return json.ok
        ? (json.data as {
            totals: Totals;
            couponValid?: boolean;
            taxRateBp?: number;
          })
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
        storefront,
        paymentMethod: showPaymentChoice ? paymentMethod : undefined,
        // PayStation sends the shopper back in the language they paid in.
        locale,
      }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      qc.setQueryData(["cart", storefront], {
        items: [],
        subtotalMinor: 0,
        count: 0,
      });
      if (json.data.redirectUrl) {
        window.location.assign(json.data.redirectUrl);
        return;
      }
      router.push(
        `${basePath}/order/${json.data.orderNumber}?email=${encodeURIComponent(json.data.email)}`,
      );
      return;
    }
    const code = json?.error?.code;
    setSubmitError(
      code === "payment_unavailable"
        ? t("paymentUnavailable")
        : code === "invalid_payment_method"
          ? t("paymentMethodUnavailable")
          : code === "out_of_stock"
            ? t("outOfStock")
            : code === "credit_not_available"
              ? t("creditNotAvailable")
              : t("error"),
    );
  }

  const field = { display: "grid", gap: 6 } as const;
  const payOption: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 10,
    alignItems: "start",
    cursor: "pointer",
  };
  const payHint: React.CSSProperties = {
    display: "block",
    fontSize: "var(--fs-caption)",
    color: "var(--color-text-muted)",
    marginTop: 2,
  };
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

        {/* Shown whenever there is a choice to make: an online gateway, or
            Medtrade's cash-on-delivery and credit terms. */}
        {showPaymentChoice && (
          <fieldset
            style={{
              display: "grid",
              gap: 10,
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-lg)",
              padding: "var(--s-4)",
              margin: 0,
            }}
          >
            <legend
              style={{
                fontWeight: 600,
                padding: "0 6px",
                color: "var(--color-text-strong)",
              }}
            >
              {t("paymentMethod")}
            </legend>

            {onlineAvailable && (
              <label style={payOption}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="online"
                  checked={paymentMethod === "online"}
                  onChange={() => setPaymentMethod("online")}
                />
                <span>
                  <strong>{t("payOnline")}</strong>
                  <span style={payHint}>{t("payOnlineNote")}</span>
                </span>
              </label>
            )}

            <label style={payOption}>
              <input
                type="radio"
                name="paymentMethod"
                value="cod"
                checked={paymentMethod === "cod"}
                onChange={() => setPaymentMethod("cod")}
              />
              <span>
                <strong>{t("cod")}</strong>
                <span style={payHint}>{t("codNote")}</span>
              </span>
            </label>

            {!isMedtrade ? null : creditEligible ? (
              <label style={payOption}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="credit"
                  checked={paymentMethod === "credit"}
                  onChange={() => setPaymentMethod("credit")}
                />
                <span>
                  <strong>{t("credit")}</strong>
                  <span style={payHint}>
                    {t("creditNote", { days: creditTermsDays })}
                  </span>
                </span>
              </label>
            ) : (
              <p style={{ ...payHint, margin: 0 }}>
                {t("creditUnavailable")}
                {creditApplyHref ? (
                  <>
                    {" "}
                    <Link
                      href={creditApplyHref}
                      style={{
                        color: "var(--color-brand-deep)",
                        fontWeight: 600,
                      }}
                    >
                      {t("applyCredit")}
                    </Link>
                  </>
                ) : null}
              </p>
            )}
          </fieldset>
        )}
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
            {totals.taxMinor > 0 && (
              <Row
                label={
                  quoteQuery.data?.taxRateBp
                    ? `${t("vat")} (${quoteQuery.data.taxRateBp / 100}%)`
                    : t("vat")
                }
                value={formatBDT(totals.taxMinor, locale)}
              />
            )}
            {totals.roundingMinor !== 0 && (
              <Row
                label={t("rounding")}
                value={`− ${formatBDT(-totals.roundingMinor, locale)}`}
              />
            )}
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
          {showPaymentChoice && paymentMethod === "online"
            ? t("payOnlineNote")
            : isMedtrade
              ? paymentMethod === "credit"
                ? t("creditNote", { days: creditTermsDays })
                : t("codNote")
              : showPaymentChoice
                ? t("codNote")
                : t("paymentNote")}{" "}
          <Link
            href="/kart/returns"
            style={{ color: "var(--color-brand-deep)", fontWeight: 600 }}
          >
            {t("returnsPolicy")}
          </Link>
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
          href={`${basePath}/cart`}
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
