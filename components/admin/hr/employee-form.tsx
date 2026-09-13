"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAfterSave, useFormPanel } from "@/components/admin/ui/form-panel";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { suggestLocalPart } from "@/lib/mail/address";
import {
  availabilityAllowsSave,
  BusinessEmailField,
  useBusinessEmailAvailability,
} from "./business-email-field";
import {
  EditorForm,
  FormSection,
  FormGrid,
  FormField,
  SaveBar,
} from "@/components/admin/ui/form-shell";
import { SelectField } from "@/components/admin/ui/select-field";
import { formatApiError } from "@/lib/http/form-error";

export type EmployeeFormValues = {
  id?: string;
  name: string;
  designation: string;
  kind: "director" | "staff";
  payScheme: "revenue_share" | "fixed" | "none";
  email: string;
  phone: string;
  joinedAt: string;
  leftAt: string;
  status: "active" | "inactive";
  notes: string;
  bankName: string;
  branch: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  /** Only offered when creating; afterwards a holding is added to the history. */
  shares?: string;
  sharesFrom?: string;
  /** The local part of the company address — only while creating. */
  businessEmailLocal?: string;
  /** Read-only after creation (a mailbox is not renamed from a form). */
  businessEmail?: string;
  sendInvite?: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

const EMPTY: EmployeeFormValues = {
  name: "",
  designation: "",
  kind: "director",
  payScheme: "revenue_share",
  email: "",
  phone: "",
  joinedAt: today(),
  leftAt: "",
  status: "active",
  notes: "",
  bankName: "",
  branch: "",
  accountName: "",
  accountNumber: "",
  routingNumber: "",
  shares: "",
  sharesFrom: thisMonth(),
  businessEmailLocal: "",
  sendInvite: true,
} as EmployeeFormValues;

export function EmployeeForm({
  employee,
  mailDomain = "spibermed.com",
}: {
  employee?: EmployeeFormValues;
  /** The fixed domain every business address is on. */
  mailDomain?: string;
}) {
  const afterSave = useAfterSave();
  const panel = useFormPanel();
  const router = useRouter();
  const [v, setV] = useState<EmployeeFormValues>(employee ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { availability, check: checkAvailability } =
    useBusinessEmailAvailability();
  // Set once the person types into the address field themselves; until then
  // the local part follows the name.
  const [localTouched, setLocalTouched] = useState(false);
  const isNew = !employee?.id;

  const set = <K extends keyof EmployeeFormValues>(
    k: K,
    value: EmployeeFormValues[K],
  ) => setV((prev) => ({ ...prev, [k]: value }));

  function setLocal(local: string, touched: boolean) {
    setV((prev) => ({ ...prev, businessEmailLocal: local }));
    if (touched) setLocalTouched(true);
    checkAvailability(local);
  }

  function setName(name: string) {
    set("name", name);
    if (isNew && !localTouched) setLocal(suggestLocalPart(name), false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: v.name,
        designation: v.designation,
        kind: v.kind,
        payScheme: v.payScheme,
        email: v.email,
        phone: v.phone,
        joinedAt: new Date(v.joinedAt).toISOString(),
        leftAt: v.leftAt ? new Date(v.leftAt).toISOString() : null,
        status: v.status,
        notes: v.notes,
        bankDetails: {
          bankName: v.bankName,
          branch: v.branch,
          accountName: v.accountName,
          accountNumber: v.accountNumber,
          routingNumber: v.routingNumber,
        },
      };
      if (isNew && v.shares && Number(v.shares) > 0) {
        payload.shares = Math.round(Number(v.shares));
        payload.sharesFrom = v.sharesFrom;
      }
      if (isNew) {
        payload.businessEmailLocal = v.businessEmailLocal;
        payload.sendInvite = v.sendInvite ?? true;
      }

      const res = await fetch(
        employee?.id
          ? `/api/admin/company/hr/employees/${employee.id}`
          : "/api/admin/company/hr/employees",
        {
          method: employee?.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = (json as { error?: { code?: string } } | null)?.error
          ?.code;
        setError(
          code === "pool_exceeded"
            ? "That is more shares than the pool has left. Nothing was saved — raise the pool on the employees page, or allocate fewer."
            : code === "no_pool"
              ? "No share pool has been set yet. Nothing was saved — set it on the employees page first, or leave the shares empty and allocate later."
              : code === "address_taken"
                ? "That business email is already taken. Nothing was saved — choose another."
                : code === "invalid_address"
                  ? "The business email may only contain letters, digits, dots and dashes."
                  : code === "vault_not_configured"
                    ? "The company vault key is not configured, so a mailbox password cannot be stored. Nothing was saved."
                    : code === "provisioner_not_configured"
                      ? "The mail server connection is not configured on this deployment. Nothing was saved."
                      : formatApiError(json, "Could not save the employee."),
        );
        return;
      }
      if (employee?.id) {
        toast.success("Employee updated.");
        afterSave(`/admin/company/people/employees/${employee.id}`);
        return;
      }
      // Creating: the mailbox and login are part of the same save. Say what
      // happened to them, then open the record — its "Login & mailbox" card
      // carries the retry and the invite link.
      const created = (
        json as {
          data?: {
            id: string;
            access:
              | {
                  ok: true;
                  inviteEmailed: boolean;
                  inviteLink: string | null;
                  linkedExistingLogin: boolean;
                }
              | { ok: false; code: string };
          };
        } | null
      )?.data;
      if (created?.access.ok) {
        const a = created.access;
        toast.success(
          a.linkedExistingLogin
            ? "Employee added and mailbox created; linked to their existing login."
            : a.inviteEmailed
              ? "Employee added; mailbox created and invite emailed."
              : a.inviteLink
                ? "Employee added; mailbox created. No personal email — copy the invite link from the record."
                : "Employee added and mailbox created.",
        );
      } else {
        toast.error(
          "Employee added, but the mailbox could not be created. Retry from the record.",
        );
      }
      panel?.close();
      router.push(`/admin/company/people/employees/${created?.id ?? ""}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorForm>
      <FormSection title="Person">
        <FormGrid cols={2}>
          <FormField label="Name" required>
            <Input
              value={v.name}
              onChange={(e) => setName(e.target.value)}
              maxLength={160}
            />
          </FormField>
          <FormField label="Designation" required>
            <Input
              value={v.designation}
              onChange={(e) => set("designation", e.target.value)}
              maxLength={160}
              placeholder="Managing Director"
            />
          </FormField>
          <FormField
            label="Personal email"
            hint="Their own address. The invite to set a portal password goes here — it is never used for company mail."
          >
            <Input
              type="email"
              value={v.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </FormField>
          <FormField label="Phone">
            <Input
              value={v.phone}
              onChange={(e) => set("phone", e.target.value)}
              maxLength={40}
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection
        title="Login & mailbox"
        description={
          isNew
            ? "One company address: the portal login and the mailbox behind it, created when you save."
            : "The company address is the portal login and the mailbox. It is managed from the card on the employee's page."
        }
      >
        {isNew ? (
          <FormGrid cols={2}>
            <FormField
              label="Business email"
              required
              htmlFor="employee-business-email"
              hint={
                availability.state === "free"
                  ? undefined
                  : "Suggested from the name. Letters, digits, dots and dashes."
              }
            >
              <BusinessEmailField
                id="employee-business-email"
                value={v.businessEmailLocal ?? ""}
                onChange={(local) => setLocal(local, true)}
                availability={availability}
                mailDomain={mailDomain}
              />
            </FormField>
            <FormField label="Portal access">
              <div className="flex min-h-9 items-center">
                <Label className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={v.sendInvite ?? true}
                    onCheckedChange={(c) => set("sendInvite", c === true)}
                  />
                  Email the set-password invite now
                </Label>
              </div>
            </FormField>
          </FormGrid>
        ) : (
          <FormGrid cols={2}>
            <FormField label="Business email">
              <Input
                value={v.businessEmail || "—"}
                readOnly
                className="font-mono"
              />
            </FormField>
          </FormGrid>
        )}
      </FormSection>

      <FormSection title="Employment">
        <FormGrid cols={3}>
          <FormField label="Role">
            <SelectField
              value={v.kind}
              onChange={(x) => set("kind", x as EmployeeFormValues["kind"])}
              options={[
                { value: "director", label: "Director" },
                { value: "staff", label: "Staff" },
              ]}
            />
          </FormField>
          <FormField
            label="Paid by"
            hint="A shareholder's month is their share of the profit after salaries."
          >
            <SelectField
              value={v.payScheme}
              onChange={(x) =>
                set("payScheme", x as EmployeeFormValues["payScheme"])
              }
              options={[
                { value: "revenue_share", label: "Shareholder" },
                { value: "fixed", label: "Fixed monthly" },
                { value: "none", label: "Not paid through payroll" },
              ]}
            />
          </FormField>
          <FormField label="Status">
            <SelectField
              value={v.status}
              onChange={(x) => set("status", x as EmployeeFormValues["status"])}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
          </FormField>
          <FormField label="Joined" required>
            <Input
              type="date"
              value={v.joinedAt}
              onChange={(e) => set("joinedAt", e.target.value)}
            />
          </FormField>
          <FormField label="Left" hint="Leave empty while they are still here.">
            <Input
              type="date"
              value={v.leftAt}
              onChange={(e) => set("leftAt", e.target.value)}
            />
          </FormField>
        </FormGrid>

        {isNew && v.payScheme === "revenue_share" && (
          <FormGrid cols={2}>
            <FormField
              label="Shares held"
              hint="From the company's share pool. Can be changed later; past months keep the holding they were paid on."
            >
              <Input
                value={v.shares ?? ""}
                onChange={(e) => set("shares", e.target.value)}
                inputMode="numeric"
                placeholder="2000"
              />
            </FormField>
            <FormField
              label="From month"
              hint="The first payroll month they are paid for — not before they joined."
            >
              <Input
                type="month"
                value={v.sharesFrom ?? thisMonth()}
                onChange={(e) => set("sharesFrom", e.target.value)}
              />
            </FormField>
          </FormGrid>
        )}
      </FormSection>

      <FormSection
        title="Bank details"
        description="Where payroll is transferred."
      >
        <FormGrid cols={2}>
          <FormField label="Bank">
            <Input
              value={v.bankName}
              onChange={(e) => set("bankName", e.target.value)}
              maxLength={120}
            />
          </FormField>
          <FormField label="Branch">
            <Input
              value={v.branch}
              onChange={(e) => set("branch", e.target.value)}
              maxLength={120}
            />
          </FormField>
          <FormField label="Account name">
            <Input
              value={v.accountName}
              onChange={(e) => set("accountName", e.target.value)}
              maxLength={160}
            />
          </FormField>
          <FormField label="Account number">
            <Input
              value={v.accountNumber}
              onChange={(e) => set("accountNumber", e.target.value)}
              maxLength={60}
            />
          </FormField>
          <FormField label="Routing number">
            <Input
              value={v.routingNumber}
              onChange={(e) => set("routingNumber", e.target.value)}
              maxLength={60}
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Notes">
        <FormField label="Notes">
          <Textarea
            value={v.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </FormField>
      </FormSection>

      <SaveBar
        saving={saving}
        onSave={save}
        saveLabel={employee?.id ? "Save changes" : "Add employee"}
        error={error ?? undefined}
        disabled={
          !v.name.trim() ||
          !v.designation.trim() ||
          !v.joinedAt ||
          (isNew &&
            !availabilityAllowsSave(availability, v.businessEmailLocal ?? ""))
        }
      />
    </EditorForm>
  );
}
