import Link from "next/link";
import { getStaffContext } from "@/lib/staff";
import { staffClient } from "@/lib/supabase/server";
import { RushStopToggle } from "@/components/admin/RushStopToggle";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const staff = await getStaffContext();
  if (!staff) return null;
  const supabase = await staffClient();

  const [{ data: slots }, { count: activeCount }, { count: readyCount }] =
    await Promise.all([
      supabase.from("slots_config").select("is_ordering_open").eq("cafe_id", staff.cafe.id).maybeSingle(),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["paid", "preparing"]),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "ready"),
    ]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>Bonjour {staff.email}</h1>

      <RushStopToggle open={slots?.is_ordering_open ?? true} />

      <div className="row" style={{ gap: 12 }}>
        <div className="card" style={{ flex: 1 }}>
          <div className="muted">En préparation</div>
          <div style={{ fontSize: "2rem", fontWeight: 700 }}>{activeCount ?? 0}</div>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <div className="muted">Prêtes à retirer</div>
          <div style={{ fontSize: "2rem", fontWeight: 700 }}>{readyCount ?? 0}</div>
        </div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <Link href="/admin/orders" className="btn">
          Voir la file
        </Link>
        <Link href="/admin/scan" className="btn btn-accent">
          Scanner un pass
        </Link>
      </div>
    </div>
  );
}
