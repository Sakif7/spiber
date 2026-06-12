import { CONTACT } from "@/lib/contact";

/**
 * Where Spiber Tourism lead/case notifications are routed: the dedicated
 * case-manager inbox if configured, else the shared contact-team override, else
 * the general inbox. Email failures are always swallowed by the callers (the
 * brief's "never block a flow on a missing API").
 */
export function tourismTeamRecipient(): string {
  return (
    process.env.TOURISM_TEAM_EMAIL?.trim() ||
    process.env.CONTACT_TEAM_EMAIL?.trim() ||
    CONTACT.generalEmail
  );
}
