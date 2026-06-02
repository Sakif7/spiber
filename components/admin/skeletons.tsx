import type { CSSProperties } from "react";

/**
 * Admin loading skeletons. Each composed skeleton mirrors the real page it
 * stands in for (header rhythm, table columns, form rows) so the swap to live
 * content doesn't shift layout. Shimmer + reduced-motion handling live in the
 * `.skeleton` class (app/globals.css).
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
    <span
      className="skeleton"
      aria-hidden
      style={{
        width: width ?? "100%",
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

const cardStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  borderRadius: "var(--r-lg)",
  overflow: "hidden",
};

const thPad = "var(--s-3) var(--s-4)";

/** Title (+ optional action button) row, matching the admin page headers. */
function HeaderRow({ action = true }: { action?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--s-4)",
        flexWrap: "wrap",
      }}
    >
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
  return (
    <div style={cardStyle}>
      {/* head */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `2fr repeat(${columns - 1}, 1fr)`,
          gap: "var(--s-4)",
          padding: thPad,
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {cols.map((_, i) => (
          <Skeleton key={i} width={i === 0 ? 120 : 70} height={12} />
        ))}
      </div>
      {/* body */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: "grid",
            gridTemplateColumns: `2fr repeat(${columns - 1}, 1fr)`,
            gap: "var(--s-4)",
            padding: "var(--s-4)",
            borderBottom:
              r === rows - 1 ? "none" : "1px solid var(--color-border)",
            alignItems: "center",
          }}
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
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      <HeaderRow action={action} />
      {toolbar && (
        <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width={74} height={30} radius="var(--r-sm)" />
          ))}
        </div>
      )}
      <TableSkeleton columns={columns} rows={rows} />
    </div>
  );
}

/** Dashboard = heading + 4 KPI cards + a panel. */
export function AdminDashboardSkeleton() {
  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Skeleton width={220} height={34} radius="var(--r-sm)" />
        <Skeleton width={140} height={14} />
      </div>
      <div
        className="equal-4col"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "var(--s-4)",
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gap: "var(--s-3)",
              padding: "var(--s-5)",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-lg)",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <Skeleton width={36} height={36} radius="var(--r-md)" />
            <Skeleton width={88} height={11} />
            <Skeleton width={120} height={28} radius="var(--r-sm)" />
          </div>
        ))}
      </div>
      <div
        style={{
          ...cardStyle,
          padding: "var(--s-6)",
          display: "grid",
          gap: "var(--s-3)",
        }}
      >
        <Skeleton width="40%" height={16} />
        <Skeleton width="65%" height={14} />
        <Skeleton width="55%" height={14} />
      </div>
    </div>
  );
}

/** A field row: label + input. */
function FieldSkeleton({ inputHeight = 42 }: { inputHeight?: number }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
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
    <div style={{ display: "grid", gap: "var(--s-6)", maxWidth }}>
      {title && (
        <div style={{ display: "grid", gap: "var(--s-2)" }}>
          {breadcrumb && <Skeleton width={92} height={13} />}
          <Skeleton width={220} height={30} radius="var(--r-sm)" />
          {subtitle && <Skeleton width={120} height={13} />}
        </div>
      )}
      <div
        style={{
          ...cardStyle,
          padding: "var(--s-6)",
          display: "grid",
          gap: "var(--s-5)",
        }}
      >
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
    <div
      key="form"
      style={{
        ...cardStyle,
        padding: "var(--s-6)",
        display: "grid",
        gap: "var(--s-4)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "var(--s-4)",
        }}
      >
        <FieldSkeleton />
        <FieldSkeleton />
      </div>
      <Skeleton width={140} height={40} radius="var(--r-sm)" />
    </div>
  );
  const table = <TableSkeleton key="table" columns={columns} rows={5} />;

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: "var(--s-2)" }}>
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
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <Skeleton width={160} height={14} />
      <Skeleton width={240} height={30} radius="var(--r-sm)" />
      <div
        className="equal-2col"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
          gap: "var(--s-5)",
          alignItems: "start",
        }}
      >
        <div
          style={{
            ...cardStyle,
            padding: "var(--s-5)",
            display: "grid",
            gap: "var(--s-4)",
          }}
        >
          <Skeleton width={120} height={12} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "var(--s-4)",
              }}
            >
              <Skeleton width="55%" height={14} />
              <Skeleton width={70} height={14} />
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gap: "var(--s-5)" }}>
          <div
            style={{
              ...cardStyle,
              padding: "var(--s-5)",
              display: "grid",
              gap: "var(--s-3)",
            }}
          >
            <Skeleton width={100} height={12} />
            <Skeleton width="100%" height={42} radius="var(--r-sm)" />
            <Skeleton width="100%" height={42} radius="var(--r-sm)" />
          </div>
          <div
            style={{
              ...cardStyle,
              padding: "var(--s-5)",
              display: "grid",
              gap: "var(--s-3)",
            }}
          >
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
