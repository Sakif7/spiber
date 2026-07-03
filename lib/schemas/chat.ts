import { z } from "zod";

/**
 * Zod schemas for the chatbot: the public turn request, the lead-capture form,
 * and the admin status update. Shared source of truth for the API + model.
 */

/** Lightweight slot-filling state echoed between client and engine. */
export const chatStateSchema = z.object({
  pendingIntent: z.string().max(40).nullable().optional(),
  slots: z.record(z.string().max(40), z.string().max(160)).optional(),
});
export type ChatStateInput = z.infer<typeof chatStateSchema>;

/** POST /api/chat body. */
export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(500),
  conversationId: z.string().trim().max(60).optional(),
  locale: z.string().max(8).optional(),
  path: z.string().max(300).optional(),
  state: chatStateSchema.optional(),
});
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

/** POST /api/chat/lead body (conversation optional; a lead can start one). */
export const chatLeadSchema = z.object({
  conversationId: z.string().trim().max(60).optional(),
  name: z.string().trim().min(1).max(120),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.email(),
  ),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2000).optional(),
  locale: z.string().max(8).optional(),
  /** Honeypot — non-empty means a bot; the route silently no-ops. */
  website: z.string().max(200).optional(),
});
export type ChatLeadInput = z.infer<typeof chatLeadSchema>;

export const chatStatusEnum = z.enum(["open", "lead", "closed"]);
export type ChatStatus = z.infer<typeof chatStatusEnum>;

/** Admin PATCH — triage a conversation. */
export const chatUpdateSchema = z.object({
  status: chatStatusEnum.optional(),
});
export type ChatUpdateInput = z.infer<typeof chatUpdateSchema>;
