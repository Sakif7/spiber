"use client";

import { useQuery } from "@tanstack/react-query";
import type { SignatureChoices } from "@/lib/mail/signature";
import { enc, mailApi } from "./mail-shared";

/**
 * The signatures a mailbox's composer offers, fetched once per mailbox and
 * shared by the full composer and the quick reply.
 */
export const signaturesKey = (address: string) =>
  ["mail", address, "signatures"] as const;

export function useSignatureChoices(address: string) {
  return useQuery({
    queryKey: signaturesKey(address),
    queryFn: () =>
      mailApi<SignatureChoices>(`/api/admin/mail/${enc(address)}/signatures`),
    // The query client lives across pages, and a signature edited on the
    // employee page must not come back stale in the composer: re-read on
    // every mount (it is a few hundred bytes), showing the last copy
    // meanwhile.
    staleTime: 0,
  });
}

/**
 * The last signature picked on this mailbox, per browser — a convenience,
 * so whoever writes from info@ is not asked again every time. Storage can
 * be missing (a private window); the mailbox's own default is used then.
 */
const storageKey = (address: string) =>
  `spiber.mail.signature:${address.toLowerCase()}`;

/** Which signature to start on; "" means none. */
export function startingSignature(
  address: string,
  choices: SignatureChoices,
): string {
  let remembered: string | null = null;
  try {
    remembered = localStorage.getItem(storageKey(address));
  } catch {
    // no storage — fall through to the default
  }
  if (remembered === "none") return "";
  if (remembered && choices.options.some((o) => o.id === remembered)) {
    return remembered;
  }
  return choices.defaultId ?? "";
}

export function rememberSignature(address: string, id: string): void {
  try {
    localStorage.setItem(storageKey(address), id || "none");
  } catch {
    // not remembered; nothing else depends on it
  }
}

export function signatureHtmlFor(
  choices: SignatureChoices | undefined,
  id: string,
): string | null {
  return choices?.options.find((o) => o.id === id)?.html ?? null;
}

/** The picker's options: each person, with their designation when known. */
export function signatureOptions(choices: SignatureChoices) {
  return choices.options.map((o) => ({
    value: o.id,
    label: o.designation ? `${o.name} — ${o.designation}` : o.name,
  }));
}
