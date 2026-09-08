"use client";

import { CourseBuilder, type CourseBuilderInitial } from "./course-builder";
import { useRecord, RecordPending } from "@/components/admin/ui/use-record";
import { Card } from "@/components/ui/card";
import { formatBDT } from "@/lib/money";

type Payload = {
  initial: CourseBuilderInitial;
  stats: {
    total: number;
    active: number;
    completed: number;
    revenueMinor: number;
  } | null;
};

/**
 * The course builder in a panel, with the enrolment figures the edit page used
 * to show above it. The curriculum is fetched on open — a course carries its
 * whole module and lesson tree, which has no business riding along on every
 * row of the courses list.
 */
export function CourseBuilderPanel({ id }: { id: string }) {
  const { data, error } = useRecord<Payload>(
    `/api/admin/academy/courses/${id}`,
  );
  if (!data) return <RecordPending error={error} />;

  const s = data.stats;
  const completion =
    s && s.active > 0 ? Math.round((s.completed / s.active) * 100) : 0;

  return (
    <div className="space-y-4">
      {s && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
          {[
            { label: "Enrollments", value: String(s.total) },
            { label: "Active", value: String(s.active) },
            { label: "Completion", value: `${completion}%` },
            { label: "Revenue", value: formatBDT(s.revenueMinor, "en") },
          ].map((k) => (
            <Card key={k.label} className="gap-1 p-3">
              <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.12em] uppercase">
                {k.label}
              </span>
              <strong className="text-foreground text-lg leading-tight font-bold tabular-nums">
                {k.value}
              </strong>
            </Card>
          ))}
        </div>
      )}
      <CourseBuilder initial={data.initial} />
    </div>
  );
}
