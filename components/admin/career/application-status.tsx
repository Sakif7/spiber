"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "@/i18n/navigation";
import type { ApplicationStatus } from "@/lib/schemas/career";

const OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interviewing", label: "Interviewing" },
  { value: "rejected", label: "Rejected" },
  { value: "hired", label: "Hired" },
];

const selStyle: CSSProperties = {
  height: 34,
  padding: "0 8px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  font: "inherit",
  fontSize: "var(--fs-small)",
  background: "var(--color-surface)",
};

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
    <select
      value={value}
      disabled={busy}
      onChange={(e) => change(e.target.value as ApplicationStatus)}
      style={{ ...selStyle, opacity: busy ? 0.6 : 1 }}
      aria-label="Application status"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
