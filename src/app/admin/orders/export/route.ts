import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/staff";
import { staffClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Export CSV des commandes du café (compta). Scopé par la RLS du staff.
 * Colonnes : numéro, statut, créneau, sous-total, TVA par taux, total, date,
 * client. Les montants sont en unités monétaires (pas en centimes).
 */
export async function GET() {
  const staff = await getStaffContext();
  if (!staff) return new NextResponse("Non autorisé", { status: 401 });

  const supabase = await staffClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "order_number, status, pickup_slot, subtotal_cents, total_cents, vat_breakdown, created_at, customer_id",
    )
    .order("created_at", { ascending: false });

  const list = orders ?? [];
  const customerIds = [...new Set(list.map((o) => o.customer_id))];
  const { data: customers } = customerIds.length
    ? await supabase.from("customers").select("id, name, phone_e164").in("id", customerIds)
    : { data: [] as { id: string; name: string | null; phone_e164: string }[] };
  const byId = new Map((customers ?? []).map((c) => [c.id, c]));

  const header = [
    "numero",
    "statut",
    "creneau",
    "sous_total",
    "tva_2_6",
    "tva_8_1",
    "total",
    "date",
    "client",
    "telephone",
  ];

  const rows = list.map((o) => {
    const vat = (o.vat_breakdown ?? {}) as Record<string, number>;
    const c = byId.get(o.customer_id);
    return [
      o.order_number,
      o.status,
      o.pickup_slot,
      formatCents(o.subtotal_cents),
      formatCents(vat["2.6"] ?? 0),
      formatCents(vat["8.1"] ?? 0),
      formatCents(o.total_cents),
      o.created_at,
      c?.name ?? "",
      c?.phone_e164 ?? "",
    ]
      .map(csvCell)
      .join(",");
  });

  const csv = [header.map(csvCell).join(","), ...rows].join("\n");
  const filename = `commandes-${staff.cafe.slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
