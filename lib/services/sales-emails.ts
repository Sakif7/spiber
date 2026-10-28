import { CONTACT } from "@/lib/contact";
import { getSetting } from "@/lib/repositories/settings.repo";

/**
 * Who a mail to a Sales client is copied to (the team's inbox keeps a copy of
 * everything that goes to a client) and where its replies go (a person — the
 * sender itself is a fixed no-reply address).
 *
 * Its own module so the pay-link mail does not pull the PDF renderer in.
 */
export async function salesEmails(): Promise<{
  teamInbox: string;
  mdEmail: string;
}> {
  const stored = await getSetting<{ teamInbox?: string; mdEmail?: string }>(
    "sales.email",
  ).catch(() => null);
  return {
    teamInbox:
      stored?.teamInbox ??
      process.env.SALES_TEAM_EMAIL ??
      process.env.CONTACT_TEAM_EMAIL ??
      CONTACT.generalEmail,
    mdEmail: stored?.mdEmail ?? "md@spibermed.com",
  };
}
