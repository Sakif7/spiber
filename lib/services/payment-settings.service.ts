import { getSetting, setSetting } from "@/lib/repositories/settings.repo";
import {
  LIVE_PAYMENT_POINTS,
  PAYMENT_SETTINGS_DEFAULTS,
  paymentPointEnum,
  type FeeRateVersion,
  type PaymentPoint,
  type PaymentSettings,
  type PaymentSettingsPatch,
} from "@/lib/schemas/payment";

const KEY = "payments";

/**
 * Where online payment is offered, EMI, and the gateway's fee rates — one
 * Setting row, super-admin only. Every payment point starts switched off, so
 * nothing changes for customers until someone switches a door on.
 */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  const stored = await getSetting<Partial<PaymentSettings>>(KEY);
  const points = { ...PAYMENT_SETTINGS_DEFAULTS.points };
  for (const p of paymentPointEnum.options) {
    if (typeof stored?.points?.[p] === "boolean") points[p] = stored.points[p];
  }
  return {
    points,
    emi: stored?.emi === true,
    feeRates: [...(stored?.feeRates ?? [])].sort((a, b) =>
      a.from.localeCompare(b.from),
    ),
  };
}

export async function isPaymentPointOn(point: PaymentPoint): Promise<boolean> {
  try {
    return (await getPaymentSettings()).points[point];
  } catch {
    // A settings read that fails must not take checkout down with it; the
    // offline methods still work.
    return false;
  }
}

export type SettingsResult =
  | { ok: true; settings: PaymentSettings }
  | {
      ok: false;
      code: "fee_rates_missing" | "point_not_ready";
      point?: PaymentPoint;
    };

export async function updatePaymentSettings(
  patch: PaymentSettingsPatch,
): Promise<SettingsResult> {
  const current = await getPaymentSettings();
  const next: PaymentSettings = {
    ...current,
    points: { ...current.points, ...(patch.points ?? {}) },
    emi: patch.emi ?? current.emi,
  };
  for (const p of paymentPointEnum.options) {
    if (!next.points[p] || current.points[p]) continue;
    // Switching a door on: it has to be built, and the fee has to be known,
    // or payments would land in the report with no cost against them.
    if (!LIVE_PAYMENT_POINTS.includes(p)) {
      return { ok: false, code: "point_not_ready", point: p };
    }
    if (next.feeRates.length === 0) {
      return { ok: false, code: "fee_rates_missing", point: p };
    }
  }
  await setSetting(KEY, next);
  return { ok: true, settings: next };
}

/** Add a set of rates from a day; a set already starting that day is replaced. */
export async function saveFeeRateVersion(
  version: FeeRateVersion,
): Promise<PaymentSettings> {
  const current = await getPaymentSettings();
  const feeRates = [
    ...current.feeRates.filter((v) => v.from !== version.from),
    version,
  ].sort((a, b) => a.from.localeCompare(b.from));
  const next = { ...current, feeRates };
  await setSetting(KEY, next);
  return next;
}

export type RemoveRatesResult =
  | { ok: true; settings: PaymentSettings }
  | { ok: false; code: "not_found" | "last_rates_in_use" };

/**
 * Drop a set of rates. Fees already taken keep what they were frozen at; the
 * last set cannot go while any door is open, or new payments would carry no fee.
 */
export async function removeFeeRateVersion(
  from: string,
): Promise<RemoveRatesResult> {
  const current = await getPaymentSettings();
  if (!current.feeRates.some((v) => v.from === from)) {
    return { ok: false, code: "not_found" };
  }
  const feeRates = current.feeRates.filter((v) => v.from !== from);
  if (feeRates.length === 0 && Object.values(current.points).some(Boolean)) {
    return { ok: false, code: "last_rates_in_use" };
  }
  const next = { ...current, feeRates };
  await setSetting(KEY, next);
  return { ok: true, settings: next };
}
