"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  Ban,
  Check,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DetailCard, DetailRow } from "@/components/admin/ui/detail";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { Label } from "@/components/ui/label";
import { formatApiError } from "@/lib/http/form-error";
import { suggestLocalPart } from "@/lib/mail/address";
import {
  availabilityAllowsSave,
  BusinessEmailField,
  useBusinessEmailAvailability,
} from "./business-email-field";

/**
 * The card on an employee's page that owns their company address: the portal
 * login, the mailbox behind it, and the invite. Every button here posts one
 * action to `/access`; the server audits each one, and revealing a password
 * says so in the person's activity.
 */
export type AccessCardProps = {
  employeeId: string;
  /** For suggesting a local part on a record that has no address yet. */
  employeeName: string;
  mailDomain: string;
  businessEmail: string | null;
  personalEmail: string | null;
  login: { disabled: boolean } | null;
  invitedAt: string | null;
  inviteAcceptedAt: string | null;
  mailbox: {
    status: "pending" | "active" | "disabled" | "failed";
    quotaBytes: number | null;
    provider: string | null;
    provisionedAt: string | null;
    lastError: string | null;
  } | null;
  client: {
    imapHost: string;
    imapPort: number;
    smtpHost: string;
    smtpPort: number;
  };
  activity: { at: string; action: string; note: string | null }[];
};

type Action =
  | "assign_address"
  | "provision"
  | "resend_invite"
  | "disable_login"
  | "enable_login"
  | "reveal_mailbox_password"
  | "reset_mailbox_password"
  | "disable_mailbox"
  | "enable_mailbox";

const ACTIVITY_LABEL: Record<string, string> = {
  "address.assigned": "Business email assigned",
  "mailbox.provisioned": "Mailbox created",
  "mailbox.failed": "Mailbox could not be created",
  "login.created": "Portal login created",
  "login.linked": "Linked to an existing login",
  "invite.sent": "Invite sent",
  "invite.accepted": "Invite accepted — password set",
  "login.disabled": "Portal login disabled",
  "login.enabled": "Portal login enabled",
  "mailbox.password_revealed": "Mailbox password revealed",
  "mailbox.password_reset": "Mailbox password reset",
  "mailbox.disabled": "Mailbox login disabled",
  "mailbox.enabled": "Mailbox login enabled",
};

