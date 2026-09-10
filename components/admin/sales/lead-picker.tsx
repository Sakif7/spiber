"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormSection } from "@/components/admin/ui/form-shell";
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import {
  LeadForm,
  type SourceEmployee,
} from "@/components/admin/sales/lead-form";

type LeadRow = {
  id: string;
  organisation: string;
  code: string;
  contact: string;
};

/** Choose who the order is for, before anything else can be entered. */
export function LeadPicker({
  leads,
  employees = [],
}: {
  leads: LeadRow[];
  employees?: SourceEmployee[];
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? leads.filter(
        (l) =>
          l.organisation.toLowerCase().includes(needle) ||
          l.code.toLowerCase().includes(needle),
      )
    : leads;

  return (
    <FormSection
      title="Choose a client"
      description="An order belongs to a lead — it is who the proposal and invoice are addressed to."
      action={
        <FormPanelButton
          label="New lead"
          title="New lead"
          description="Add the client this order is for."
          variant="outline"
        >
          <LeadForm employees={employees} />
        </FormPanelButton>
      }
    >
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search leads…"
          className="h-9 pl-8"
        />
      </div>
      <div className="mt-2 max-h-96 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="text-muted-foreground p-3 text-sm">
            No leads match. Add the organisation first.
          </p>
        ) : (
          shown.map((l) => (
            <Link
              key={l.id}
              href={`/admin/company/sales/orders/new?lead=${l.id}`}
              className="hover:bg-accent flex items-center justify-between gap-2 rounded px-2 py-2"
            >
              <span>
                <span className="block font-medium">{l.organisation}</span>
                <span className="text-muted-foreground block text-xs">
                  {l.contact}
                </span>
              </span>
              <span className="font-mono text-xs">{l.code}</span>
            </Link>
          ))
        )}
      </div>
    </FormSection>
  );
}
