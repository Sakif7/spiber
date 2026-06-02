import { AdminFormAndTableSkeleton } from "@/components/admin/skeletons";

export default function Loading() {
  // Coupons has a subtitle and a 7-column table, rendered above the create form.
  return <AdminFormAndTableSkeleton columns={7} tableFirst subtitle />;
}
