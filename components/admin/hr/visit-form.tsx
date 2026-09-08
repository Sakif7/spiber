"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  EditorForm,
  FormSection,
  FormGrid,
  FormField,
  SaveBar,
} from "@/components/admin/ui/form-shell";
import { SelectField } from "@/components/admin/ui/select-field";
import { formatApiError } from "@/lib/http/form-error";

export type PersonOption = { id: string; name: string; designation: string };
export type LeadOption = { id: string; label: string };

export type VisitFormValues = {
  id?: string;
  visitedAt: string;
  purpose: string;
  organisation: string;
  location: string;
  attendees: string[];
  leadId: string;
  outcome: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY: VisitFormValues = {
  visitedAt: today(),
  purpose: "",
  organisation: "",
  location: "",
  attendees: [],
  leadId: "",
  outcome: "",
  notes: "",
};

export function VisitForm({
  visit,
  people,
  leads,
}: {
  visit?: VisitFormValues;
  people: PersonOption[];
  leads: LeadOption[];
}) {
  const router = useRouter();
  const [v, setV] = useState<VisitFormValues>(visit ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof VisitFormValues>(
    k: K,
    value: VisitFormValues[K],
  ) => setV((prev) => ({ ...prev, [k]: value }));

  const toggleAttendee = (id: string, on: boolean) =>
    setV((prev) => ({
      ...prev,
      attendees: on
        ? [...prev.attendees, id]
        : prev.attendees.filter((a) => a !== id),
    }));

  async function save() {
    if (v.attendees.length === 0) {
      setError("Pick at least one person who went.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        visitedAt: v.visitedAt,
        purpose: v.purpose,
        organisation: v.organisation || undefined,
        location: v.location || undefined,
        attendees: v.attendees,
        leadId: v.leadId || null,
        outcome: v.outcome || undefined,
        notes: v.notes || undefined,
      };
      const res = await fetch(
        visit?.id
          ? `/api/admin/company/people/visits/${visit.id}`
          : "/api/admin/company/people/visits",
        {
          method: visit?.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "Could not save the visit."));
        return;
      }
      toast.success(visit?.id ? "Visit updated." : "Visit recorded.");
      router.push(
        `/admin/company/people/visits/${visit?.id ?? json?.data?.id ?? ""}`,
      );
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorForm>
      <FormSection
        title="The trip"
        description="Where the director went and what it was for."
      >
        <FormGrid cols={2}>
          <FormField label="Date" required>
            <Input
              type="date"
              value={v.visitedAt}
              onChange={(e) => set("visitedAt", e.target.value)}
            />
          </FormField>
          <FormField label="Purpose" required>
            <Input
              value={v.purpose}
              onChange={(e) => set("purpose", e.target.value)}
              placeholder="Introduce the ICU range"
              maxLength={200}
            />
          </FormField>
          <FormField label="Organisation">
            <Input
              value={v.organisation}
              onChange={(e) => set("organisation", e.target.value)}
              placeholder="Square Hospital"
              maxLength={200}
            />
          </FormField>
          <FormField label="Location">
            <Input
              value={v.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Panthapath, Dhaka"
              maxLength={200}
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection
        title="Who went"
        description="Everyone on the trip. Costs are claimed by whoever actually paid."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {people.length === 0 ? (
            <p className="text-muted-foreground">
              No active people yet — add them under Employees first.
            </p>
          ) : (
            people.map((p) => (
              <label
                key={p.id}
                className="hover:bg-accent flex items-center gap-2.5 rounded-md border px-3 py-2"
              >
                <Checkbox
                  checked={v.attendees.includes(p.id)}
                  onCheckedChange={(c) => toggleAttendee(p.id, c === true)}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="text-muted-foreground text-admin-xs block truncate">
                    {p.designation}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
      </FormSection>

      <FormSection
        title="Result"
        description="Linking the lead is what lets a trip be traced to the deal it produced."
      >
        <FormGrid cols={2}>
          <FormField label="Sales lead">
            <SelectField
              value={v.leadId}
              onChange={(value) => set("leadId", value)}
              emptyLabel="— none —"
              options={leads.map((l) => ({ value: l.id, label: l.label }))}
            />
          </FormField>
        </FormGrid>
        <FormField label="Outcome">
          <Textarea
            value={v.outcome}
            onChange={(e) => set("outcome", e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What came of it"
          />
        </FormField>
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
        onSave={save}
        saving={saving}
        error={error}
        saveLabel={visit?.id ? "Save changes" : "Record visit"}
      />
    </EditorForm>
  );
}
