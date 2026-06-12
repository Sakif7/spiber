"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import type { ApplicationStatus } from "@/lib/schemas/career";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interviewing", label: "Interviewing" },
  { value: "rejected", label: "Rejected" },
  { value: "hired", label: "Hired" },
];

/** Inline status dropdown that PATCHes the application on change. */
export function ApplicationStatusSelect({
  id,
  status,
}: {
  id: string;
  status: ApplicationStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState<ApplicationStatus>(status);
  const [busy, setBusy] = useState(false);

  async function change(next: ApplicationStatus) {
    setBusy(true);
    setValue(next);
    const res = await fetch(`/api/admin/career/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setValue(status);
  }

  return (
    <Select
      value={value}
      disabled={busy}
      onValueChange={(v) => change(v as ApplicationStatus)}
    >
      <SelectTrigger size="sm" aria-label="Application status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
