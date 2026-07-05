"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

/**
 * Init PostHog côté client, env-gated. Sans clé publique, no-op complet.
 */
export function Analytics() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      capture_pageview: true,
      person_profiles: "identified_only",
    });
  }, []);
  return null;
}
