"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ManualEnrollForm({
  courses,
}: {
  courses: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/academy/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, email }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) {
      setEmail("");
      setMsg("Enrolled.");
      router.refresh();
    } else {
      setMsg(json?.error?.code ?? "failed");
    }
  }

  const field: React.CSSProperties = {
    height: 40,
    padding: "0 10px",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--r-sm)",
    font: "inherit",
    background: "var(--color-surface)",
    minWidth: 200,
  };

  return (
    <section
      style={{
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        borderRadius: "var(--r-lg)",
        padding: "var(--s-5)",
        display: "flex",
        gap: "var(--s-3)",
        alignItems: "flex-end",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="manual-course">Course</Label>
        <select
          id="manual-course"
          style={field}
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title || "(untitled)"}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="manual-email">Student email</Label>
        <Input
          id="manual-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="student@example.com"
        />
      </div>
      <CtaButton
        onClick={submit}
        style={{ opacity: busy || !email || !courseId ? 0.6 : 1 }}
      >
        {busy ? "Enrolling…" : "Manual enroll"}
      </CtaButton>
      {msg && (
        <span
          style={{ fontSize: "var(--fs-sm)", color: "var(--color-text-muted)" }}
        >
          {msg}
        </span>
      )}
    </section>
  );
}
