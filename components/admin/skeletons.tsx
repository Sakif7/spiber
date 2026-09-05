import type { CSSProperties } from "react";
import { Skeleton as Shimmer } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

/**
 * Admin loading skeletons. Each composed skeleton mirrors the real page it
 * stands in for (header rhythm, table columns, form rows) so the swap to live
 * content doesn't shift layout. The shimmer itself is the shadcn `Skeleton`
 * primitive, so the placeholder tone follows the admin theme (light + dark)
 * and stills under `prefers-reduced-motion`.
 */

export function Skeleton({
  width,
  height = 16,
  radius,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: CSSProperties;
}) {
  return (
    <Shimmer
      aria-hidden
      className="block motion-reduce:animate-none"
      // Dimensions come from the caller, so they stay inline.
      style={{
        width: width ?? "100%",
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

/** The shared card shell: borderless, elevated, clipped (matches the real pages). */
const card = "bg-card overflow-hidden rounded-lg shadow-[var(--shadow-sm)]";

/** Title (+ optional action button) row, matching the admin page headers. */
function HeaderRow({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Skeleton width={180} height={30} radius="var(--r-sm)" />
      {action && <Skeleton width={132} height={40} radius="var(--r-sm)" />}
    </div>
  );
}

/** Generic table skeleton: a header strip + N shimmering rows. */
function TableSkeleton({
  columns,
  rows = 6,
}: {
  columns: number;
  rows?: number;
}) {
  const cols = Array.from({ length: columns });
  // The track list is derived from the `columns` prop, so it stays inline.
  const tracks: CSSProperties = {
    gridTemplateColumns: `2fr repeat(${columns - 1}, 1fr)`,
  };
  return (
    <div className={card}>
      {/* head */}
      <div
        className="border-border/60 grid gap-4 border-b px-4 py-3"
        style={tracks}
      >
        {cols.map((_, i) => (
          <Skeleton key={i} width={i === 0 ? 120 : 70} height={12} />
        ))}
      </div>
      {/* body */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className={cn(
            "grid items-center gap-4 p-4",
            r < rows - 1 && "border-border/60 border-b",
          )}
          style={tracks}
        >
          {cols.map((_, c) => (
            <Skeleton
              key={c}
              width={c === 0 ? "70%" : "45%"}
              height={14}
              style={{ opacity: 1 - r * 0.07 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A list page = header + (optional toolbar) + table. */
export function AdminListSkeleton({
  columns = 5,
  rows = 6,
  action = true,
  toolbar = false,
  gap = "var(--s-5)",
}: {
  columns?: number;
  rows?: number;
  action?: boolean;
  toolbar?: boolean;
  gap?: string;
}) {
  return (
    <div className="flex flex-col" style={{ gap }}>
      <HeaderRow action={action} />
      {toolbar && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width={74} height={30} radius="var(--r-sm)" />
          ))}
        </div>
      )}
      <TableSkeleton columns={columns} rows={rows} />
    </div>
  );
}

/** Dashboard = heading + the KPI row + the chart/panel row. */
export function AdminDashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Skeleton width={220} height={34} radius="var(--r-sm)" />
        <Skeleton width={140} height={14} />
      </div>
      <div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-card grid gap-3 rounded-lg p-5 shadow-[var(--shadow-sm)]"
          >
            <Skeleton width={36} height={36} radius="var(--r-md)" />
            <Skeleton width={88} height={11} />
            <Skeleton width={120} height={28} radius="var(--r-sm)" />
          </div>
        ))}
      </div>
      <div className="grid items-stretch gap-3 xl:grid-cols-3">
        <div className={cn(card, "grid content-start gap-3 p-6 xl:col-span-2")}>
          <Skeleton width="40%" height={16} />
          <Skeleton width="100%" height={200} radius="var(--r-sm)" />
        </div>
        <div className={cn(card, "grid content-start gap-3 p-6")}>
          <Skeleton width="55%" height={16} />
          <Skeleton width="90%" height={14} />
          <Skeleton width="70%" height={14} />
          <Skeleton width="80%" height={14} />
        </div>
      </div>
    </div>
  );
}

/** A field row: label + input. */
function FieldSkeleton({ inputHeight = 42 }: { inputHeight?: number }) {
  return (
    <div className="grid gap-2">
      <Skeleton width={110} height={12} />
      <Skeleton width="100%" height={inputHeight} radius="var(--r-sm)" />
    </div>
  );
}

/** A form page = heading (optional breadcrumb/subtitle) + a card of fields + submit. */
export function AdminFormSkeleton({
  fields = 6,
  title = true,
  breadcrumb = false,
  subtitle = false,
  maxWidth = 720,
}: {
  fields?: number;
  title?: boolean;
  breadcrumb?: boolean;
  subtitle?: boolean;
  maxWidth?: number;
}) {
  return (
    <div className="grid gap-6" style={{ maxWidth }}>
      {title && (
        <div className="grid gap-2">
          {breadcrumb && <Skeleton width={92} height={13} />}
          <Skeleton width={220} height={30} radius="var(--r-sm)" />
          {subtitle && <Skeleton width={120} height={13} />}
        </div>
      )}
      <div className={cn(card, "grid gap-5 p-6")}>
        {Array.from({ length: fields }).map((_, i) => (
          <FieldSkeleton key={i} inputHeight={i % 4 === 3 ? 96 : 42} />
        ))}
        <Skeleton
          width={150}
          height={42}
          radius="var(--r-sm)"
          style={{ marginTop: "var(--s-2)" }}
        />
      </div>
    </div>
  );
}

/**
 * Form + table on one page (categories, coupons, brands). Some pages put the
 * table first (categories, coupons) and others the form first (brands), so the
 * order is configurable to avoid a reflow when content swaps in.
 */
export function AdminFormAndTableSkeleton({
  columns = 3,
  tableFirst = false,
  subtitle = false,
}: {
  columns?: number;
  tableFirst?: boolean;
  subtitle?: boolean;
}) {
  const form = (
    <div key="form" className={cn(card, "grid gap-4 p-6")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldSkeleton />
        <FieldSkeleton />
      </div>
      <Skeleton width={140} height={40} radius="var(--r-sm)" />
    </div>
  );
  const table = <TableSkeleton key="table" columns={columns} rows={5} />;

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Skeleton width={200} height={30} radius="var(--r-sm)" />
        {subtitle && <Skeleton width={240} height={13} />}
      </div>
      {tableFirst ? [table, form] : [form, table]}
    </div>
  );
}

/** Order detail = breadcrumb + two-column (items + summary/actions). */
export function AdminOrderDetailSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton width={160} height={14} />
      <Skeleton width={240} height={30} radius="var(--r-sm)" />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className={cn(card, "grid gap-4 p-5")}>
          <Skeleton width={120} height={12} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between gap-4">
              <Skeleton width="55%" height={14} />
              <Skeleton width={70} height={14} />
            </div>
          ))}
        </div>
        <div className="grid gap-5">
          <div className={cn(card, "grid gap-3 p-5")}>
            <Skeleton width={100} height={12} />
            <Skeleton width="100%" height={42} radius="var(--r-sm)" />
            <Skeleton width="100%" height={42} radius="var(--r-sm)" />
          </div>
          <div className={cn(card, "grid gap-3 p-5")}>
            <Skeleton width={120} height={12} />
            <Skeleton width="80%" height={14} />
            <Skeleton width="70%" height={14} />
            <Skeleton width="60%" height={14} />
          </div>
        </div>
      </div>
    </div>
  );
}
