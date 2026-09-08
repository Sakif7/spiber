"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog as SheetPrimitive } from "radix-ui";
import { cn } from "@/lib/cn";

/**
 * Lets a form inside the panel close it after a successful save, without the
 * form knowing anything about the panel. Outside a panel the hook returns null
 * and the form keeps its old behaviour, so the same component still works on a
 * full page.
 */
/**
 * How wide the reserved scrollbar gutter is, right now.
 *
 * `scrollbar-gutter: stable` on <html> reserves the scrollbar's width forever,
 * so a fixed element laid out against the html box stops short of the real
 * viewport edge — leaving a visible strip beside the panel AND its backdrop.
 *
 * This is measured rather than expressed in CSS: `calc(100% - 100vw)` looks
 * like it should give minus-one-gutter, but the browser resolves the
 * percentage against the full viewport here, so it computes to exactly zero.
 * Measuring is unambiguous and re-measures on resize.
 */
function useGutterOffset(active: boolean) {
  const [gutter, setGutter] = useState(0);
  useEffect(() => {
    if (!active) return;
    // Measure the html BOX, not clientWidth: once the dialog locks scrolling
    // clientWidth reports the full viewport again, while the box stays narrow.
    const read = () =>
      setGutter(
        Math.max(
          0,
          Math.round(
            window.innerWidth -
              document.documentElement.getBoundingClientRect().width,
          ),
        ),
      );
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [active]);
  return gutter;
}

const PanelContext = createContext<{ close: () => void } | null>(null);
export const useFormPanel = () => useContext(PanelContext);

/**
 * What a form does once it has saved.
 *
 * In a panel the list you were working in is still behind you, so the panel
 * closes and the list refreshes underneath. On a full page there is nothing to
 * return to, so it navigates where that page always went. Either way the data
 * behind is re-fetched.
 *
 * Passing no href (or null) means "stay put and just refresh" — what an edit
 * surface wants.
 */
export function useAfterSave() {
  const panel = useFormPanel();
  const router = useRouter();
  return (fallbackHref?: string | null) => {
    if (panel) panel.close();
    else if (fallbackHref) router.push(fallbackHref);
    router.refresh();
  };
}

/**
 * The admin's form surface: a panel anchored to the right edge that slides
 * leftward into place over a blurred backdrop.
 *
 * Forms used to be their own routes, which meant leaving the list to fill one
 * in and losing your place in it. The panel keeps the list underneath, so the
 * context you were working in is still there when you close it.
 *
 * Built on Radix Dialog, so the focus trap, Escape, scroll lock and
 * `aria-modal` come for free. The shared `Sheet` is deliberately not reused:
 * it caps at `max-w-sm` for the mobile nav drawer, and widening it there would
 * change that.
 *
 * The body is the scroll container, so a form's own sticky `SaveBar` pins to
 * the bottom of the panel rather than the page — no form needed changing.
 */
export function FormPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  /** Roughly 56rem; a long editor needs the room. */
  width = "max-w-[min(56rem,94vw)]",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: string;
}) {
  const gutter = useGutterOffset(open);
  const edge = { right: `-${gutter}px` };

  return (
    <SheetPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay
          style={edge}
          className={cn(
            // See the note on the panel below: the reserved scrollbar
            // gutter would otherwise leave a strip uncovered.
            "fixed inset-y-0 left-0 z-50 bg-black/35 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "duration-[220ms] ease-out motion-reduce:animate-none motion-reduce:duration-0",
          )}
        />
        <SheetPrimitive.Content
          style={edge}
          className={cn(
            /* `scrollbar-gutter: stable` on <html> permanently reserves the scrollbar's
   width, and a fixed element's containing block is the viewport MINUS that
   reserve — so `right: 0` stops ~10px short of the real edge and leaves a
   visible strip beside the panel and its backdrop. calc(100% - 100vw) is
   exactly minus-one-gutter, which puts both back on the true viewport edge. */
            "bg-background fixed inset-y-0 z-50 flex h-full w-full flex-col border-l shadow-2xl",
            width,
            // Enters from the right edge, travelling leftward.
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
            "duration-[260ms] ease-out motion-reduce:animate-none motion-reduce:duration-0",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="min-w-0">
              <SheetPrimitive.Title className="text-admin-lg font-semibold">
                {title}
              </SheetPrimitive.Title>
              {description ? (
                <SheetPrimitive.Description className="text-muted-foreground text-admin-xs mt-0.5">
                  {description}
                </SheetPrimitive.Description>
              ) : (
                // Radix warns without a description; an empty one is the
                // documented way to say "there deliberately isn't one".
                <SheetPrimitive.Description className="sr-only">
                  {title}
                </SheetPrimitive.Description>
              )}
            </div>
            <SheetPrimitive.Close
              aria-label="Close"
              className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 -mr-1 rounded-md p-1.5 transition-colors outline-none focus-visible:ring-[3px]"
            >
              <X className="size-4" />
            </SheetPrimitive.Close>
          </div>

          {/* The scroll container. A form's sticky SaveBar sticks to this. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">
            <PanelContext.Provider value={{ close: () => onOpenChange(false) }}>
              {children}
            </PanelContext.Provider>
          </div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}

/**
 * A row's own edit affordance: the record's name in a list, which opens that
 * record's form in the panel instead of navigating to a page for it.
 *
 * Looks and reads like the link it replaces — a list of names you click — so
 * nothing about the table changes except where the click takes you.
 */
export function FormPanelTrigger({
  label,
  title,
  description,
  children,
  width,
  className = "text-primary text-left font-medium hover:underline",
}: {
  label: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <FormPanel
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        width={width}
      >
        {open ? children : null}
      </FormPanel>
    </>
  );
}

/**
 * The button that opens a form panel, with the form passed as children.
 *
 * A server list page can render this and hand it a client form element, which
 * keeps the data fetching on the server where it already is.
 */
export function FormPanelButton({
  label,
  title,
  description,
  children,
  width,
  variant = "default",
  size = "sm",
  icon = true,
}: {
  label: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size={size}
        variant={variant}
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        {icon && <Plus className="size-4" aria-hidden />}
        {label}
      </Button>
      <FormPanel
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        width={width}
      >
        {/* Mounted only while open, so a form always starts clean and a heavy
            editor costs nothing until it is asked for. */}
        {open ? children : null}
      </FormPanel>
    </>
  );
}
