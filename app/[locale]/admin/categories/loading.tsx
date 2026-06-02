import { AdminFormAndTableSkeleton } from "@/components/admin/skeletons";

export default function Loading() {
  // Categories renders the table first, then the create form.
  return <AdminFormAndTableSkeleton columns={3} tableFirst />;
}
