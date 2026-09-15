import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { myReviews } from "@/lib/services/documents/document-review.service";
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
} from "@/lib/documents/types";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { MessageSquareText } from "lucide-react";
import { reviewerOrRedirect, day } from "../_shared";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof myReviews>>[number];

/** Drafts I was asked to read and comment on — and the ones I have done. */
export default async function MyReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await reviewerOrRedirect(locale, "/admin/me/reviews");
  const rows = await myReviews(actor);
  const waiting = rows.filter(
    (r) =>
      r.me?.status === "pending" &&
      (r.status === "draft" || r.status === "in_review"),
  ).length;

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Document",
      mobile: "primary",
      cell: (r) => (
        <div className="min-w-0">
          <Link
            href={`/${locale}/admin/me/reviews/${r.id}`}
            className="text-foreground block truncate font-medium hover:underline"
          >
            {r.title}
          </Link>
          <span className="text-muted-foreground text-xs">
            {DOCUMENT_TYPE_LABEL[r.type]} · by {r.authorName}
          </span>
        </div>
      ),
    },
    {
      key: "asked",
      header: "Asked",
      cell: (r) => (
        <span className="text-muted-foreground text-xs">
          {r.invitedAt ? day(r.invitedAt) : "—"}
        </span>
      ),
    },
    {
      key: "open",
      header: "Open comments",
      cell: (r) => <span className="tabular-nums">{r.open}</span>,
    },
    {
      key: "open-link",
      header: "",
      align: "right",
      mobile: "actions",
      cell: (r) => (
        <Link
          href={`/${locale}/admin/me/reviews/${r.id}`}
          className="text-primary text-sm font-medium hover:underline"
        >
          Open
        </Link>
      ),
    },
    {
      key: "me",
      header: "You",
      cell: (r) =>
        r.status !== "draft" && r.status !== "in_review" ? (
          <StatusBadge tone="neutral" dot={false}>
            {DOCUMENT_STATUS_LABEL[r.status]} — review closed
          </StatusBadge>
        ) : r.me?.status === "done" ? (
          <StatusBadge tone="success" dot={false}>
            Reviewed {day(r.me.actedAt)}
          </StatusBadge>
        ) : r.me ? (
          <StatusBadge tone="warning" dot={false}>
            Waiting for your comments
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral" dot={false}>
            In review
          </StatusBadge>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Reviews"
        description={
          waiting
            ? `${waiting} draft${waiting === 1 ? "" : "s"} waiting for your comments.`
            : "Drafts the office asks you to read and comment on appear here."
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="Nothing to review."
        emptyIcon={MessageSquareText}
        emptyDescription="You are told in your bell and by mail when a draft needs your eyes."
      />
    </div>
  );
}
