import { AdminListSkeleton } from "@/components/admin/skeletons";

export default function Loading() {
  return <AdminListSkeleton columns={6} rows={7} action={false} toolbar />;
}
