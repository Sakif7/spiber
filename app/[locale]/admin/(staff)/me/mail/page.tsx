// The employee portal's Mail is the same page as Company → Mail; it lives at
// its own path so each section keeps one nav item per href (the topbar title
// and the active highlight key on the href). Segment config cannot be
// re-exported, so it is declared here again.
export { default } from "../../mail/page";

export const dynamic = "force-dynamic";
