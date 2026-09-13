"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Loader2, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import {
  FormPanel,
  FormPanelButton,
  useAfterSave,
} from "@/components/admin/ui/form-panel";
import {
  EditorForm,
  FormField,
  FormSection,
  SaveBar,
} from "@/components/admin/ui/form-shell";
import { formatApiError } from "@/lib/http/form-error";
import { normaliseLocalPart } from "@/lib/mail/address";
import type { StaffUser } from "@/lib/services/mail-admin.service";

/**
 * Company → Shared mailboxes. Every mailbox row is listed (personal ones
 * read-only, they belong to their employee record); shared ones can be added
 * — the address must already exist on the mail server — and handed to staff.
 */
export type MailboxRow = {
  id: string;
  address: string;
  kind: "personal" | "shared";
  status: "pending" | "active" | "disabled" | "failed";
  ownerUserId: string | null;
  assignedUserIds: string[];
};

export function SharedMailboxesManager({
  rows,
  staff,
}: {
  rows: MailboxRow[];
  staff: StaffUser[];
}) {
  const router = useRouter();
  const byId = new Map(staff.map((u) => [u.id, u]));
  const [assigning, setAssigning] = useState<MailboxRow | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function remove(row: MailboxRow) {
    if (
      !window.confirm(
        `Stop opening ${row.address} here? The mailbox itself stays on the server.`,
      )
    )
      return;
    setRemoving(row.id);
    try {
      const res = await fetch(`/api/admin/company/mail/mailboxes/${row.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("failed");
      toast.success(`${row.address} removed from the admin.`);
      router.refresh();
    } catch {
      toast.error("Could not remove the mailbox.");
    } finally {
      setRemoving(null);
    }
  }

  const columns: Column<MailboxRow>[] = [
    {
      key: "address",
      header: "Address",
      cell: (r) => <span className="font-mono text-xs">{r.address}</span>,
    },
    {
      key: "kind",
      header: "Kind",
      mobile: "meta",
      cell: (r) => (
        <StatusBadge tone={r.kind === "shared" ? "brand" : "neutral"}>
          {r.kind === "shared" ? "Shared" : "Personal"}
        </StatusBadge>
      ),
    },
    {
      key: "who",
      header: "Who opens it",
      cell: (r) =>
        r.kind === "personal" ? (
          <span className="text-muted-foreground">
            {r.ownerUserId
              ? (byId.get(r.ownerUserId)?.name ?? "its employee")
              : "no login yet"}
          </span>
        ) : r.assignedUserIds.length === 0 ? (
          <span className="text-muted-foreground">Super admins only</span>
        ) : (
          <span>
            {r.assignedUserIds
              .map((id) => byId.get(id)?.name ?? "unknown")
              .join(", ")}
          </span>
        ),
    },
    {
      key: "status",
      header: "Status",
      mobile: "meta",
      cell: (r) => (
        <StatusBadge
          tone={
            r.status === "active"
              ? "success"
              : r.status === "failed"
                ? "danger"
                : r.status === "disabled"
                  ? "neutral"
                  : "warning"
          }
        >
          {r.status === "active"
            ? "Active"
            : r.status === "disabled"
              ? "Login disabled"
              : r.status === "failed"
                ? "Failed"
                : "Pending"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (r) =>
        r.kind === "shared" ? (
          <span className="inline-flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAssigning(r)}
            >
              <Users className="size-3.5" aria-hidden />
              Assign
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Remove ${r.address}`}
              disabled={removing === r.id}
              onClick={() => remove(r)}
            >
              {removing === r.id ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="No mailboxes recorded yet — add the shared ones (info@, sales@) here; personal ones appear as employees are added."
        minWidth={640}
      />
      <FormPanel
        open={assigning !== null}
        onOpenChange={(o) => !o && setAssigning(null)}
        title={assigning ? `Who opens ${assigning.address}` : "Assign"}
        description="Super admins can always open it; tick everyone else who should."
        width="max-w-[min(32rem,94vw)]"
      >
        {assigning && (
          <AssignForm
            key={assigning.id}
            row={assigning}
            staff={staff}
            onDone={() => setAssigning(null)}
          />
        )}
      </FormPanel>
    </>
  );
}

function AssignForm({
  row,
  staff,
  onDone,
}: {
  row: MailboxRow;
  staff: StaffUser[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(
    new Set(row.assignedUserIds),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/company/mail/mailboxes/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedUserIds: [...picked] }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "Could not save."));
        return;
      }
      toast.success("Assignment saved.");
      onDone();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorForm>
      <FormSection title="People">
        <div className="grid gap-2">
          {staff.length === 0 && (
            <p className="text-muted-foreground">No staff logins yet.</p>
          )}
          {staff.map((u) => (
            <Label
              key={u.id}
              className="flex items-center gap-3 rounded-md border px-3 py-2 font-normal"
            >
              <Checkbox
                checked={picked.has(u.id)}
                onCheckedChange={(c) =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (c === true) next.add(u.id);
                    else next.delete(u.id);
                    return next;
                  })
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{u.name}</span>
                <span className="text-muted-foreground block truncate font-mono text-xs">
                  {u.email}
                </span>
              </span>
              <span className="text-muted-foreground text-xs">
                {u.roles.includes("super_admin")
                  ? "super admin"
                  : u.roles.includes("admin")
                    ? "admin"
                    : "employee"}
              </span>
            </Label>
          ))}
        </div>
      </FormSection>
      <SaveBar
        saving={saving}
        onSave={save}
        saveLabel="Save assignment"
        error={error ?? undefined}
      />
    </EditorForm>
  );
}

