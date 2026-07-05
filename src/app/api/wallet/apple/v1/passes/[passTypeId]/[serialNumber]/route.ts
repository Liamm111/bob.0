import { NextResponse } from "next/server";
import { checkAuth, latestPass } from "@/lib/wallet/appleWebService";
import { appleWalletConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Renvoie le .pkpass à jour (appelé par l'appareil après un push APNs). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ passTypeId: string; serialNumber: string }> },
) {
  const { serialNumber } = await params;
  if (!checkAuth(req.headers.get("authorization"), serialNumber)) {
    return new NextResponse(null, { status: 401 });
  }
  if (!appleWalletConfigured()) {
    return new NextResponse(null, { status: 501 });
  }

  const buffer = await latestPass(serialNumber);
  if (!buffer) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: { "Content-Type": "application/vnd.apple.pkpass" },
  });
}
