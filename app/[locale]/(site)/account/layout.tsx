import type { Metadata } from "next";

// Private, per-user pages (orders, quotations, cases, wishlist) — keep them out
// of the index. They sit inside the public (site) shell, so this layout only
// contributes the robots directive and passes children straight through.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
