import { NextResponse } from "next/server";
import {
  checkAuth,
  registerDevice,
  unregisterDevice,
} from "@/lib/wallet/appleWebService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{
  deviceLibraryId: string;
  passTypeId: string;
  serialNumber: string;
}>;

/** Enregistre un appareil pour recevoir les mises à jour d'un pass. */
export async function POST(req: Request, { params }: { params: Params }) {
  const { deviceLibraryId, serialNumber } = await params;
  if (!checkAuth(req.headers.get("authorization"), serialNumber)) {
    return new NextResponse(null, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { pushToken?: string };
  if (!body.pushToken) return new NextResponse(null, { status: 400 });

  const result = await registerDevice({
    deviceLibraryId,
    serialNumber,
    pushToken: body.pushToken,
  });
  if (result === "not_found") return new NextResponse(null, { status: 404 });
  // 201 si nouvel enregistrement, 200 s'il existait déjà (protocole Apple).
  return new NextResponse(null, { status: result === "created" ? 201 : 200 });
}

/** Désenregistre un appareil. */
export async function DELETE(req: Request, { params }: { params: Params }) {
  const { deviceLibraryId, serialNumber } = await params;
  if (!checkAuth(req.headers.get("authorization"), serialNumber)) {
    return new NextResponse(null, { status: 401 });
  }
  await unregisterDevice({ deviceLibraryId, serialNumber });
  return new NextResponse(null, { status: 200 });
}
