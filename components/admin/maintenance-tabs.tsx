"use client";

import { BookOpen, Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Splits the Maintenance page into the admin guide and the data-cleanup tools.
 *
 * The guide is the default tab on purpose: cleanup permanently deletes
 * records, so it should take a deliberate click rather than being the first
 * thing a mis-click lands on. Both panels are rendered on the server and
 * passed in, so this component only owns which one is visible.
 *
 * `cleanup` is null for a plain admin — permanent deletion is super-admin
 * only — and the tab strip then collapses to the guide alone.
 */
export function MaintenanceTabs({
  guide,
  cleanup,
}: {
  guide: React.ReactNode;
  cleanup: React.ReactNode | null;
}) {
  return (
    <Tabs defaultValue="guide" className="gap-4">
      <TabsList>
        <TabsTrigger value="guide">
          <BookOpen className="size-4" />
          Admin guide
        </TabsTrigger>
        {cleanup && (
          <TabsTrigger value="cleanup">
            <Wrench className="size-4" />
            Data cleanup
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="guide">{guide}</TabsContent>
      {cleanup && <TabsContent value="cleanup">{cleanup}</TabsContent>}
    </Tabs>
  );
}
