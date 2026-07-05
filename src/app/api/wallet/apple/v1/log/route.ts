import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Endpoint de log du protocole PassKit — on acquitte simplement. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.info("[apple-wallet:log]", JSON.stringify(body));
  } catch {
    /* ignore */
  }
  return new NextResponse(null, { status: 200 });
}
