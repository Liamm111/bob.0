import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Expiration mensuelle des points (fallback si pg_cron n'est pas dispo).
 * Déclenché par Vercel Cron (voir vercel.json). Protégé par un secret :
 *  - Vercel envoie `Authorization: Bearer $CRON_SECRET`.
 * Appelle la RPC `expire_points()` (transaction en base).
 */
export async function GET(req: Request) {
  const secret = env.cronSecret();
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const { data, error } = await serviceClient().rpc("expire_points");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ expired_customers: data ?? 0 });
}
