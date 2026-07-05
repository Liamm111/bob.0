import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

/**
 * Wrappers Sentry env-gated. Sans DSN, on retombe sur la console (aucune
 * dépendance dure au service). L'init réel de Sentry se fait via les fichiers
 * `sentry.*.config.ts` / instrumentation, quand le DSN est présent.
 */
const enabled = () => Boolean(env.sentryDsn());

export function captureException(err: unknown): void {
  if (enabled()) {
    Sentry.captureException(err);
  } else {
    console.error("[sentry:disabled]", err);
  }
}

export function captureMessage(message: string): void {
  if (enabled()) {
    Sentry.captureMessage(message);
  } else {
    console.warn("[sentry:disabled]", message);
  }
}
