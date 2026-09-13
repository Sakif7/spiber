import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  signAccessToken,
  signRefreshToken,
  signVerifyToken,
  signResetToken,
  verifyRefreshToken,
  verifyPurposeToken,
} from "@/lib/auth/tokens";
import {
  findUserByEmail,
  findUserById,
  createUser,
  markEmailVerified,
  updatePasswordHash,
} from "@/lib/repositories/users.repo";
import { getMailer } from "@/lib/mailer";
import { renderEmail } from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { logger } from "@/lib/log";
import type { Role } from "@/lib/schemas/user";
import type {
  RegisterInput,
  LoginInput,
  PasswordResetRequestInput,
  PasswordResetConfirmInput,
} from "@/lib/schemas/user";
import type { IUser } from "@/lib/models/user";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  emailVerified: boolean;
};

type Tokens = { accessToken: string; refreshToken: string };

function toAuthUser(doc: IUser & { _id: unknown }): AuthUser {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    // Spread to a plain array: a live Mongoose array is an exotic object that
    // jose's payload serialization (structuredClone) rejects with DataCloneError.
    roles: [...doc.roles],
    emailVerified: doc.emailVerified,
  };
}

function issueTokens(user: AuthUser, tokenVersion: number): Promise<Tokens> {
  return Promise.all([
    signAccessToken({ sub: user.id, email: user.email, roles: user.roles }),
    signRefreshToken(user.id, tokenVersion),
  ]).then(([accessToken, refreshToken]) => ({ accessToken, refreshToken }));
}

/** Emails listed here are bootstrapped to super_admin on registration. */
function bootstrapRoles(email: string): Role[] {
  const admins = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase()) ? ["super_admin"] : ["customer"];
}

const localePrefix = (locale?: string) =>
  locale === "bn" ? "bn" : locale === "ja" ? "ja" : "en";

// A throwaway cost-12 bcrypt hash compared against when the email is unknown, so
// login takes the same time whether or not the account exists (anti-enumeration).
const DUMMY_PASSWORD_HASH =
  "$2b$12$CJ9ihBPwQ1zLkvmsoNImC.Eo/M4P8B1kyzIe5TcDEEiiG1Kdn98j.";

// ---- Register ----

export type RegisterResult =
  | { ok: true; user: AuthUser }
  | { ok: false; code: "email_taken" };

async function sendVerificationEmail(
  user: { id: string; name: string; email: string },
  locale: string,
): Promise<void> {
  const token = await signVerifyToken(user.id);
  const link = `${siteConfig.url}/api/auth/verify-email?token=${encodeURIComponent(token)}&locale=${locale}`;
  const verifyEmail = renderEmail({
    accent: "teal",
    preheader: `Confirm your email to activate your ${siteConfig.brand} account.`,
    eyebrow: "Welcome",
    heading: `Welcome to ${siteConfig.brand}`,
    greetingName: user.name,
    paragraphs: [
      "Thanks for creating an account. Please confirm your email address to activate it.",
    ],
    button: { label: "Confirm your email", url: link },
    outro: [
      "This link expires in 24 hours. If you didn't create this account, you can ignore this email.",
    ],
  });
  await getMailer().send({
    to: user.email,
    subject: `Verify your ${siteConfig.brand} account`,
    html: verifyEmail.html,
    text: verifyEmail.text,
    attachments: verifyEmail.attachments,
  });
}

export async function register(input: RegisterInput): Promise<RegisterResult> {
  const existing = await findUserByEmail(input.email);
  if (existing) return { ok: false, code: "email_taken" };

  const passwordHash = await hashPassword(input.password);
  const locale = localePrefix(input.locale);
  const doc = await createUser({
    name: input.name,
    email: input.email,
    passwordHash,
    roles: bootstrapRoles(input.email),
    locale,
  });
  const user = toAuthUser(doc);
  await sendVerificationEmail(user, locale);
  return { ok: true, user };
}

/**
 * Re-send the verification email. Always resolves ok (anti-enumeration): the
 * email is only actually sent when the account exists, is enabled, and is not
 * yet verified. Callers must rate-limit.
 */
export async function resendVerification(
  email: string,
  locale?: string,
): Promise<{ ok: true }> {
  const doc = await findUserByEmail(email);
  if (doc && !doc.disabled && !doc.emailVerified) {
    await sendVerificationEmail(toAuthUser(doc), localePrefix(locale)).catch(
      (err) => logger.warn("resend verification email failed", { err }),
    );
  } else {
    logger.info("verification resend requested (no-op)");
  }
  return { ok: true };
}

// ---- Verify email ----

export async function verifyEmail(token: string): Promise<{ ok: boolean }> {
  const claims = await verifyPurposeToken(token, "verify");
  if (!claims) return { ok: false };
  await markEmailVerified(claims.sub);
  return { ok: true };
}

// ---- Login ----

