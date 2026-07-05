import "server-only";
import crypto from "node:crypto";
import zlib from "node:zlib";
import http2 from "node:http2";
import forge from "node-forge";
import JSZip from "jszip";
import {
  env,
  appleWalletConfigured,
  appleApnsConfigured,
} from "@/lib/env";
import { brandTokens, type Cafe } from "@/lib/cafe";
import { serviceClient } from "@/lib/supabase/service";
import type { Tables } from "@/types/supabase";

/**
 * Apple Wallet — pass `storeCard` généré et SIGNÉ côté serveur (certificat
 * Pass Type ID + clé + WWDR, en env), et poussé via APNs à chaque changement
 * de solde. Env-gated : les endpoints renvoient une erreur claire si non
 * configuré, syncPass no-op.
 */

// ---------- Encodeur PNG minimal (icône requise par Apple) ----------
function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** PNG carré uni (couleur hex #rrggbb) — évite d'embarquer un binaire. */
function solidPng(size: number, hex: string): Buffer {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const p = rowStart + 1 + x * 3;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Construction du pass ----------
function passJson(cafe: Cafe, customer: Tables<"customers">): string {
  const tokens = brandTokens(cafe);
  const primary = tokens.primary ?? "#2f3a33";
  return JSON.stringify({
    formatVersion: 1,
    passTypeIdentifier: env.applePassTypeId(),
    teamIdentifier: env.appleTeamId(),
    organizationName: cafe.name,
    description: `Carte de fidélité ${cafe.name}`,
    serialNumber: customer.pass_serial,
    backgroundColor: hexToRgb(primary),
    foregroundColor: "rgb(255,255,255)",
    labelColor: "rgb(255,255,255)",
    logoText: tokens.logoText ?? cafe.name,
    webServiceURL: `${env.appBaseUrl()}/api/wallet/apple`,
    authenticationToken: customer.pass_serial,
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: customer.pass_serial,
        messageEncoding: "iso-8859-1",
      },
    ],
    storeCard: {
      primaryFields: [
        { key: "points", label: "Points", value: customer.points_balance },
      ],
      secondaryFields: [
        { key: "name", label: "Membre", value: customer.name ?? "Client" },
      ],
      auxiliaryFields: [
        {
          key: "since",
          label: "Membre depuis",
          value: new Date(customer.joined_at).toISOString().slice(0, 10),
        },
      ],
    },
  });
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgb(${r},${g},${b})`;
}

/** Signature PKCS#7 détachée du manifest (cert + clé + WWDR). */
function signManifest(manifest: Buffer): Buffer {
  const cert = forge.pki.certificateFromPem(env.appleWalletCertPem()!);
  const key = forge.pki.decryptRsaPrivateKey(
    env.appleWalletKeyPem()!,
    env.appleWalletKeyPassword() ?? "",
  ) ?? forge.pki.privateKeyFromPem(env.appleWalletKeyPem()!);
  const wwdr = forge.pki.certificateFromPem(env.appleWwdrPem()!);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest.toString("binary"));
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key: key as forge.pki.rsa.PrivateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256!,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType!, value: forge.pki.oids.data! },
      { type: forge.pki.oids.messageDigest! },
      { type: forge.pki.oids.signingTime!, value: new Date().toISOString() },
    ],
  });
  p7.sign({ detached: true });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return Buffer.from(der, "binary");
}

/** Génère le .pkpass signé (zip) prêt à télécharger. */
export async function buildPkpass(
  cafe: Cafe,
  customer: Tables<"customers">,
): Promise<Buffer> {
  if (!appleWalletConfigured()) {
    throw new Error("Apple Wallet non configuré. Voir .env.example.");
  }
  const tokens = brandTokens(cafe);
  const accent = tokens.accent ?? "#c9a26b";

  const files: Record<string, Buffer> = {
    "pass.json": Buffer.from(passJson(cafe, customer), "utf8"),
    "icon.png": solidPng(29, accent),
    "icon@2x.png": solidPng(58, accent),
    "logo.png": solidPng(160, tokens.primary ?? "#2f3a33"),
  };

  // manifest.json = { fichier: sha1hex }
  const manifest: Record<string, string> = {};
  for (const [name, buf] of Object.entries(files)) {
    manifest[name] = crypto.createHash("sha1").update(buf).digest("hex");
  }
  const manifestBuf = Buffer.from(JSON.stringify(manifest), "utf8");
  const signature = signManifest(manifestBuf);

  const zip = new JSZip();
  for (const [name, buf] of Object.entries(files)) zip.file(name, buf);
  zip.file("manifest.json", manifestBuf);
  zip.file("signature", signature);

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

// ---------- APNs : push de mise à jour ----------
function apnsJwt(): string {
  const header = {
    alg: "ES256",
    kid: env.appleApnsKeyId(),
  };
  const claims = {
    iss: env.appleTeamId(),
    iat: Math.floor(Date.now() / 1000),
  };
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const signingInput = `${enc(header)}.${enc(claims)}`;
  const signature = crypto.sign(
    "sha256",
    Buffer.from(signingInput),
    { key: env.appleApnsKeyPem()!, dsaEncoding: "ieee-p1363" },
  );
  return `${signingInput}.${signature.toString("base64url")}`;
}

/**
 * Pousse une notification APNs (payload vide) à tous les appareils enregistrés
 * pour ce pass_serial → le téléphone re-télécharge le pass à jour.
 */
export async function pushPassUpdate(passSerial: string): Promise<void> {
  if (!appleApnsConfigured()) return;

  const { data: regs } = await serviceClient()
    .from("apple_wallet_registrations")
    .select("push_token")
    .eq("pass_serial", passSerial);
  if (!regs || regs.length === 0) return;

  const jwt = apnsJwt();
  const topic = env.applePassTypeId()!;
  const client = http2.connect("https://api.push.apple.com");

  try {
    await Promise.all(
      regs.map(
        (r) =>
          new Promise<void>((resolve) => {
            const req = client.request({
              ":method": "POST",
              ":path": `/3/device/${r.push_token}`,
              authorization: `bearer ${jwt}`,
              "apns-topic": topic,
              "apns-push-type": "background",
              "apns-priority": "5",
              "content-type": "application/json",
            });
            req.on("response", () => {});
            req.on("error", () => resolve());
            req.on("end", () => resolve());
            req.end(JSON.stringify({}));
          }),
      ),
    );
  } finally {
    client.close();
  }
}
