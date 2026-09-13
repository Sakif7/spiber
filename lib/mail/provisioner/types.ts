/**
 * Creating and re-keying accounts on the company mail server.
 *
 * Mirrors the payments seam: one interface, a provider per environment,
 * and an unknown provider name throws rather than silently pretending.
 */
export type MailAccount = { address: string; quota: string | null };

export type ProvisionError =
  | "exists"
  | "not_found"
  | "bad_password"
  | "bad_quota"
  | "bad_address"
  | "wrong_domain"
  /** The sidecar refused our secret. */
  | "unauthorised"
  /** No provisioner configured for this environment. */
  | "not_configured"
  /** Network / 5xx / anything else. */
  | "unavailable";

export class MailProvisionError extends Error {
  constructor(
    public readonly code: ProvisionError,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "MailProvisionError";
  }
}

export interface MailProvisioner {
  /** Recorded on the mailbox row so a simulated account is never mistaken for a real one. */
  readonly name: string;
  list(): Promise<MailAccount[]>;
  get(address: string): Promise<MailAccount | null>;
  /** Throws `exists` when the address is taken. `quota` as "5G" / "500M". */
  create(input: {
    address: string;
    password: string;
    quota?: string;
  }): Promise<void>;
  setPassword(address: string, password: string): Promise<void>;
  setQuota(address: string, quota: string): Promise<void>;
  remove(address: string): Promise<void>;
}