/** "Add shared mailbox" — lives in the page header. */
export function AddSharedMailboxButton({ mailDomain }: { mailDomain: string }) {
  return (
    <FormPanelButton
      label="Add shared mailbox"
      title="Add shared mailbox"
      description="An address that already exists on the mail server and that several people should open here."
      width="max-w-[min(32rem,94vw)]"
    >
      <AddSharedMailboxForm mailDomain={mailDomain} />
    </FormPanelButton>
  );
}

function AddSharedMailboxForm({ mailDomain }: { mailDomain: string }) {
  const afterSave = useAfterSave();
  const [local, setLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/company/mail/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ local }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = (json as { error?: { code?: string } } | null)?.error
          ?.code;
        setError(
          code === "not_on_server"
            ? `${local}@${mailDomain} does not exist on the mail server. Create the account there first (or as an employee's business email).`
            : code === "exists"
              ? "That mailbox is already recorded."
              : code === "provisioner_not_configured"
                ? "The mail server connection is not configured on this deployment."
                : formatApiError(json, "Could not add the mailbox."),
        );
        return;
      }
      toast.success(`${local}@${mailDomain} added. Assign people to it next.`);
      afterSave("/admin/company/mail");
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorForm>
      <FormSection title="Address">
        <FormField
          label="Shared address"
          required
          htmlFor="shared-mailbox-local"
          hint="Must already exist on the mail server. The app opens it with its master login; no password is stored."
        >
          <div className="flex min-w-0">
            <Input
              id="shared-mailbox-local"
              className="min-w-0 rounded-r-none font-mono"
              value={local}
              onChange={(e) => setLocal(normaliseLocalPart(e.target.value))}
              maxLength={64}
              autoCapitalize="off"
              spellCheck={false}
              placeholder="info"
            />
            <span className="border-input bg-muted text-muted-foreground flex h-9 shrink-0 items-center rounded-r-md border border-l-0 px-3 font-mono text-xs">
              @{mailDomain}
            </span>
          </div>
        </FormField>
      </FormSection>
      <SaveBar
        saving={saving}
        onSave={save}
        saveLabel="Add mailbox"
        error={error ?? undefined}
        disabled={!local}
      />
    </EditorForm>
  );
}
