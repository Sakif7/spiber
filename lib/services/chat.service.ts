import { connectToDatabase } from "@/lib/db/connect";
import { getChatProvider } from "@/lib/chat";
import type { ChatReply, ChatState } from "@/lib/chat/types";
import {
  appendTurns,
  attachLead,
  createConversation,
} from "@/lib/repositories/chat.repo";
import type {
  IChatConversation,
  IChatLead,
  IChatTurn,
} from "@/lib/models/chat-conversation";
import { chatConversationRef, chatLeadNumber } from "@/lib/ids";
import { asLocale } from "@/lib/i18n/intl-locale";
import { getMailer } from "@/lib/mailer";
import { renderEmail } from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { CONTACT } from "@/lib/contact";
import { logger } from "@/lib/log";
import type { ChatLeadInput } from "@/lib/schemas/chat";

export type ChatMeta = { ip?: string; userAgent?: string; path?: string };

export type HandleChatInput = {
  message: string;
  conversationId?: string;
  locale?: string;
  path?: string;
  loggedIn?: boolean;
  userId?: string | null;
  state?: ChatState;
};

export type HandleChatResult = {
  conversationId: string;
  reply: ChatReply;
  state?: ChatState;
};

/** Only persist meaningful state (drop empty `{}` the engine returns to clear). */
function persistableState(
  state: ChatState | undefined,
): IChatConversation["state"] | undefined {
  if (state && (state.pendingIntent || state.slots)) return state;
  return undefined;
}

/**
 * Run one chat turn through the active provider and persist the transcript.
 * The bot always replies even if persistence fails (DB best-effort) — the
 * conversation id is still returned so the client keeps continuity.
 */
export async function handleChatTurn(
  input: HandleChatInput,
  meta?: ChatMeta,
): Promise<HandleChatResult> {
  const locale = asLocale(input.locale);
  const provider = getChatProvider();
  const { reply, state } = await provider.respond(input.message, {
    locale,
    path: input.path,
    loggedIn: input.loggedIn,
    state: input.state,
  });

  const now = new Date();
  const turns: IChatTurn[] = [
    { role: "user", text: input.message.slice(0, 500), at: now },
    { role: "bot", text: reply.text, intent: reply.intent, at: now },
  ];
  const statePersist = persistableState(state);

  try {
    if (input.conversationId) {
      const updated = await appendTurns(
        input.conversationId,
        turns,
        statePersist,
      );
      if (updated) {
        return { conversationId: input.conversationId, reply, state };
      }
      // Stale/unknown id (e.g. DB reset) → start a fresh conversation.
    }
    const ref = chatConversationRef();
    await createConversation({
      ref,
      userId: input.userId ?? null,
      locale,
      status: "open",
      messages: turns,
      state: statePersist,
      meta: meta && (meta.ip || meta.userAgent || meta.path) ? meta : undefined,
    });
    return { conversationId: ref, reply, state };
  } catch (e) {
    logger.warn("chat persistence failed", e);
    return {
      conversationId: input.conversationId || chatConversationRef(),
      reply,
      state,
    };
  }
}

/**
 * Capture a lead from the widget: attach it to the conversation (or start one),
 * then notify the team + send the visitor a localized acknowledgement. Email
 * failures are logged, never thrown (mirrors the inquiry/contact pipelines).
 */
export async function captureChatLead(
  input: ChatLeadInput,
  meta?: ChatMeta,
): Promise<{ leadNumber: string; conversationId: string }> {
  await connectToDatabase();
  const lead: IChatLead = {
    leadNumber: chatLeadNumber(),
    name: input.name,
    email: input.email,
    phone: input.phone,
    message: input.message,
    at: new Date(),
  };

  let conversation: IChatConversation | null = null;
  let ref = input.conversationId ?? "";
  if (input.conversationId) {
    conversation = await attachLead(input.conversationId, lead);
  }
  if (!conversation) {
    // No (live) conversation — record the lead as its own conversation.
    ref = chatConversationRef();
    const created = await createConversation({
      ref,
      locale: input.locale,
      status: "lead",
      lead,
      messages: input.message
        ? [{ role: "user", text: input.message, at: lead.at }]
        : [],
      meta: meta && (meta.ip || meta.userAgent) ? meta : undefined,
    });
    conversation = created.toObject();
  }

  await Promise.allSettled([
    notifyTeam(lead, conversation),
    ackVisitor(lead, input.locale),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === "rejected")
        logger.warn("chat lead email failed", r.reason);
    }
  });

  return { leadNumber: lead.leadNumber, conversationId: ref };
}

