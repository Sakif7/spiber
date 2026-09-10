"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EditorForm,
  FormSection,
  FormGrid,
  FormField,
  SaveBar,
} from "@/components/admin/ui/form-shell";
import { SelectField } from "@/components/admin/ui/select-field";
import { TogglePill } from "@/components/admin/ui/segmented";
import { formatApiError } from "@/lib/http/form-error";
import { useAfterSave } from "@/components/admin/ui/form-panel";
import {
  suggestLeadCode,
  leadReasonEnum,
  LEAD_REASON_LABEL,
  type LeadReason,
} from "@/lib/schemas/sales-lead";
import { DISTRICT_OPTIONS } from "@/lib/bd/districts";

export type SourceEmployee = { id: string; name: string; designation: string };

/** Sentinel for "whoever brought this in does not work here". */
const OTHER = "__other";

export type LeadFormValues = {
  id?: string;
  organisation: string;
  code: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  area: string;
  sourceEmployeeId: string;
  sourceName: string;
  reasons: LeadReason[];
  reasonNote: string;
  addresseeTitle: string;
  addresseeDept: string;
  remark: string;
};

const EMPTY: LeadFormValues = {
  organisation: "",
  code: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  area: "",
  sourceEmployeeId: "",
  sourceName: "",
  reasons: [],
  reasonNote: "",
  addresseeTitle: "",
  addresseeDept: "",
  remark: "",
};

/**
 * Create or edit a lead.
 *
 * The client code is the one field with consequences beyond this form: it goes
 * into every invoice number for this organisation, so it is suggested from the
 * name and then left alone once saved.
 */
