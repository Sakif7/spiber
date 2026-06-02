import { AdminListSkeleton } from "@/components/admin/skeletons";

export default function Loading() {
  // Products page uses a --s-6 column gap (orders uses --s-5).
  return <AdminListSkeleton columns={5} rows={7} gap="var(--s-6)" />;
}
