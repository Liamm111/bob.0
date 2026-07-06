import { NextResponse } from "next/server";
import { issueGoogleForSerial } from "@/lib/wallet";
import { googleWalletConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Émission d'un pass Google à partir du `pass_serial` (inscription en boutique).
 * Renvoie une redirection vers "Save to Google Wallet".
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ passSerial: string }> },
) {
  const { passSerial } = await params;

  if (!googleWalletConfigured()) {
    return NextResponse.json(
      { error: "Google Wallet non configuré sur cet environnement." },
      { status: 501 },
    );
  }

  const saveUrl = await issueGoogleForSerial(passSerial);
  if (!saveUrl) {
    return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });
  }
  return NextResponse.redirect(saveUrl);
}
