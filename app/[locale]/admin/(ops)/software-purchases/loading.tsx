import { AdminListSkeleton } from "@/components/admin/skeletons";

export default function Loading() {
  return <AdminListSkeleton columns={5} action={false} />;
}