const quotaLabel = (bytes: number | null) =>
  bytes ? `${Math.round(bytes / 1024 ** 3)} GB` : "unlimited";

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
/** Shorter, for the activity column: "13 Sep 17:01". */
const whenShort = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function EmployeeAccessCard(p: AccessCardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [secret, setSecret] = useState<{
    title: string;
    description: string;
    value: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  // Only for a record from before unified mail: the address it will get.
  const [local, setLocal] = useState(() => suggestLocalPart(p.employeeName));
  const { availability, check } = useBusinessEmailAvailability();
  // Check the suggested local part once; the state lands from the fetch, not
  // synchronously in the effect.
  useEffect(() => {
    if (!p.businessEmail && local) check(local);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  async function run(action: Action) {
    setBusy(action);
    try {
      const res = await fetch(
        `/api/admin/company/hr/employees/${p.employeeId}/access`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "assign_address" ? { action, local } : { action },
          ),
        },
      );
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: Record<string, unknown>;
        error?: { code?: string; message?: string };
      } | null;
      if (!res.ok || !json?.ok) {
        toast.error(formatApiError(json, "That did not work."));
        return;
      }
      const d = json.data ?? {};
      switch (action) {
        case "assign_address":
        case "provision":
          toast.success(
            d.inviteLink
              ? d.inviteEmailed
                ? "Mailbox and login created; invite emailed."
                : "Mailbox and login created. Copy the invite link."
              : "Mailbox and login are in place.",
          );
          if (d.inviteLink && !d.inviteEmailed) {
            setSecret({
              title: "Invite link",
              description:
                "No personal email on file, so nothing was sent. Pass this link on yourself; it works for 24 hours, once.",
              value: String(d.inviteLink),
            });
          }
          break;
        case "resend_invite":
          toast.success(
            d.emailed
              ? "A new invite has been emailed."
              : "New invite link ready to copy.",
          );
          setSecret({
            title: "Invite link",
            description: d.emailed
              ? "Also emailed to the personal address. Works for 24 hours, once; older links no longer work."
              : "No personal email on file, so nothing was sent. Pass this link on yourself; it works for 24 hours, once.",
            value: String(d.link),
          });
          break;
        case "reveal_mailbox_password":
        case "reset_mailbox_password":
          setSecret({
            title:
              action === "reset_mailbox_password"
                ? "New mailbox password"
                : "Mailbox password",
            description: `For a phone or desktop mail app: ${String(d.address)} · IMAP ${p.client.imapHost}:${p.client.imapPort} (SSL) · SMTP ${p.client.smtpHost}:${p.client.smtpPort} (SSL). This reveal is recorded.`,
            value: String(d.password),
          });
          break;
        case "disable_login":
          toast.success("Portal login disabled — signed out everywhere.");
          break;
        case "enable_login":
          toast.success("Portal login enabled.");
          break;
        case "disable_mailbox":
          toast.success("Mailbox login disabled on the mail server.");
          break;
        case "enable_mailbox":
          toast.success(
            "Mailbox login enabled; reveal the new password to set up a phone.",
          );
          break;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy — select the text and copy it.");
    }
  }

  const hasLogin = p.login !== null;
  const box = p.mailbox;
  const boxTone =
    box?.status === "active"
      ? "success"
      : box?.status === "failed"
        ? "danger"
        : box?.status === "disabled"
          ? "neutral"
          : "warning";
  const needsProvision =
    !!p.businessEmail &&
    (!hasLogin || !box || box.status === "failed" || box.status === "pending");

  const btn = (
    action: Action,
    label: string,
    Icon: typeof Send,
    opts: { variant?: "outline" | "destructive" | "default" } = {},
  ) => (
    <Button
      key={action}
      type="button"
      size="sm"
      variant={opts.variant ?? "outline"}
      disabled={busy !== null}
      onClick={() => run(action)}
    >
      {busy === action ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Icon className="size-3.5" aria-hidden />
      )}
      {label}
    </Button>
  );

  return (
    <>
      <DetailCard
        title="Login & mailbox"
        description="One company address: the portal login and the mailbox behind it."
        action={
          p.businessEmail ? (
            <StatusBadge tone="brand">Unified</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">No address</StatusBadge>
          )
        }
        bodyClassName="grid gap-4"
      >
        {!p.businessEmail ? (
          <div className="grid gap-3">
            <p className="text-muted-foreground">
              This record predates unified mail. Give the person their company
              address: the mailbox, the portal login and the invite are created
              with it, exactly as for a new employee.
            </p>
            <div className="grid gap-1.5">
              <Label htmlFor="assign-business-email">Business email</Label>
              <BusinessEmailField
                id="assign-business-email"
                value={local}
                onChange={(v) => {
                  setLocal(v);
                  check(v);
                }}
                availability={availability}
                mailDomain={p.mailDomain}
              />
            </div>
            <div>
              <Button
                type="button"
                size="sm"
                disabled={
                  busy !== null || !availabilityAllowsSave(availability, local)
                }
                onClick={() => run("assign_address")}
              >
                {busy === "assign_address" ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="size-3.5" aria-hidden />
                )}
                Assign address & create mailbox
              </Button>
            </div>
            {p.activity.length > 0 && (
              <p className="text-muted-foreground text-xs">
                {p.activity.length} earlier event
                {p.activity.length === 1 ? "" : "s"} on this record.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-2">
              <DetailRow label="Business email" mono>
                {p.businessEmail}
              </DetailRow>
              <DetailRow label="Personal email">
                {p.personalEmail ?? (
                  <span className="text-muted-foreground font-normal">
                    none — invites must be copied
                  </span>
                )}
              </DetailRow>
            </div>

            <div className="border-border grid gap-2 border-t pt-3">
              <DetailRow label="Portal login">
                {hasLogin ? (
                  <StatusBadge tone={p.login!.disabled ? "danger" : "success"}>
                    {p.login!.disabled ? "Disabled" : "Active"}
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="warning">Not created</StatusBadge>
                )}
              </DetailRow>
              <DetailRow label="Role">
                <span>
                  Employee{" "}
                  <span className="text-muted-foreground font-normal">
                    · own leads, orders, visits, claims and payslip
                  </span>
                </span>
              </DetailRow>
              <DetailRow label="Invite">
                {p.inviteAcceptedAt ? (
                  <span className="font-normal">
                    accepted {when(p.inviteAcceptedAt)}
                  </span>
                ) : p.invitedAt ? (
                  <span className="text-muted-foreground font-normal">
                    sent {when(p.invitedAt)} · not used yet
                  </span>
                ) : (
                  <span className="text-muted-foreground font-normal">
                    not sent
                  </span>
                )}
              </DetailRow>
              <div className="flex flex-wrap gap-2 pt-1">
                {hasLogin &&
                  btn(
                    "resend_invite",
                    p.invitedAt ? "Resend invite" : "Send invite",
                    Send,
                  )}
                {hasLogin &&
                  (p.login!.disabled
                    ? btn("enable_login", "Enable login", Check)
                    : btn("disable_login", "Disable login", Ban, {
                        variant: "destructive",
                      }))}
              </div>
            </div>

            <div className="border-border grid gap-2 border-t pt-3">
              <DetailRow label="Mailbox">
                {box ? (
                  <span className="inline-flex items-center gap-2">
                    <StatusBadge tone={boxTone}>
                      {box.status === "active"
                        ? "Active"
                        : box.status === "failed"
                          ? "Failed"
                          : box.status === "disabled"
                            ? "Login disabled"
                            : "Pending"}
                    </StatusBadge>
                    <span className="text-muted-foreground font-mono text-xs">
                      {quotaLabel(box.quotaBytes)}
                    </span>
                  </span>
                ) : (
                  <StatusBadge tone="warning">Not created</StatusBadge>
                )}
              </DetailRow>
              {box?.provisionedAt && (
                <DetailRow label="Created">
                  <span className="font-normal">
                    {when(box.provisionedAt)}
                    {box.provider === "memory" && (
                      <span className="text-muted-foreground">
                        {" "}
                        · simulated (no mail server on this deployment)
                      </span>
                    )}
                  </span>
                </DetailRow>
              )}
              {box?.status === "failed" && box.lastError && (
                <p className="text-destructive text-xs">{box.lastError}</p>
              )}
              <DetailRow label="Phone / desktop">
                <span className="font-mono text-xs font-normal">
                  IMAP {p.client.imapHost}:{p.client.imapPort} · SMTP{" "}
                  {p.client.smtpHost}:{p.client.smtpPort}
                </span>
              </DetailRow>
              <div className="flex flex-wrap gap-2 pt-1">
                {needsProvision &&
                  btn(
                    "provision",
                    box?.status === "failed"
                      ? "Retry"
                      : "Create mailbox & login",
                    RefreshCw,
                    { variant: "default" },
                  )}
                {box?.status === "active" &&
                  btn("reveal_mailbox_password", "Reveal password", KeyRound)}
                {box?.status === "active" &&
                  btn("reset_mailbox_password", "Reset password", RefreshCw)}
                {box?.status === "active" &&
                  btn("disable_mailbox", "Disable mailbox login", Ban)}
                {box?.status === "disabled" &&
                  btn("enable_mailbox", "Enable mailbox login", Check)}
              </div>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
                Revealing or resetting a password is recorded with your name and
                the time.
              </p>
            </div>

            {p.activity.length > 0 && (
              <div className="border-border grid gap-1.5 border-t pt-3">
                <h3 className="text-muted-foreground text-xs font-medium">
                  Activity
                </h3>
                <ul className="grid gap-1 text-xs">
                  {p.activity
                    .slice(-8)
                    .reverse()
                    .map((e, i) => (
                      <li
                        key={`${e.at}-${i}`}
                        className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2"
                      >
                        <span className="text-muted-foreground font-mono whitespace-nowrap">
                          {whenShort(e.at)}
                        </span>
                        <span className="min-w-0 break-words">
                          {ACTIVITY_LABEL[e.action] ?? e.action}
                          {e.note && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {e.note}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </>
        )}
      </DetailCard>

      <Dialog
        open={secret !== null}
        onOpenChange={(o) => !o && setSecret(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{secret?.title}</DialogTitle>
            <DialogDescription>{secret?.description}</DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-md border px-3 py-2 font-mono text-sm break-all select-all">
            {secret?.value}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={copy}>
              {copied ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button type="button" onClick={() => setSecret(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
