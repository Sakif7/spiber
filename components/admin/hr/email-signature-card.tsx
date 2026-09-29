"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DetailCard } from "@/components/admin/ui/detail";
import {
  EditorForm,
  FormSection,
  SaveBar,
} from "@/components/admin/ui/form-shell";
import {
  FormPanelButton,
  useAfterSave,
} from "@/components/admin/ui/form-panel";
import { ConfirmDialog } from "@/components/admin/company/file-manager/dialogs";
import { MailEditor, MailRteStyles } from "@/components/admin/mail/mail-editor";
import { formatApiError } from "@/lib/http/form-error";
import {
  SIGNATURE_LOGO_ALT,
  SIGNATURE_LOGO_HEIGHT,
  SIGNATURE_LOGO_SRC,
  SIGNATURE_LOGO_WIDTH,
  signatureBlockHtml,
} from "@/lib/mail/signature";

type Current = { html: string; logo: boolean; updatedAt: string | null };

/**
 * The employee's email signature: what goes under a message from their
 * mailbox, and one of the signatures offered on info@ and the other shared
 * mailboxes. Shown as it will look; edited in the side panel.
 */
export function EmailSignatureCard({
  endpoint,
  initial,
  fromRecord,
}: {
  /** PUT/DELETE the signature here. */
  endpoint: string;
  initial: Current | null;
  /** A starting point built from the record: name, role, contact, office. */
  fromRecord: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [askRemove, setAskRemove] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(formatApiError(json, "Could not remove the signature."));
        return;
      }
      setAskRemove(false);
      toast.success("Email signature removed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const when = initial?.updatedAt
    ? new Date(initial.updatedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <DetailCard
      title="Email signature"
      description="Goes under messages from their mailbox, and is one of the signatures to pick on info@ and the other shared mailboxes."
    >
      <div className="space-y-3">
        {initial ? (
          <SignaturePreview html={initial.html} logo={initial.logo} />
        ) : (
          <div className="text-muted-foreground bg-muted/40 flex h-28 items-center justify-center rounded-md border border-dashed p-3 text-center text-xs">
            No email signature yet. Start from the record and adjust it.
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FormPanelButton
            label={initial ? "Edit" : "Set up"}
            title="Email signature"
            description="Under every message from their mailbox, and on the shared mailboxes' list to pick from."
            variant="outline"
            icon={false}
            width="max-w-[min(40rem,94vw)]"
          >
            <EmailSignatureForm
              endpoint={endpoint}
              initial={initial}
              fromRecord={fromRecord}
            />
          </FormPanelButton>
          {initial && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={busy}
              onClick={() => setAskRemove(true)}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Remove
            </Button>
          )}
        </div>
        {when && (
          <p className="text-muted-foreground text-xs">Last changed {when}.</p>
        )}
      </div>
      <ConfirmDialog
        open={askRemove}
        title="Remove their email signature?"
        body="Messages already sent keep the signature they went out with. New messages from their mailbox go without one until a new one is set."
        confirmLabel="Remove"
        destructive
        busy={busy}
        onCancel={() => setAskRemove(false)}
        onConfirm={() => void remove()}
      />
    </DetailCard>
  );
}

/** The signature as a message will carry it: the logo, then the text. */
function SignaturePreview({ html, logo }: { html: string; logo: boolean }) {
  return (
    <div className="bg-background overflow-hidden rounded-md border">
      <div
        className="mail-rte"
        // Stored already cut down to the composer's allowlist on the server.
        dangerouslySetInnerHTML={{ __html: signatureBlockHtml({ html, logo }) }}
      />
      <MailRteStyles />
    </div>
  );
}

function EmailSignatureForm({
  endpoint,
  initial,
  fromRecord,
}: {
  endpoint: string;
  initial: Current | null;
  fromRecord: string;
}) {
  const afterSave = useAfterSave();
  // The editor owns its content once created; "Start from the record"
  // replaces it by giving the editor a new starting point and a new key.
  const [start, setStart] = useState(initial?.html ?? fromRecord);
  const [round, setRound] = useState(0);
  const [html, setHtml] = useState(start);
  const [logo, setLogo] = useState(initial?.logo ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, logo }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "Could not save the signature."));
        return;
      }
      toast.success("Email signature saved.");
      afterSave(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorForm>
      <FormSection
        title="Signature"
        description="Name, role and how to reach them. Links work; keep it short."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setStart(fromRecord);
              setHtml(fromRecord);
              setRound((r) => r + 1);
            }}
          >
            Start from the record
          </Button>
        }
      >
        <Label className="flex items-center gap-2 font-normal">
          <Checkbox
            checked={logo}
            onCheckedChange={(c) => setLogo(c === true)}
          />
          Company logo above the signature
        </Label>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- the same file the message carries inline
          <img
            src={SIGNATURE_LOGO_SRC}
            alt={SIGNATURE_LOGO_ALT}
            width={SIGNATURE_LOGO_WIDTH}
            height={SIGNATURE_LOGO_HEIGHT}
            className="h-auto max-w-full"
          />
        )}
        <MailEditor
          key={round}
          initialHtml={start}
          onChange={(h) => setHtml(h)}
          placeholder="Name, role, phone…"
          minHeight="10rem"
        />
      </FormSection>
      <SaveBar
        onSave={save}
        saving={saving}
        error={error}
        saveLabel="Save signature"
      />
    </EditorForm>
  );
}
