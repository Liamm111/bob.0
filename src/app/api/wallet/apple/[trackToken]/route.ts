import { NextResponse } from "next/server";
import { issueAppleForToken } from "@/lib/wallet";
import { appleWalletConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Émission d'un pass Apple (.pkpass) pour le porteur d'un track_token.
 * Le token de suivi (UUID non devinable) sert de preuve de possession : seul
 * le client qui vient de payer le connaît.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ trackToken: string }> },
) {
  const { trackToken } = await params;

  if (!appleWalletConfigured()) {
    return NextResponse.json(
      { error: "Apple Wallet non configuré sur cet environnement." },
      { status: 501 },
    );
  }

  const result = await issueAppleForToken(trackToken);
  if (!result) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${result.cafe.slug}.pkpass"`,
    },
  });
}
