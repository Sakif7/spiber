import { setRequestLocale } from "next-intl/server";
import { EventForm } from "@/components/admin/events/event-form";
import { EditorHeader } from "@/components/admin/ui/form-shell";

export const dynamic = "force-dynamic";

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/events"
        backLabel="Events"
        title="New event"
      />
      <EventForm />
    </div>
  );
}
