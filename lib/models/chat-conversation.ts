import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { ChatStatus } from "@/lib/schemas/chat";

/**
 * A chatbot conversation: an ordered transcript of user/bot turns, an optional
 * captured lead, and the engine's slot-filling state. Soft-deletable and
 * timestamped, with a lightweight status pipeline for admin triage
 * (open → lead → closed). Transcript is capped in the repo (last N turns).
 */
export type ChatTurnRole = "user" | "bot";

export interface IChatTurn {
  role: ChatTurnRole;
  text: string;
  /** Resolved intent id (bot turns) — for admin triage / analytics. */
  intent?: string;
  at: Date;
}

export interface IChatLead {
  leadNumber: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  at: Date;
}

export interface IChatConversation {
  ref: string;
  /** Anonymous client id (localStorage) — links turns from the same browser. */
  sessionId?: string;
  userId?: Types.ObjectId | string | null;
  locale?: string;
  status: ChatStatus;
  messages: IChatTurn[];
  lead?: IChatLead | null;
  state?: { pendingIntent?: string | null; slots?: Record<string, string> };
  meta?: { ip?: string; userAgent?: string; path?: string };
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const turnSchema = new Schema<IChatTurn>(
  {
    role: { type: String, enum: ["user", "bot"], required: true },
    text: { type: String, required: true },
    intent: { type: String },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const leadSchema = new Schema<IChatLead>(
  {
    leadNumber: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    message: { type: String },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const chatConversationSchema = new Schema<IChatConversation>(
  {
    ref: { type: String, required: true, unique: true },
    sessionId: { type: String, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    locale: { type: String },
    status: {
      type: String,
      enum: ["open", "lead", "closed"],
      default: "open",
      index: true,
    },
    messages: { type: [turnSchema], default: [] },
    lead: { type: leadSchema, default: null },
    state: {
      type: new Schema(
        { pendingIntent: String, slots: Schema.Types.Mixed },
        { _id: false },
      ),
      default: undefined,
    },
    meta: {
      type: new Schema(
        { ip: String, userAgent: String, path: String },
        { _id: false },
      ),
      default: undefined,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "chat_conversations", timestamps: true },
);

chatConversationSchema.index({ status: 1, updatedAt: -1 });
chatConversationSchema.index({ updatedAt: -1 });
chatConversationSchema.index({ "lead.email": 1 });

export const ChatConversation: Model<IChatConversation> =
  (mongoose.models.ChatConversation as Model<IChatConversation>) ??
  mongoose.model<IChatConversation>("ChatConversation", chatConversationSchema);
