import { FileQuestion } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Admin-scoped 404.
 *
 * Every admin detail page calls `notFound()` for a bad or deleted id. Without
 * this, those landed on the public marketing 404 — a full-width branded page
 * with the storefront header, which reads as though the operator has been
 * signed out. This keeps them in the shell.
 */
export default function AdminNotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <Card className="w-full max-w-md gap-0 p-6 text-center">
        <span
          aria-hidden
          className="bg-muted text-muted-foreground mx-auto grid size-10 place-items-center rounded-full"
        >
          <FileQuestion className="size-5" />
        </span>
        <h1 className="text-admin-lg mt-4 font-semibold">Not found</h1>
        <p className="text-muted-foreground mt-1.5">
          This record does not exist, or it has been deleted.
        </p>
        <div className="mt-5 flex justify-center">
          <Button asChild>
            <Link href="/admin">Back to dashboard</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
