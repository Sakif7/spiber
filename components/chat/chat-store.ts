"use client";

/**
 * External store for the chat widget — the single source of truth, backed by
 * localStorage, read via `useSyncExternalStore`. This avoids set-state-in-effect
 * (the repo's React-Compiler lint) entirely: mutations flow through these
 * functions, which update the in-memory snapshot, notify subscribers and
 * persist. `open` is intentionally NOT persisted (the widget always starts
 * closed), so the server + first-client snapshots agree and there's no
 * hydration mismatch.
 */
import type { ChatReply, ChatState } from "@/lib/chat/types";

export type UiMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
  /** Full structured reply for bot turns (cards / actions / suggestions). */
  reply?: ChatReply;
};

export type ChatSnapshot = {
  open: boolean;
  conversationId: string | null;
  chatState: ChatState;
  messages: UiMessage[];
};

const STORAGE_KEY = "spiber:chat:v1";
const MAX_STORED = 40;

const SERVER_SNAPSHOT: ChatSnapshot = {
  open: false,
  conversationId: null,
  chatState: {},
  messages: [],
};

let state: ChatSnapshot = SERVER_SNAPSHOT;
let snapshot: ChatSnapshot = SERVER_SNAPSHOT;
let loaded = false;
const listeners = new Set<() => void>();

function mkId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        conversationId: state.conversationId,
        chatState: state.chatState,
        messages: state.messages.slice(-MAX_STORED),
      }),
    );
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<ChatSnapshot>;
    state = {
      open: false,
      conversationId: parsed.conversationId ?? null,
      chatState: parsed.chatState ?? {},
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
    snapshot = state;
  } catch {
    /* corrupt payload — ignore */
  }
}

function emit() {
  snapshot = { ...state };
  for (const l of listeners) l();
}

/* ── useSyncExternalStore contract ───────────────────────────────────────── */

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSnapshot(): ChatSnapshot {
  load();
  return snapshot;
}

export function getServerSnapshot(): ChatSnapshot {
  return SERVER_SNAPSHOT;
}

/* ── Mutations ───────────────────────────────────────────────────────────── */

export function setOpen(open: boolean) {
  if (state.open === open) return;
  state = { ...state, open };
  emit();
}

export function toggleOpen() {
  setOpen(!state.open);
}

export function addUserMessage(text: string) {
  state = {
    ...state,
    messages: [...state.messages, { id: mkId(), role: "user", text }],
  };
  emit();
  persist();
}

export function addBotMessage(reply: ChatReply) {
  state = {
    ...state,
    messages: [
      ...state.messages,
      { id: mkId(), role: "bot", text: reply.text, reply },
    ],
  };
  emit();
  persist();
}

export function setConversation(conversationId: string, chatState: ChatState) {
  state = { ...state, conversationId, chatState };
  emit();
  persist();
}

export function resetConversation() {
  state = { ...state, conversationId: null, chatState: {}, messages: [] };
  emit();
  persist();
}

export function getConversationId(): string | null {
  return state.conversationId;
}

export function getChatState(): ChatState {
  return state.chatState;
}
