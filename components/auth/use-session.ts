"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";

export type SessionUser = {
  name: string;
  email: string;
  roles: string[];
  isAdmin: boolean;
};

/**
 * Current session for client UI (navbar). Backed by /api/auth/me and the
 * shared ["session"] query so login/logout reflect everywhere at once.
 */
export function useSession() {
  const qc = useQueryClient();
  const router = useRouter();

  const query = useQuery({
    queryKey: ["session"],
    queryFn: async (): Promise<SessionUser | null> => {
      const res = await fetch("/api/auth/me");
      const json = await res.json();
      return res.ok && json.ok ? (json.data.user as SessionUser | null) : null;
    },
  });

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    qc.setQueryData(["session"], null);
    router.refresh();
  }

  return { user: query.data ?? null, isLoading: query.isLoading, signOut };
}
