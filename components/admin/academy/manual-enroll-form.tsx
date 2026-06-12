"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  return (
    <section className="bg-card flex flex-wrap items-end gap-3 rounded-lg p-5 shadow-[var(--shadow-sm)]">
      <div className="grid gap-1.5">
        <Label htmlFor="manual-course">Course</Label>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger id="manual-course" className="min-w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title || "(untitled)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="manual-email">Student email</Label>
        <Input
          id="manual-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="student@example.com"
        />
      </div>
      <Button
        type="button"
        onClick={submit}
        disabled={busy || !email || !courseId}
      >
        {busy ? "Enrolling…" : "Manual enroll"}
      </Button>
      {msg && <span className="text-muted-foreground text-sm">{msg}</span>}
    </section>
  );
}
