import "server-only";
import { PostHog } from "posthog-node";
import { env } from "@/lib/env";

/**
 * PostHog côté serveur (analytics produit), env-gated. Sans clé, no-op.
 * Le tracking côté client est branché via le provider dans le layout admin/public
 * quand la clé publique est présente.
 */
let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!env.posthogKey()) return null;
  if (!client) {
    client = new PostHog(env.posthogKey()!, { host: env.posthogHost() });
  }
  return client;
}

export function capture(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
): void {
  const c = getClient();
  if (!c) return;
  c.capture({ distinctId, event, properties });
}

export async function flushEvents(): Promise<void> {
  if (client) await client.flush();
}
