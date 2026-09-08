"use client";

import { useRef, useState } from "react";
import { useAfterSave } from "@/components/admin/ui/form-panel";
import { toast } from "sonner";
import { Paperclip, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  EditorForm,
  FormSection,
  FormGrid,
  FormField,
  SaveBar,
} from "@/components/admin/ui/form-shell";
import { SelectField } from "@/components/admin/ui/select-field";
import { formatApiError } from "@/lib/http/form-error";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
} from "@/lib/hr/expense-constants";
import type { PersonOption } from "./visit-form";

export type VisitOption = { id: string; label: string };

export type ExpenseFormValues = {
  id?: string;
  visitId: string;
  employeeId: string;
  category: string;
  /** Taka as typed, converted to poisha on save. */
  amount: string;
  spentAt: string;
  description: string;
  receiptDocumentId: string;
  receiptTitle: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export function ExpenseForm({
  expense,
  people,
  visits,
  lockedVisitId,
}: {
  expense?: ExpenseFormValues;
  people: PersonOption[];
  visits: VisitOption[];
  /** Set when adding a claim from a visit's page. */
  lockedVisitId?: string;
}) {
  const afterSave = useAfterSave();
  const [v, setV] = useState<ExpenseFormValues>(
    expense ?? {
      visitId: lockedVisitId ?? "",
      employeeId: people[0]?.id ?? "",
      category: "meal",
      amount: "",
      spentAt: today(),
      description: "",
      receiptDocumentId: "",
      receiptTitle: "",
    },
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ExpenseFormValues>(
    k: K,
    value: ExpenseFormValues[K],
  ) => setV((prev) => ({ ...prev, [k]: value }));

  async function uploadReceipt(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("spentAt", v.spentAt);
      const res = await fetch("/api/admin/company/people/expenses/receipt", {
        method: "POST",
        body,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "Could not file the receipt."));
        return;
      }
      setV((prev) => ({
        ...prev,
        receiptDocumentId: json?.data?.documentId ?? "",
        receiptTitle: json?.data?.title ?? file.name,
      }));
      toast.success("Receipt filed in the vault.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    const taka = Number(v.amount);
    if (!Number.isFinite(taka) || taka <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        visitId: v.visitId || null,
        employeeId: v.employeeId,
        category: v.category,
        amountMinor: Math.round(taka * 100),
        spentAt: v.spentAt,
        description: v.description,
        receiptDocumentId: v.receiptDocumentId || null,
      };
      const res = await fetch(
        expense?.id
          ? `/api/admin/company/people/expenses/${expense.id}`
          : "/api/admin/company/people/expenses",
        {
          method: expense?.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "Could not save the claim."));
        return;
      }
      toast.success(expense?.id ? "Claim updated." : "Claim recorded.");
      afterSave(
        `/admin/company/people/expenses/${expense?.id ?? json?.data?.id ?? ""}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorForm>
      <FormSection
        title="The cost"
        description="Amounts are in taka. Whoever paid is who gets it back."
      >
        <FormGrid cols={2}>
          <FormField label="Paid by" required>
            <SelectField
              value={v.employeeId}
              onChange={(value) => set("employeeId", value)}
              placeholder="Choose a person"
              options={people.map((p) => ({ value: p.id, label: p.name }))}
            />
          </FormField>
          <FormField label="Category" required>
            <SelectField
              value={v.category}
              onChange={(value) => set("category", value)}
              options={EXPENSE_CATEGORIES.map((c) => ({
                value: c,
                label: EXPENSE_CATEGORY_LABEL[c] ?? c,
              }))}
            />
          </FormField>
          <FormField label="Amount (৳)" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={v.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="850"
            />
          </FormField>
          <FormField label="Date spent" required>
            <Input
              type="date"
              value={v.spentAt}
              onChange={(e) => set("spentAt", e.target.value)}
            />
          </FormField>
        </FormGrid>
        <FormField label="What it was for" required>
          <Input
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Lunch with the procurement lead"
            maxLength={300}
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Visit"
        description="Linking the trip is what shows why the cost was incurred."
      >
        <FormGrid cols={2}>
          <FormField label="Visit">
            <SelectField
              value={v.visitId}
              onChange={(value) => set("visitId", value)}
              emptyLabel="— not on a visit —"
              disabled={Boolean(lockedVisitId)}
              options={visits.map((t) => ({ value: t.id, label: t.label }))}
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection
        title="Receipt"
        description="Filed encrypted in the company vault, under HR / Expenses."
      >
        {v.receiptDocumentId ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-muted inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5">
              <Paperclip className="size-3.5" aria-hidden />
              {v.receiptTitle || "Receipt"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                set("receiptDocumentId", "");
                set("receiptTitle", "");
              }}
            >
              <X className="size-4" aria-hidden />
              Remove
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadReceipt(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Paperclip className="size-4" aria-hidden />
              )}
              {uploading ? "Filing…" : "Attach receipt"}
            </Button>
            <span className="text-muted-foreground text-admin-xs">
              JPEG, PNG, WebP or PDF, up to 10MB.
            </span>
          </div>
        )}
      </FormSection>

      <SaveBar
        onSave={save}
        saving={saving}
        error={error}
        disabled={uploading}
        saveLabel={expense?.id ? "Save changes" : "Record claim"}
      />
    </EditorForm>
  );
}
