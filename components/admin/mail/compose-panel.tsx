"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Paperclip, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FormPanel } from "@/components/admin/ui/form-panel";
import {
  EditorForm,
  FormField,
  FormSection,
  SaveBar,
} from "@/components/admin/ui/form-shell";
import { formatApiError } from "@/lib/http/form-error";
import { textToHtml } from "@/lib/mail/text-html";
import { MailEditor } from "./mail-editor";
import type { RenderedMessage } from "@/lib/services/mail.service";

/**
 * Compose / reply / reply-all / forward, as the mailbox that is open. Rich
 * text in (sent as HTML + a plain-text alternative the server derives); the
 * quoted original is pre-filled the way every mail client does it so
 * nothing is hidden.
 */
export type ComposeMode = "new" | "reply" | "replyAll" | "forward";

export type ComposeSeed = {
  mode: ComposeMode;
  folder: string;
  original: RenderedMessage | null;
};

const fmtAddr = (a: { name: string | null; address: string }) =>
  a.name ? `${a.name} <${a.address}>` : a.address;

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

function quote(text: string | null): string {
  return (text ?? "")
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Pre-fill for a reply / reply-all / forward; shared with the reader's quick reply. */
export function seedFields(seed: ComposeSeed, self: string) {
  const o = seed.original;
  const notMe = (a: { address: string }) => a.address.toLowerCase() !== self;
  if (!o || seed.mode === "new") {
    return { to: "", cc: "", subject: "", text: "", html: "" };
  }
  const subjectBase = o.subject.replace(/^\s*((re|fwd?|aw|wg)\s*:\s*)+/i, "");
  if (seed.mode === "forward") {
    const header = `---------- Forwarded message ----------\nFrom: ${o.from ? fmtAddr(o.from) : "—"}\nDate: ${when(o.date)}\nSubject: ${o.subject}\nTo: ${o.to.map(fmtAddr).join(", ")}`;
    return {
      to: "",
      cc: "",
      subject: `Fwd: ${subjectBase}`,
      text: `\n\n${header}\n\n${o.text ?? ""}`,
      html: `<p></p><p>${esc(header).replace(/\n/g, "<br>")}</p>${textToHtml(o.text ?? "")}`,
    };
  }
  const replyTarget = o.replyTo[0] ?? o.from;
  const to = [replyTarget].filter((a): a is NonNullable<typeof a> => !!a);
  const cc =
    seed.mode === "replyAll"
      ? [...o.to, ...o.cc]
          .filter(notMe)
          .filter((a) => a.address !== replyTarget?.address)
      : [];
  const attribution = `On ${when(o.date)}, ${o.from ? fmtAddr(o.from) : "someone"} wrote:`;
  return {
    to: to.map(fmtAddr).join(", "),
    cc: cc.map(fmtAddr).join(", "),
    subject: `Re: ${subjectBase}`,
    text: `\n\n${attribution}\n${quote(o.text)}`,
    html: `<p></p><p>${esc(attribution)}</p><blockquote>${textToHtml(o.text ?? "")}</blockquote>`,
  };
}

export function ComposePanel({
  address,
  seed,
  onClose,
  onSent,
}: {
  address: string;
  seed: ComposeSeed | null;
  onClose: () => void;
  onSent: () => void;
}) {
  return (
    <FormPanel
      open={seed !== null}
      onOpenChange={(o) => !o && onClose()}
      title={
        seed?.mode === "reply"
          ? "Reply"
          : seed?.mode === "replyAll"
            ? "Reply all"
            : seed?.mode === "forward"
              ? "Forward"
              : "New message"
      }
      description={`Sent as ${address}. Every send is recorded in the audit log.`}
      width="max-w-[min(44rem,94vw)]"
    >
      {seed && (
        <ComposeForm
          key={`${seed.mode}-${seed.original?.uid ?? "new"}`}
          address={address}
          seed={seed}
          onSent={onSent}
        />
      )}
    </FormPanel>
  );
}

function ComposeForm({
  address,
  seed,
  onSent,
}: {
  address: string;
  seed: ComposeSeed;
  onSent: () => void;
}) {
  const init = seedFields(seed, address.toLowerCase());
  const [to, setTo] = useState(init.to);
  const [cc, setCc] = useState(init.cc);
  const [bcc, setBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(Boolean(init.cc));
  const [subject, setSubject] = useState(init.subject);
  const [text, setText] = useState(init.text);
  const [html, setHtml] = useState(init.html);
  const [files, setFiles] = useState<File[]>([]);
  const forwardable =
    seed.mode === "forward" && seed.original
      ? seed.original.attachments.filter((a) => !a.inline)
      : [];
  const [forwardIdx, setForwardIdx] = useState<Set<number>>(
    () => new Set(forwardable.map((a) => a.index)),
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("to", to);
      fd.set("cc", cc);
      fd.set("bcc", bcc);
      fd.set("subject", subject);
      fd.set("text", text);
      fd.set("html", html);
      if (
        (seed.mode === "reply" || seed.mode === "replyAll") &&
        seed.original
      ) {
        fd.set("replyFolder", seed.folder);
        fd.set("replyUid", String(seed.original.uid));
      }
      if (seed.mode === "forward" && seed.original) {
        fd.set("forwardFolder", seed.folder);
        fd.set("forwardUid", String(seed.original.uid));
        fd.set("forwardAttachments", [...forwardIdx].join(","));
      }
      for (const f of files) fd.append("files", f, f.name);
      const res = await fetch(
        `/api/admin/mail/${encodeURIComponent(address)}/send`,
        { method: "POST", body: fd },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = (json as { error?: { code?: string } } | null)?.error
          ?.code;
        setError(
          code === "transport_not_configured"
            ? "Sending is not configured on this deployment yet."
            : code === "transport_failed"
              ? "The mail server refused the message. Nothing was sent."
              : formatApiError(json, "Could not send."),
        );
        return;
      }
      const filed = (json as { data?: { filed?: boolean } })?.data?.filed;
      toast.success(
        filed ? "Sent." : "Sent — but the copy could not be filed in Sent.",
      );
      onSent();
    } finally {
      setSending(false);
    }
  }

  return (
    <EditorForm>
      <FormSection title="Recipients">
        <FormField label="To" required hint="Separate several with commas.">
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@example.com"
            autoFocus={seed.mode !== "reply" && seed.mode !== "replyAll"}
          />
        </FormField>
        {showCcBcc ? (
          <>
            <FormField label="Cc">
              <Input value={cc} onChange={(e) => setCc(e.target.value)} />
            </FormField>
            <FormField label="Bcc">
              <Input value={bcc} onChange={(e) => setBcc(e.target.value)} />
            </FormField>
          </>
        ) : (
          <button
            type="button"
            className="text-primary self-start text-xs font-medium hover:underline"
            onClick={() => setShowCcBcc(true)}
          >
            Add Cc / Bcc
          </button>
        )}
        <FormField label="Subject">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={500}
          />
        </FormField>
      </FormSection>

      <FormSection title="Message">
        <FormField label="Body">
          <MailEditor
            initialHtml={init.html}
            onChange={(h, t) => {
              setHtml(h);
              setText(t);
            }}
            minHeight="16rem"
            autoFocus={seed.mode === "reply" || seed.mode === "replyAll"}
          />
        </FormField>
      </FormSection>

      <FormSection title="Attachments">
        {forwardable.length > 0 && (
          <div className="grid gap-2">
            <p className="text-muted-foreground text-xs">
              From the original message:
            </p>
            {forwardable.map((a) => (
              <Label
                key={a.index}
                className="flex items-center gap-2 font-normal"
              >
                <Checkbox
                  checked={forwardIdx.has(a.index)}
                  onCheckedChange={(c) =>
                    setForwardIdx((prev) => {
                      const next = new Set(prev);
                      if (c === true) next.add(a.index);
                      else next.delete(a.index);
                      return next;
                    })
                  }
                />
                <Paperclip
                  className="text-muted-foreground size-3.5"
                  aria-hidden
                />
                <span className="truncate">{a.filename}</span>
              </Label>
            ))}
          </div>
        )}
        <FormField label="Add files" hint="Up to 10 files, 15 MB each.">
          <Input
            type="file"
            multiple
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles((prev) => [...prev, ...picked].slice(0, 10));
              e.target.value = "";
            }}
          />
        </FormField>
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="bg-muted flex items-center gap-2 rounded-md px-2.5 py-1 text-xs"
              >
                <Paperclip className="size-3" aria-hidden />
                <span className="max-w-[16rem] truncate">{f.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      <SaveBar
        saving={sending}
        onSave={send}
        saveLabel="Send"
        error={error ?? undefined}
        disabled={!to.trim() && !cc.trim() && !bcc.trim()}
      />
    </EditorForm>
  );
}
