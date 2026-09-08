"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { logger } from "@/lib/log";

/**
 * One error boundary for the whole admin subtree.
 *
 * Without it an unhandled server error in any of the ~105 admin pages fell
 * through to Next's default screen, which drops the operator out of the admin
 * shell and, in production, tells them nothing they can act on. This keeps
 * them inside the panel with a way back.
 *
 * `digest` is the only detail worth showing: it is the id the server logged
 * the real stack under, so an operator can quote it. The message itself is
 * withheld in production by React anyway.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("admin route error", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <Card className="w-full max-w-md gap-0 p-6 text-center">
        <span
          aria-hidden
          className="bg-destructive/10 text-destructive mx-auto grid size-10 place-items-center rounded-full"
        >
          <AlertTriangle className="size-5" />
        </span>
        <h1 className="text-admin-lg mt-4 font-semibold">
          This page could not load
        </h1>
        <p className="text-muted-foreground mt-1.5">
          Something went wrong on the server. Nothing you were viewing has been
          changed.
        </p>
        {error.digest && (
          <p className="text-muted-foreground text-admin-xs mt-3 font-mono">
            Reference {error.digest}
          </p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw className="size-4" aria-hidden />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin">Back to dashboard</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
