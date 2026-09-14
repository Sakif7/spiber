"use client";

import { useEffect, useState } from "react";

/** One person as the pickers see them. */
export type PickableEmployee = {
  id: string;
  name: string;
  designation: string;
  kind: "director" | "staff";
  businessEmail: string | null;
  hasSignature: boolean;
};

type State =
  | { status: "loading"; people: PickableEmployee[] }
  | { status: "ready"; people: PickableEmployee[] }
  | { status: "error"; people: PickableEmployee[] };

/** The active employees, fetched once a dialog opens. */
export function useEmployees(open: boolean): State {
  const [state, setState] = useState<State>({ status: "loading", people: [] });
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/admin/company/hr/employees")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const people = (json?.data?.employees ?? []) as PickableEmployee[];
        setState({ status: "ready", people });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", people: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [open]);
  return state;
}