export type LoginResult =
  | { ok: true; user: AuthUser; tokens: Tokens }
  | { ok: false; code: "invalid_credentials" | "email_not_verified" };

export async function login(input: LoginInput): Promise<LoginResult> {
  const doc = await findUserByEmail(input.email);
  // Always run a bcrypt comparison — even when the user doesn't exist — so login
  // timing doesn't reveal whether an email is registered (enumeration oracle).
  const valid = await verifyPassword(
    input.password,
    doc?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!doc || !valid) return { ok: false, code: "invalid_credentials" };
  if (doc.disabled) return { ok: false, code: "invalid_credentials" };
  if (!doc.emailVerified) return { ok: false, code: "email_not_verified" };

  const user = toAuthUser(doc);
  const tokens = await issueTokens(user, doc.tokenVersion ?? 0);
  return { ok: true, user, tokens };
}

// ---- Refresh ----

export type RefreshResult =
  | { ok: true; user: AuthUser; tokens: Tokens }
  | { ok: false };

export async function refresh(refreshToken: string): Promise<RefreshResult> {
  const claims = await verifyRefreshToken(refreshToken);
  if (!claims) return { ok: false };
  const doc = await findUserById(claims.sub);
  if (!doc || doc.disabled) return { ok: false };
  // Reject a refresh token issued before the current tokenVersion (revoked by a
  // password reset / forced logout) — this is the "log out everywhere" kill switch.
  if ((doc.tokenVersion ?? 0) !== claims.tokenVersion) return { ok: false };
  const user = toAuthUser(doc);
  const tokens = await issueTokens(user, doc.tokenVersion ?? 0);
  return { ok: true, user, tokens };
}

// ---- Password reset ----

export async function requestPasswordReset(
  input: PasswordResetRequestInput,
): Promise<{ ok: true }> {
  const doc = await findUserByEmail(input.email);
  // Always return ok to avoid leaking which emails are registered.
  if (doc) {
    const locale = localePrefix(input.locale);
    const token = await signResetToken(String(doc._id), doc.tokenVersion ?? 0);
    const link = `${siteConfig.url}/${locale}/reset-password?token=${encodeURIComponent(token)}`;
    const resetEmail = renderEmail({
      accent: "teal",
      preheader: `Reset your ${siteConfig.brand} password.`,
      eyebrow: "Password reset",
      heading: "Reset your password",
      greetingName: doc.name,
      paragraphs: [
        "We received a request to reset your password. Click the button below to choose a new one.",
      ],
      button: { label: "Reset password", url: link },
      outro: [
        "This link expires in 1 hour and can be used once. If you didn't request this, you can safely ignore this email — your password won't change.",
      ],
    });
    await getMailer().send({
      to: doc.email,
      subject: `Reset your ${siteConfig.brand} password`,
      html: resetEmail.html,
      text: resetEmail.text,
      attachments: resetEmail.attachments,
    });
  } else {
    logger.info("password reset requested for unknown email");
  }
  return { ok: true };
}

// ---- Change password (logged-in) ----

export type ChangePasswordResult =
  | { ok: true; user: AuthUser; tokens: Tokens }
  | { ok: false; code: "not_found" | "invalid_current" };

/**
 * Changes the password of a logged-in user. Bumps tokenVersion (logging every
 * OTHER session out) and returns fresh tokens carrying the new version so the
 * current session survives — set them as cookies in the calling route.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const doc = await findUserById(userId);
  if (!doc || doc.disabled) return { ok: false, code: "not_found" };
  const valid = await verifyPassword(currentPassword, doc.passwordHash);
  if (!valid) return { ok: false, code: "invalid_current" };

  const passwordHash = await hashPassword(newPassword);
  await updatePasswordHash(userId, passwordHash); // $inc tokenVersion
  const user = toAuthUser(doc);
  const tokens = await issueTokens(user, (doc.tokenVersion ?? 0) + 1);
  return { ok: true, user, tokens };
}

export async function resetPassword(
  input: PasswordResetConfirmInput,
): Promise<{ ok: false } | { ok: true; sub: string; invite: boolean }> {
  // The same form serves a forgotten password and a new employee's invite;
  // the token's purpose says which, and an invite is accepted the same way.
  let invite = false;
  let claims = await verifyPurposeToken(input.token, "reset");
  if (!claims) {
    claims = await verifyPurposeToken(input.token, "invite");
    invite = claims !== null;
  }
  if (!claims) return { ok: false };
  const doc = await findUserById(claims.sub);
  if (!doc) return { ok: false };
  // Reject a stale/already-used reset link: once a reset succeeds, tokenVersion
  // is bumped, so the same link (carrying the old tokenVersion) no longer matches.
  if ((doc.tokenVersion ?? 0) !== claims.tokenVersion) return { ok: false };
  const passwordHash = await hashPassword(input.password);
  await updatePasswordHash(claims.sub, passwordHash); // bumps tokenVersion
  return { ok: true, sub: claims.sub, invite };
}
