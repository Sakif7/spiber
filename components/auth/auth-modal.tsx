"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { LoginForm } from "./login-form";
import { postLoginDestination, type AuthedUser } from "@/lib/auth/post-login";
import { RegisterForm } from "./register-form";
import { ForgotPasswordForm } from "./forgot-password-form";
import { ResetPasswordForm } from "./reset-password-form";

type Tab = "login" | "register";
/**
 * What the modal shows: the two tabs, or one of the password flows that the
 * email links open on the home page (`?auth=reset&token=…`, `?auth=forgot`)
 * so a person never leaves the site's own look to choose a password.
 */
type View = Tab | "forgot" | "reset";
type OpenOpts = {
  next?: string;
  verified?: boolean;
  verifyError?: boolean;
  /** The reset / invite token from the email link (`view === "reset"`). */
  token?: string;
  /** The token is an employee invite: "set your password", not "reset". */
  invite?: boolean;
};

type AuthModalCtx = {
  open: (view?: View, opts?: OpenOpts) => void;
  close: () => void;
};

const VIEWS: View[] = ["login", "register", "forgot", "reset"];

const Ctx = createContext<AuthModalCtx | null>(null);

export function useAuthModal(): AuthModalCtx {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}

const EASE = [0.16, 1, 0.3, 1] as const;

// Primary action carries the brand's orange accent (the logo's "Med").
const ORANGE_SUBMIT: CSSProperties = {
  background: "var(--color-secondary)",
  boxShadow:
    "0 10px 24px -10px color-mix(in oklab, var(--brand-orange) 60%, transparent)",
};

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View | null>(null);
  const [next, setNext] = useState<string | undefined>(undefined);
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState(false);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [invite, setInvite] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((v: View = "login", opts?: OpenOpts) => {
    triggerRef.current = (document.activeElement as HTMLElement) ?? null;
    setNext(opts?.next);
    setVerified(opts?.verified ?? false);
    setVerifyError(opts?.verifyError ?? false);
    setToken(opts?.token);
    setInvite(opts?.invite ?? false);
    setView(v);
  }, []);

  const close = useCallback(() => {
    setView(null);
    setVerified(false);
    setVerifyError(false);
    setNext(undefined);
    setToken(undefined);
    setInvite(false);
    // Return focus to whatever opened the modal.
    triggerRef.current?.focus?.();
  }, []);

  // Open from a server redirect URL (?auth=login&next=…&verified=1) or an
  // email link (?auth=reset&token=…), then strip those params so a refresh
  // or close doesn't re-trigger — and the token never sits in the address bar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth") as View | null;
    if (!auth || !VIEWS.includes(auth)) return;
    // Reading a one-time entry-point URL on mount; opening here is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    open(auth, {
      next: params.get("next") ?? undefined,
      verified: params.get("verified") === "1",
      verifyError: params.get("error") === "verify",
      token: params.get("token") ?? undefined,
      invite: params.get("invite") === "1",
    });
    ["auth", "next", "verified", "error", "token", "invite"].forEach((k) =>
      params.delete(k),
    );
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
    );
    // Mount-only: read the entry-point URL once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      <AuthModalView
        view={view}
        next={next}
        verified={verified}
        verifyError={verifyError}
        token={token}
        invite={invite}
        setView={setView}
        close={close}
      />
    </Ctx.Provider>
  );
}

