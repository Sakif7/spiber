/**
 * Pluggable chat-engine seam (mirrors `getMailer()` / `getPaymentProvider()`).
 * `CHAT_PROVIDER` selects the engine; default is the dependency-free heuristic
 * engine. An LLM (Claude) provider drops in via env with no wiring changes.
 */
import type { ChatProvider } from "./types";
import { heuristicProvider } from "./heuristic/engine";
import { createLlmProvider } from "./llm/provider";
import { logger } from "@/lib/log";

export type { ChatProvider } from "./types";

let cached: ChatProvider | null = null;

export function getChatProvider(): ChatProvider {
  if (cached) return cached;
  const name = process.env.CHAT_PROVIDER?.trim() || "heuristic";
  switch (name) {
    case "heuristic":
      cached = heuristicProvider;
      break;
    case "llm":
    case "claude":
      cached = createLlmProvider();
      break;
    default:
      logger.warn(`CHAT_PROVIDER="${name}" unknown; using heuristic`);
      cached = heuristicProvider;
  }
  return cached;
}
