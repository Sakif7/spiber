/**
 * LLM chat provider (future drop-in). Selected via `CHAT_PROVIDER=llm`.
 *
 * This is the forward-compatible seam: the day an `ANTHROPIC_API_KEY` (and the
 * Anthropic SDK) are added, implement `answerWithClaude` to run a tool-use loop
 * over the SAME tool registry the heuristic engine uses
 * (`lib/chat/heuristic/tools.ts` — searchCatalog / lookupOrder / lookupCase),
 * returning a `ChatReply`. Until then this delegates to the heuristic engine so
 * `CHAT_PROVIDER=llm` never breaks — it just behaves like the default.
 *
 * Recommended default model when wiring Claude: `claude-opus-4-8` (or a smaller
 * tier for cost) — see the Anthropic docs. Keep the system prompt grounded in
 * the same knowledge base (`lib/chat/heuristic/content.ts`) so the two providers
 * stay consistent.
 */
import type { ChatProvider, ChatTurnContext, ChatTurnResult } from "../types";
import { heuristicProvider } from "../heuristic/engine";
import { logger } from "@/lib/log";

const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

async function answerWithClaude(
  message: string,
  ctx: ChatTurnContext,
): Promise<ChatTurnResult> {
  // TODO: implement the Claude tool-use loop here (Anthropic SDK not yet a dep),
  // driving the same tool registry as `lib/chat/heuristic/tools.ts`. The params
  // below are the eventual inputs (referenced to keep the signature stable).
  void message;
  void ctx;
  throw new Error("llm_not_implemented");
}

export function createLlmProvider(): ChatProvider {
  // No key configured → transparently behave as the heuristic engine.
  if (!hasKey()) return heuristicProvider;

  return {
    id: "llm",
    async respond(message, ctx) {
      try {
        return await answerWithClaude(message, ctx);
      } catch (e) {
        logger.warn("chat llm provider failed; falling back to heuristic", e);
        return heuristicProvider.respond(message, ctx);
      }
    },
  };
}
