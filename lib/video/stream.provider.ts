import { SignJWT, importPKCS8 } from "jose";
import { logger } from "@/lib/log";
import type { VideoProvider } from "./types";
import type { VideoStatus } from "@/lib/schemas/academy";

/**
 * Cloudflare Stream provider. Server-side basic upload (≤200MB; switch to TUS
 * for larger as a follow-up), status polling, and signed HLS playback.
 *
 * Env: CF_STREAM_ACCOUNT_ID, CF_STREAM_API_TOKEN, and (for signed playback)
 * CF_STREAM_SIGNING_KEY (PKCS8 PEM, base64 or raw) + CF_STREAM_SIGNING_KEY_ID.
 *
 * NOTE: exercised only when real credentials are configured; the local
 * provider is the default and covers dev/CI.
 */
const API = "https://api.cloudflare.com/client/v4";
// Iframe embed handles adaptive HLS across browsers without a client player lib.
const IFRAME = "https://iframe.videodelivery.net";

function mapState(state: string | undefined): VideoStatus {
  switch (state) {
    case "ready":
      return "ready";
    case "error":
      return "error";
    case "inprogress":
    case "queued":
    case "downloading":
      return "processing";
    default:
      return "processing";
  }
}

function accountId() {
  return process.env.CF_STREAM_ACCOUNT_ID!;
}
function authHeaders() {
  return { Authorization: `Bearer ${process.env.CF_STREAM_API_TOKEN!}` };
}

export function createStreamVideoProvider(): VideoProvider {
  return {
    name: "stream",
    playbackKind: "stream",

    async upload({ body, contentType, filename }) {
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array(body)], { type: contentType }),
        filename,
      );
      if (process.env.CF_STREAM_SIGNING_KEY) {
        form.append("requireSignedURLs", "true");
      }
      const res = await fetch(`${API}/accounts/${accountId()}/stream`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        result?: {
          uid?: string;
          status?: { state?: string };
          duration?: number;
        };
      } | null;
      const uid = json?.result?.uid;
      if (!res.ok || !uid) {
        throw new Error(`Cloudflare Stream upload failed (${res.status})`);
      }
      return {
        uid,
        status: mapState(json?.result?.status?.state),
        durationSec: json?.result?.duration
          ? Math.round(json.result.duration)
          : undefined,
      };
    },

    async getStatus(uid) {
      const res = await fetch(`${API}/accounts/${accountId()}/stream/${uid}`, {
        headers: authHeaders(),
      });
      const json = (await res.json().catch(() => null)) as {
        result?: { status?: { state?: string }; duration?: number };
      } | null;
      return {
        status: mapState(json?.result?.status?.state),
        durationSec: json?.result?.duration
          ? Math.round(json.result.duration)
          : undefined,
      };
    },

    async getPlaybackUrl(uid) {
      const pem = process.env.CF_STREAM_SIGNING_KEY;
      const kid = process.env.CF_STREAM_SIGNING_KEY_ID;
      if (pem && kid) {
        try {
          const decoded = pem.includes("BEGIN")
            ? pem
            : Buffer.from(pem, "base64").toString("utf8");
          const key = await importPKCS8(decoded, "RS256");
          const token = await new SignJWT({})
            .setProtectedHeader({ alg: "RS256", kid })
            .setSubject(uid)
            .setIssuedAt()
            .setExpirationTime("2h")
            .sign(key);
          return `${IFRAME}/${token}`;
        } catch (e) {
          logger.warn(
            "Stream signed-URL generation failed; serving unsigned",
            e,
          );
        }
      }
      return `${IFRAME}/${uid}`;
    },

    async delete(uid) {
      await fetch(`${API}/accounts/${accountId()}/stream/${uid}`, {
        method: "DELETE",
        headers: authHeaders(),
      }).catch((e) => logger.warn("Stream delete failed", e));
    },
  };
}
