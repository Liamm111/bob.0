import { NextResponse } from "next/server";
import { issueGoogleForToken } from "@/lib/wallet";
import { googleWalletConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Émission d'un pass Google : renvoie l'URL "Save to Google Wallet" (redirect).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ trackToken: string }> },
) {
  const { trackToken } = await params;

  if (!googleWalletConfigured()) {
    return NextResponse.json(
      { error: "Google Wallet non configuré sur cet environnement." },
      { status: 501 },
    );
  }

  const saveUrl = await issueGoogleForToken(trackToken);
  if (!saveUrl) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }
  return NextResponse.redirect(saveUrl);
}
