import "server-only";
import crypto from "node:crypto";
import { google } from "googleapis";
import { env, googleWalletConfigured } from "@/lib/env";
import { brandTokens, type Cafe } from "@/lib/cafe";
import type { Tables } from "@/types/supabase";

/**
 * Google Wallet — objet Loyalty via l'API REST. Un compte de service (env)
 * signe les requêtes. Un *class* Loyalty par café ; un *object* par client
 * (clé = pass_serial). La mise à jour du solde = PATCH de l'objet (propagation
 * automatique côté téléphone). Env-gated : no-op si non configuré.
 */

const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

type ServiceAccount = { client_email: string; private_key: string };

function serviceAccount(): ServiceAccount {
  return JSON.parse(env.googleWalletServiceAccountJson()!) as ServiceAccount;
}

function classId(cafe: Cafe): string {
  const issuer = env.googleWalletIssuerId()!;
  return `${issuer}.${env.googleWalletClassSuffix()}_${cafe.slug}`;
}

function objectId(passSerial: string): string {
  const issuer = env.googleWalletIssuerId()!;
  return `${issuer}.${passSerial}`;
}

async function accessToken(): Promise<string> {
  const sa = serviceAccount();
  const jwt = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: [SCOPE],
  });
  const { access_token } = await jwt.authorize();
  if (!access_token) throw new Error("Google Wallet: pas d'access_token.");
  return access_token;
}

async function walletFetch(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${WALLET_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** Crée la classe Loyalty du café si elle n'existe pas encore. */
async function ensureClass(token: string, cafe: Cafe): Promise<void> {
  const id = classId(cafe);
  const existing = await walletFetch(token, `/loyaltyClass/${id}`);
  if (existing.ok) return;

  const tokens = brandTokens(cafe);
  const body = {
    id,
    issuerName: cafe.name,
    programName: `Fidélité ${cafe.name}`,
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: tokens.primary ?? "#2f3a33",
    ...(tokens.logoUrl
      ? { programLogo: { sourceUri: { uri: tokens.logoUrl } } }
      : {}),
  };
  const res = await walletFetch(token, "/loyaltyClass", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Google Wallet class: ${res.status} ${await res.text()}`);
  }
}

function objectPayload(cafe: Cafe, customer: Tables<"customers">) {
  return {
    id: objectId(customer.pass_serial!),
    classId: classId(cafe),
    state: "ACTIVE",
    accountName: customer.name ?? "Client",
    accountId: customer.pass_serial!,
    loyaltyPoints: {
      label: "Points",
      balance: { int: customer.points_balance },
    },
    barcode: { type: "QR_CODE", value: customer.pass_serial! },
  };
}

/**
 * Crée (ou met à jour) l'objet Loyalty du client et renvoie le lien
 * "Enregistrer dans Google Wallet" (JWT signé RS256 par le compte de service).
 */
export async function issueGooglePass(
  cafe: Cafe,
  customer: Tables<"customers">,
): Promise<string> {
  if (!googleWalletConfigured()) {
    throw new Error("Google Wallet non configuré. Voir .env.example.");
  }
  const token = await accessToken();
  await ensureClass(token, cafe);

  const payload = objectPayload(cafe, customer);
  const existing = await walletFetch(token, `/loyaltyObject/${payload.id}`);
  if (existing.ok) {
    await walletFetch(token, `/loyaltyObject/${payload.id}`, {
      method: "PATCH",
      body: JSON.stringify({ loyaltyPoints: payload.loyaltyPoints }),
    });
  } else {
    const res = await walletFetch(token, "/loyaltyObject", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok && res.status !== 409) {
      throw new Error(`Google Wallet object: ${res.status} ${await res.text()}`);
    }
  }

  return buildSaveUrl(cafe, payload);
}

/** PATCH du solde de l'objet (appelé par syncPass sur changement de solde). */
export async function patchGooglePoints(
  customer: Tables<"customers">,
): Promise<void> {
  if (!googleWalletConfigured()) return;
  if (!customer.pass_serial) return;
  const token = await accessToken();
  const id = objectId(customer.pass_serial);
  const res = await walletFetch(token, `/loyaltyObject/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      loyaltyPoints: { label: "Points", balance: { int: customer.points_balance } },
    }),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Google Wallet patch: ${res.status} ${await res.text()}`);
  }
}

/** JWT "Save to Google Wallet" signé RS256 avec la clé du compte de service. */
function buildSaveUrl(cafe: Cafe, object: ReturnType<typeof objectPayload>): string {
  const sa = serviceAccount();
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    payload: { loyaltyObjects: [object] },
  };

  const enc = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const signingInput = `${enc(header)}.${enc(claims)}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(signingInput)
    .sign(sa.private_key)
    .toString("base64url");

  return `https://pay.google.com/gp/v/save/${signingInput}.${signature}`;
}