function teamRecipient(): string {
  return (
    process.env.CHAT_TEAM_EMAIL?.trim() ||
    process.env.CONTACT_TEAM_EMAIL?.trim() ||
    CONTACT.generalEmail
  );
}

/** Last few turns as a readable transcript excerpt for the team email. */
function transcriptExcerpt(conversation: IChatConversation | null): string[] {
  const msgs = conversation?.messages ?? [];
  return msgs
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Visitor" : "Bot"}: ${m.text}`);
}

async function notifyTeam(
  lead: IChatLead,
  conversation: IChatConversation | null,
) {
  const excerpt = transcriptExcerpt(conversation);
  const built = renderEmail({
    accent: "teal",
    preheader: `New chatbot lead from ${lead.name}`,
    eyebrow: "New chatbot lead",
    heading: "New lead from the website chat",
    paragraphs: [
      `${lead.name} left their details via the website chat assistant. Reply to ${lead.email}${lead.phone ? ` or call ${lead.phone}` : ""}.`,
      ...(lead.message ? [lead.message] : []),
      ...(excerpt.length ? ["Recent conversation:", ...excerpt] : []),
    ],
    details: {
      title: "Lead",
      rows: [
        { label: "Name", value: lead.name, strong: true },
        { label: "Email", value: lead.email },
        ...(lead.phone ? [{ label: "Phone", value: lead.phone }] : []),
        { label: "Reference", value: lead.leadNumber },
      ],
    },
  });
  await getMailer().send({
    to: teamRecipient(),
    subject: `New chatbot lead — ${lead.name} [${lead.leadNumber}]`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function ackVisitor(lead: IChatLead, localeInput?: string) {
  const brand = siteConfig.brand;
  const locale = asLocale(localeInput);
  const c =
    locale === "ja"
      ? {
          subject: `お問い合わせを受け付けました — ${brand}`,
          eyebrow: "受付完了",
          heading: "ありがとうございます",
          paragraph: `${lead.name} 様、${brand} のチャットからご連絡いただきありがとうございます。担当チームより営業時間内に折り返しご連絡いたします。`,
          outro: `お急ぎの場合は ${CONTACT.phone}（土〜木、09:00〜18:00 BST）までお電話ください。`,
          refLabel: "受付番号",
        }
      : locale === "bn"
        ? {
            subject: `আপনার তথ্য পেয়েছি — ${brand}`,
            eyebrow: "গৃহীত হয়েছে",
            heading: "ধন্যবাদ",
            paragraph: `প্রিয় ${lead.name}, ${brand}-এর চ্যাটে যোগাযোগ করার জন্য ধন্যবাদ। আমাদের টিম কর্মঘণ্টায় শীঘ্রই আপনার সাথে যোগাযোগ করবে।`,
            outro: `জরুরি প্রয়োজনে কল করুন ${CONTACT.phone} (শনি–বৃহস্পতি, ০৯:০০–১৮:০০ BST)।`,
            refLabel: "রেফারেন্স",
          }
        : {
            subject: `We've received your details — ${brand}`,
            eyebrow: "Received",
            heading: "Thanks for reaching out",
            paragraph: `Hi ${lead.name}, thanks for chatting with ${brand}. Our team will get back to you during business hours.`,
            outro: `If it's urgent, call us at ${CONTACT.phone} (Sat–Thu, 09:00–18:00 BST).`,
            refLabel: "Reference",
          };
  const built = renderEmail({
    accent: "teal",
    preheader: c.paragraph,
    eyebrow: c.eyebrow,
    heading: c.heading,
    paragraphs: [c.paragraph],
    details: { rows: [{ label: c.refLabel, value: lead.leadNumber }] },
    outro: [c.outro],
  });
  await getMailer().send({
    to: lead.email,
    subject: c.subject,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}
