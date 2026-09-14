"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";

export type SessionUser = {
  name: string;
  email: string;
  roles: string[];
  isAdmin: boolean;
  /** On the payroll: their own desk lives at /admin/me. */
  isEmployee: boolean;
};

/**
 * Where this person's own workspace is, if they have one: admins run the
 * operations admin, employees their desk, sellers their portal. Null for a
 * customer. The navbar shows this as the way back from the public site —
 * an employee otherwise had no link to the portal once they landed here.
 */
export function workspaceFor(
  user: Pick<SessionUser, "roles" | "isAdmin" | "isEmployee">,
): { href: string; label: string } | null {
  if (user.isAdmin) return { href: "/admin", label: "Admin" };
  if (user.isEmployee) return { href: "/admin/me", label: "My desk" };
  if (user.roles.includes("seller"))
    return { href: "/seller", label: "Seller portal" };
  return null;
}

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
