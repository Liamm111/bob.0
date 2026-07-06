import { NextResponse } from "next/server";
import { issueAppleForSerial } from "@/lib/wallet";
import { appleWalletConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Émission d'un pass Apple (.pkpass) à partir du `pass_serial` — parcours
 * d'inscription en boutique (sans commande). Le serial (UUID non devinable)
 * sert de preuve de possession.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ passSerial: string }> },
) {
  const { passSerial } = await params;

  if (!appleWalletConfigured()) {
    return NextResponse.json(
      { error: "Apple Wallet non configuré sur cet environnement." },
      { status: 501 },
    );
  }

  const result = await issueAppleForSerial(passSerial);
  if (!result) {
    return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${result.cafe.slug}.pkpass"`,
    },
  });
}
