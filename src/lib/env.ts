/**
 * Accès centralisé aux variables d'environnement.
 *
 * Deux catégories :
 *  - REQUISES (Supabase, URL de base) : validées tôt côté serveur.
 *  - INTÉGRATIONS (Stripe, Resend, Apple, Google, monitoring) : optionnelles.
 *    Chaque intégration est "env-gated" : le code vérifie sa configuration via
 *    les helpers `*Configured()` et se désactive proprement si absente, sans
 *    faire planter le build. Voir `.env.example`.
 */

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

function required(name: string): string {
  const v = optional(name);
  if (!v) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Voir .env.example.`,
    );
  }
  return v;
}

export const env = {
  // ---- Base / Supabase (requis en runtime serveur) ----
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  appBaseUrl: () => optional("NEXT_PUBLIC_APP_BASE_URL") ?? "http://localhost:3000",

  // ---- Stripe ----
  stripeSecretKey: () => optional("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => optional("STRIPE_WEBHOOK_SECRET"),
  stripePublishableKey: () => optional("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),

  // ---- Resend (emails) ----
  resendApiKey: () => optional("RESEND_API_KEY"),
  emailFrom: () => optional("EMAIL_FROM") ?? "Café <onboarding@resend.dev>",

  // ---- Apple Wallet ----
  appleWalletCertPem: () => optional("APPLE_WALLET_CERT_PEM"),
  appleWalletKeyPem: () => optional("APPLE_WALLET_KEY_PEM"),
  appleWalletKeyPassword: () => optional("APPLE_WALLET_KEY_PASSWORD"),
  appleWwdrPem: () => optional("APPLE_WWDR_PEM"),
  applePassTypeId: () => optional("APPLE_PASS_TYPE_ID"),
  appleTeamId: () => optional("APPLE_TEAM_ID"),
  appleApnsKeyPem: () => optional("APPLE_APNS_KEY_PEM"),
  appleApnsKeyId: () => optional("APPLE_APNS_KEY_ID"),

  // ---- Google Wallet ----
  googleWalletIssuerId: () => optional("GOOGLE_WALLET_ISSUER_ID"),
  googleWalletServiceAccountJson: () => optional("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON"),
  googleWalletClassSuffix: () => optional("GOOGLE_WALLET_CLASS_SUFFIX") ?? "cafe_loyalty",

  // ---- Cron ----
  cronSecret: () => optional("CRON_SECRET"),

  // ---- Monitoring ----
  sentryDsn: () => optional("NEXT_PUBLIC_SENTRY_DSN"),
  posthogKey: () => optional("NEXT_PUBLIC_POSTHOG_KEY"),
  posthogHost: () => optional("NEXT_PUBLIC_POSTHOG_HOST") ?? "https://eu.i.posthog.com",
};

// ---- Helpers "est-ce configuré ?" pour désactiver proprement ----
export const stripeConfigured = () =>
  Boolean(env.stripeSecretKey() && env.stripeWebhookSecret());
export const resendConfigured = () => Boolean(env.resendApiKey());
export const appleWalletConfigured = () =>
  Boolean(
    env.appleWalletCertPem() &&
      env.appleWalletKeyPem() &&
      env.appleWwdrPem() &&
      env.applePassTypeId() &&
      env.appleTeamId(),
  );
export const appleApnsConfigured = () =>
  Boolean(env.appleApnsKeyPem() && env.appleApnsKeyId() && env.appleTeamId());
export const googleWalletConfigured = () =>
  Boolean(env.googleWalletIssuerId() && env.googleWalletServiceAccountJson());
