/**
 * Minimal structured logger. JSON lines in production (machine-parseable for
 * Coolify / log drains), pretty console in dev. Swap for pino/Sentry later
 * without touching call sites.
 */

type Level = "debug" | "info" | "warn" | "error";

const isProd = process.env.NODE_ENV === "production";

function emit(level: Level, message: string, meta?: unknown) {
  if (isProd) {
    const line: Record<string, unknown> = {
      level,
      message,
      time: new Date().toISOString(),
    };
    if (meta !== undefined) {
      line.meta =
        meta instanceof Error
          ? { name: meta.name, message: meta.message }
          : meta;
    }

    console[level === "debug" ? "log" : level](JSON.stringify(line));
    return;
  }

  console[level === "debug" ? "log" : level](
    `[${level}] ${message}`,
    meta ?? "",
  );
}

export const logger = {
  debug: (m: string, meta?: unknown) => emit("debug", m, meta),
  info: (m: string, meta?: unknown) => emit("info", m, meta),
  warn: (m: string, meta?: unknown) => emit("warn", m, meta),
  error: (m: string, meta?: unknown) => emit("error", m, meta),
};