export function LeadForm({
  lead,
  employees = [],
}: {
  lead?: LeadFormValues;
  employees?: SourceEmployee[];
}) {
  const afterSave = useAfterSave();
  const [v, setV] = useState<LeadFormValues>(lead ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeTouched, setCodeTouched] = useState(Boolean(lead));
  /**
   * Which source is selected.
   *
   * Held rather than derived from `sourceEmployeeId`/`sourceName`: choosing
   * "Someone else" clears both of those, so a derived value would fall
   * straight back to "not set" and the name box would never open.
   */
  const [sourceChoice, setSourceChoice] = useState<string>(
    lead?.sourceEmployeeId
      ? lead.sourceEmployeeId
      : lead?.sourceName
        ? OTHER
        : "",
  );

  const set = <K extends keyof LeadFormValues>(
    k: K,
    value: LeadFormValues[K],
  ) => setV((prev) => ({ ...prev, [k]: value }));

  /**
   * One control for two cases.
   *
   * The referrer is normally one of ours, so the list leads; "Someone else"
   * reveals a name box for a consultant or an existing client who sent them.
   * An employee's name is copied across as well as their id, so a list of
   * leads renders the source without a lookup per row.
   */
  function onSource(choice: string) {
    setSourceChoice(choice);
    if (choice === OTHER) {
      setV((prev) => ({ ...prev, sourceEmployeeId: "", sourceName: "" }));
      return;
    }
    const picked = employees.find((e) => e.id === choice);
    setV((prev) => ({
      ...prev,
      sourceEmployeeId: picked?.id ?? "",
      sourceName: picked?.name ?? "",
    }));
  }

  const toggleReason = (r: LeadReason) =>
    setV((prev) => ({
      ...prev,
      reasons: prev.reasons.includes(r)
        ? prev.reasons.filter((x) => x !== r)
        : [...prev.reasons, r],
    }));

  function onOrganisation(value: string) {
    setV((prev) => ({
      ...prev,
      organisation: value,
      // Suggest a code until the admin types one of their own.
      code: codeTouched ? prev.code : suggestLeadCode(value),
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        lead?.id
          ? `/api/admin/company/sales/leads/${lead.id}`
          : "/api/admin/company/sales/leads",
        {
          method: lead?.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(v),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "Could not save the lead."));
        return;
      }
      toast.success(lead?.id ? "Lead updated." : "Lead created.");
      afterSave(
        `/admin/company/sales/leads/${lead?.id ?? json?.data?.id ?? ""}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorForm>
      <FormSection title="Organisation">
        <FormGrid cols={2}>
          <FormField label="Organisation" required>
            <Input
              value={v.organisation}
              onChange={(e) => onOrganisation(e.target.value)}
              maxLength={160}
              placeholder="East West Medical College & Hospital"
            />
          </FormField>
          <FormField
            label="Client code"
            required
            hint="Appears in every invoice number for this client, e.g. SPIBER/EWMCH/…"
          >
            <Input
              value={v.code}
              onChange={(e) => {
                setCodeTouched(true);
                set("code", e.target.value.toUpperCase());
              }}
              maxLength={8}
              className="font-mono"
              placeholder="EWMCH"
            />
          </FormField>
        </FormGrid>
        <FormField label="Address" required>
          <Textarea
            value={v.address}
            onChange={(e) => set("address", e.target.value)}
            rows={2}
            maxLength={400}
            placeholder="Dhour, Nishatnagar, Turag, Dhaka-1230"
          />
        </FormField>
        <FormGrid cols={2}>
          <FormField
            label="Region"
            hint="What the sales board is grouped by. Start typing to jump."
          >
            <SelectField
              value={v.area}
              onChange={(value) => set("area", value)}
              options={DISTRICT_OPTIONS}
              emptyLabel="— not set —"
              placeholder="Choose a region"
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Contact">
        <FormGrid cols={3}>
          <FormField label="Contact person" required>
            <Input
              value={v.contactName}
              onChange={(e) => set("contactName", e.target.value)}
              maxLength={120}
            />
          </FormField>
          <FormField label="Phone" required>
            <Input
              value={v.phone}
              onChange={(e) => set("phone", e.target.value)}
              maxLength={40}
              placeholder="+880 1XXX XXXXXX"
            />
          </FormField>
          <FormField
            label="Email"
            hint="Where proposals and invoices are sent."
          >
            <Input
              type="email"
              value={v.email}
              onChange={(e) => set("email", e.target.value)}
              maxLength={200}
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection
        title="Where it came from"
        description="Who brought the lead in, and what they are asking for."
      >
        <FormGrid cols={2}>
          <FormField label="Lead source">
            <SelectField
              value={sourceChoice}
              onChange={onSource}
              options={[
                ...employees.map((e) => ({
                  value: e.id,
                  label: `${e.name} · ${e.designation}`,
                })),
                { value: OTHER, label: "Someone else…" },
              ]}
              emptyLabel="— not set —"
              placeholder="Who brought this in?"
            />
          </FormField>
          {sourceChoice === OTHER && (
            <FormField
              label="Their name"
              hint="A referring consultant, an existing client, an event."
            >
              <Input
                value={v.sourceName}
                onChange={(e) => set("sourceName", e.target.value)}
                maxLength={120}
                placeholder="Dr. Rahman, Popular Diagnostics"
              />
            </FormField>
          )}
        </FormGrid>

        <FormField label="Lead reason" hint="Pick every one that applies.">
          <div className="flex flex-wrap gap-1.5">
            {leadReasonEnum.options.map((r) => (
              <TogglePill
                key={r}
                active={v.reasons.includes(r)}
                onClick={() => toggleReason(r)}
              >
                {LEAD_REASON_LABEL[r]}
              </TogglePill>
            ))}
          </div>
        </FormField>
        <FormField
          label="Details"
          hint="What exactly they need, budget, timing, tender dates."
        >
          <Textarea
            value={v.reasonNote}
            onChange={(e) => set("reasonNote", e.target.value)}
            rows={2}
            maxLength={500}
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Proposal defaults"
        description="Used for the addressee block on generated proposals."
      >
        <FormGrid cols={2}>
          <FormField label="Addressee title">
            <Input
              value={v.addresseeTitle}
              onChange={(e) => set("addresseeTitle", e.target.value)}
              maxLength={120}
              placeholder="Director"
            />
          </FormField>
          <FormField label="Department">
            <Input
              value={v.addresseeDept}
              onChange={(e) => set("addresseeDept", e.target.value)}
              maxLength={160}
              placeholder="Procurement and Supply Chain Management"
            />
          </FormField>
        </FormGrid>
        <FormField label="Remark">
          <Textarea
            value={v.remark}
            onChange={(e) => set("remark", e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </FormField>
      </FormSection>

      <SaveBar
        saving={saving}
        onSave={save}
        saveLabel={lead?.id ? "Save changes" : "Create lead"}
        error={error ?? undefined}
        disabled={
          !v.organisation.trim() ||
          !v.code.trim() ||
          !v.contactName.trim() ||
          !v.phone.trim() ||
          !v.address.trim()
        }
      />
    </EditorForm>
  );
}
