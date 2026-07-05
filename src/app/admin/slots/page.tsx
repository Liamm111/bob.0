import { getStaffContext } from "@/lib/staff";
import { staffClient } from "@/lib/supabase/server";
import { SlotsManager } from "@/components/admin/SlotsManager";
import { RushStopToggle } from "@/components/admin/RushStopToggle";

export const dynamic = "force-dynamic";

export default async function AdminSlotsPage() {
  const staff = await getStaffContext();
  if (!staff) return null;
  const supabase = await staffClient();

  const { data: config } = await supabase
    .from("slots_config")
    .select("*")
    .eq("cafe_id", staff.cafe.id)
    .maybeSingle();

  if (!config) return <div className="card">Aucune configuration de créneaux.</div>;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <RushStopToggle open={config.is_ordering_open} />
      <SlotsManager config={config} />
    </div>
  );
}
