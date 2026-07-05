import { NextResponse } from "next/server";
import { listSerials } from "@/lib/wallet/appleWebService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liste les serials à mettre à jour pour un appareil. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ deviceLibraryId: string; passTypeId: string }> },
) {
  const { deviceLibraryId } = await params;
  const { serialNumbers, lastUpdated } = await listSerials(deviceLibraryId);
  if (serialNumbers.length === 0) {
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json({ serialNumbers, lastUpdated });
}
