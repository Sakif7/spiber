import { AdminFormSkeleton } from "@/components/admin/skeletons";

export default function Loading() {
  // Edit page header is a "← Products" breadcrumb + title + "SKU …" subtitle.
  return <AdminFormSkeleton fields={8} breadcrumb subtitle />;
}