function AuthModalView({
  view,
  next,
  verified,
  verifyError,
  token,
  invite,
  setView,
  close,
}: {
  view: View | null;
  next?: string;
  verified: boolean;
  verifyError: boolean;
  token?: string;
  invite: boolean;
  setView: (v: View) => void;
  close: () => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const tl = useTranslations("auth.login");
  const tr = useTranslations("auth.register");
  const tf = useTranslations("auth.forgot");
  const ts = useTranslations("auth.reset");
  const qc = useQueryClient();
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement | null>(null);
  // After a password is saved: the sign-in view opens with these.
  const [resetDone, setResetDone] = useState<{
    email: string | null;
    invite: boolean;
  } | null>(null);

  const open = view !== null;
  const tab: Tab | null = view === "login" || view === "register" ? view : null;

  // Lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus the first field shortly after opening.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const el = cardRef.current?.querySelector<HTMLElement>(
        "input, button, [href]",
      );
      el?.focus();
    }, 60);
    return () => window.clearTimeout(id);
  }, [open, view]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !cardRef.current) return;
    const f = cardRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (f.length === 0) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function handleLoginSuccess(user: AuthedUser) {
    qc.invalidateQueries({ queryKey: ["session"] });
    qc.invalidateQueries({ queryKey: ["cart"] });
    // Same rules as the standalone /login page: an explicit `next` wins,
    // otherwise staff are routed to their own surface (admins → /admin,
    // sellers → /seller). A regular customer gets null and simply stays on the
    // page they were already on.
    const dest = postLoginDestination(user, next);
    setResetDone(null);
    close();
    if (dest) router.replace(dest);
    // Always refresh so the new auth cookies take effect: this clears the App
    // Router cache. Without it, navigating to a protected route (e.g. /admin)
    // can render the stale pre-login RSC and bounce straight back to the modal
    // — the "login loop" where only a manual browser refresh recovers.
    router.refresh();
  }

  const enter = reduce ? { duration: 0 } : { duration: 0.3, ease: EASE };
  const exit = reduce ? { duration: 0 } : { duration: 0.2, ease: EASE };

  const heading =
    view === "forgot"
      ? { title: tf("title"), description: tf("description") }
      : view === "reset"
        ? invite
          ? { title: ts("inviteTitle"), description: ts("inviteDescription") }
          : { title: ts("title"), description: ts("description") }
        : view === "register"
          ? { title: tr("title"), description: tr("description") }
          : { title: tl("title"), description: tl("description") };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="auth-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={exit.duration === 0 ? exit : { duration: 0.22 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "grid",
            placeItems: "center",
            padding: "var(--s-5)",
            background:
              "color-mix(in oklab, var(--slate-900) 52%, transparent)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            onKeyDown={onKeyDown}
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
            transition={enter}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 412,
              /* Bound to the viewport (dvh tracks the mobile browser chrome) and
                 let the body scroll, so a tall form / short or landscape phone
                 never strands the submit button off-screen. */
              maxHeight: "calc(100dvh - (2 * var(--s-5)))",
              display: "flex",
              flexDirection: "column",
              background: "var(--color-surface)",
              borderRadius: "var(--r-xl)",
              overflow: "hidden",
              // Ring (not a border) so children clip cleanly to the radius;
              // layered shadow for depth.
              boxShadow:
                "0 0 0 1px color-mix(in oklab, var(--slate-900) 8%, transparent), 0 2px 8px rgba(10,31,44,.06), 0 18px 40px -14px rgba(10,31,44,.26), 0 48px 90px -36px rgba(10,31,44,.34)",
            }}
          >
            {/* Header: teal gradient + constellation motif + brand + close */}
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                flexShrink: 0,
                padding: "18px 20px 20px",
                background:
                  "linear-gradient(135deg, var(--teal-600), var(--teal-800))",
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage:
                    "radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)",
                  backgroundSize: "15px 15px",
                  maskImage:
                    "radial-gradient(130% 150% at 0% 0%, #000, transparent 72%)",
                  WebkitMaskImage:
                    "radial-gradient(130% 150% at 0% 0%, #000, transparent 72%)",
                }}
              />
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: "var(--fs-h5)",
                    letterSpacing: "var(--tracking-heading)",
                    color: "white",
                  }}
                >
                  Spiber <span style={{ color: "var(--orange-300)" }}>Med</span>
                </span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="auth-close"
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    border: "none",
                    background: "rgba(255,255,255,0.16)",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M6 6l12 12M6 18L18 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body — scrolls within the dvh-bounded card on short viewports. */}
            <div
              style={{
                padding: "var(--s-6)",
                flex: "1 1 auto",
                minHeight: 0,
                overflowY: "auto",
              }}
            >
              {tab !== null && (
                <div
                  role="tablist"
                  aria-label="Authentication"
                  style={{
                    position: "relative",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    padding: 5,
                    borderRadius: "var(--r-pill)",
                    background: "var(--color-surface-2)",
                  }}
                >
                  {(["login", "register"] as Tab[]).map((tb) => {
                    const active = tab === tb;
                    return (
                      <button
                        key={tb}
                        role="tab"
                        aria-selected={active}
                        type="button"
                        onClick={() => setView(tb)}
                        style={{
                          position: "relative",
                          zIndex: 1,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          padding: "9px 12px",
                          borderRadius: "var(--r-pill)",
                          fontSize: "var(--fs-small)",
                          fontWeight: 600,
                          fontFamily: "inherit",
                          color: active
                            ? "var(--color-brand-deep)"
                            : "var(--color-text-muted)",
                          transition: "color .2s",
                        }}
                      >
                        {active && (
                          <motion.span
                            layoutId="auth-tab-pill"
                            transition={
                              reduce
                                ? { duration: 0 }
                                : { duration: 0.28, ease: EASE }
                            }
                            style={{
                              position: "absolute",
                              inset: 0,
                              zIndex: -1,
                              borderRadius: "var(--r-pill)",
                              background: "var(--color-surface)",
                              boxShadow:
                                "0 1px 2px rgba(10,31,44,.10), 0 2px 6px rgba(10,31,44,.06)",
                            }}
                          />
                        )}
                        {tb === "login" ? tl("submit") : tr("submit")}
                      </button>
                    );
                  })}
                </div>
              )}

              <div
                style={{
                  marginTop: tab !== null ? "var(--s-5)" : 0,
                  marginBottom: "var(--s-5)",
                }}
              >
                <h2
                  id="auth-modal-title"
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-h4)",
                    color: "var(--color-text-strong)",
                  }}
                >
                  {heading.title}
                </h2>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: "var(--fs-body-sm)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {heading.description}
                </p>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={view}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={
                    reduce ? { duration: 0 } : { duration: 0.2, ease: EASE }
                  }
                >
                  {view === "login" ? (
                    <LoginForm
                      next={
                        next ?? (resetDone?.invite ? "/admin/me" : undefined)
                      }
                      verified={verified}
                      verifyError={verifyError}
                      notice={
                        resetDone
                          ? resetDone.invite
                            ? ts("inviteSuccess")
                            : ts("success")
                          : undefined
                      }
                      defaultEmail={resetDone?.email ?? undefined}
                      onSuccess={handleLoginSuccess}
                      onForgot={() => setView("forgot")}
                      submitStyle={ORANGE_SUBMIT}
                    />
                  ) : view === "register" ? (
                    <RegisterForm
                      onSignIn={() => setView("login")}
                      submitStyle={ORANGE_SUBMIT}
                    />
                  ) : view === "forgot" ? (
                    <ForgotPasswordForm
                      onBack={() => setView("login")}
                      submitStyle={ORANGE_SUBMIT}
                    />
                  ) : (
                    <ResetPasswordForm
                      token={token}
                      invite={invite}
                      onDone={(email) => {
                        setResetDone({ email, invite });
                        setView("login");
                      }}
                      onForgot={() => setView("forgot")}
                      onBack={() => setView("login")}
                      submitStyle={ORANGE_SUBMIT}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <style>{`.auth-close:hover { background: rgba(255,255,255,0.28); }`}</style>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
