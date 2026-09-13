"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { isValidLocalPart, normaliseLocalPart } from "@/lib/mail/address";

/**
 * The one control for a company address: the local part with the fixed
 * domain as a suffix, checked as you type against employees, logins,
 * mailboxes and the mail server. Used by the "New employee" form and by the
 * Login & mailbox card when an older record is given an address.
 */
export type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "free"; address: string }
  | { state: "taken"; address: string; reason: string }
  | { state: "invalid" };

const TAKEN_REASON: Record<string, string> = {
  invalid: "Letters, digits, dots and dashes only.",
  employee: "Another employee already has this address.",
  login: "A customer account uses this address.",
  mailbox: "A mailbox with this address already exists.",
  server: "This address already exists on the mail server.",
};

/** True when the current value may be submitted. */
export function availabilityAllowsSave(a: Availability, local: string) {
  return Boolean(local) && a.state !== "taken" && a.state !== "invalid";
}

export function useBusinessEmailAvailability() {
  const [availability, setAvailability] = useState<Availability>({
    state: "idle",
  });
  const check = useDebouncedCallback(async (local: string) => {
    const norm = normaliseLocalPart(local);
    if (!norm) return setAvailability({ state: "idle" });
    if (!isValidLocalPart(norm)) return setAvailability({ state: "invalid" });
    setAvailability({ state: "checking" });
    try {
      const res = await fetch(
        `/api/admin/company/hr/employees/business-email?local=${encodeURIComponent(norm)}`,
      );
      const json = (await res.json()) as {
        data?: { available: boolean; address: string; reason?: string };
      };
      if (!json.data) throw new Error("no data");
      setAvailability(
        json.data.available
          ? { state: "free", address: json.data.address }
          : json.data.reason === "invalid"
            ? { state: "invalid" }
            : {
                state: "taken",
                address: json.data.address,
                reason: json.data.reason ?? "",
              },
      );
    } catch {
      setAvailability({ state: "idle" });
    }
  }, 350);
  return { availability, check };
}

export function BusinessEmailField({
  id,
  value,
  onChange,
  availability,
  mailDomain,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (local: string) => void;
  availability: Availability;
  mailDomain: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex min-w-0">
        <Input
          id={id}
          className="min-w-0 rounded-r-none font-mono"
          value={value}
          onChange={(e) => onChange(normaliseLocalPart(e.target.value))}
          maxLength={64}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-describedby={`${id}-state`}
        />
        <span className="border-input bg-muted text-muted-foreground flex h-9 shrink-0 items-center rounded-r-md border border-l-0 px-3 font-mono text-xs">
          @{mailDomain}
        </span>
      </div>
      <p
        id={`${id}-state`}
        role="status"
        className={
          availability.state === "free"
            ? "flex items-center gap-1 text-xs text-[var(--tone-success-fg)]"
            : availability.state === "taken" || availability.state === "invalid"
              ? "text-destructive flex items-center gap-1 text-xs"
              : "text-muted-foreground flex items-center gap-1 text-xs"
        }
      >
        {availability.state === "checking" && (
          <>
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Checking…
          </>
        )}
        {availability.state === "free" && (
          <>
            <Check className="size-3" aria-hidden />
            {availability.address} is available
          </>
        )}
        {availability.state === "taken" && (
          <>
            <X className="size-3" aria-hidden />
            {TAKEN_REASON[availability.reason] ?? "Not available."}
          </>
        )}
        {availability.state === "invalid" && (
          <>
            <X className="size-3" aria-hidden />
            {TAKEN_REASON.invalid}
          </>
        )}
      </p>
    </div>
  );
}
