import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  EventForm,
  type EventFormInitial,
} from "@/components/admin/events/event-form";
import { getEventByIdLean } from "@/lib/repositories/events.repo";

export const dynamic = "force-dynamic";

const L = (v?: { en?: string; bn?: string }) => ({
  en: v?.en ?? "",
  bn: v?.bn ?? "",
});
const dtLocal = (d?: Date | null) =>
  d ? new Date(d).toISOString().slice(0, 16) : "";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ev = await getEventByIdLean(id).catch(() => null);
  if (!ev) notFound();

  const initial: EventFormInitial = {
    id: String(ev._id),
    title: L(ev.title),
    slug: ev.slug,
    summary: L(ev.summary),
    description: L(ev.description),
    coverImage: ev.coverImage ?? "",
    startDate: dtLocal(ev.startDate),
    endDate: dtLocal(ev.endDate),
    location: L(ev.location),
    registrationUrl: ev.registrationUrl ?? "",
    status: ev.status,
  };

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-2xl)",
          color: "var(--color-text-strong)",
        }}
      >
        Edit event
      </h1>
      <EventForm initial={initial} />
    </div>
  );
}
