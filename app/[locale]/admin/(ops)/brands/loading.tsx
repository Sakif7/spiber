import { AdminFormAndTableSkeleton } from "@/components/admin/skeletons";

export default function Loading() {
  // Brands renders the create form first, then a 4-column table.
  return <AdminFormAndTableSkeleton columns={4} />;
}
