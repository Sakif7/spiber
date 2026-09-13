import { AdminListSkeleton } from "@/components/admin/skeletons";

export default function Loading() {
  return <AdminListSkeleton columns={5} rows={6} gap="var(--s-6)" />;
}
