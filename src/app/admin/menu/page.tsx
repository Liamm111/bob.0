import { getStaffContext } from "@/lib/staff";
import { staffClient } from "@/lib/supabase/server";
import { MenuManager } from "@/components/admin/MenuManager";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const staff = await getStaffContext();
  if (!staff) return null;
  const supabase = await staffClient();

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("menu_categories").select("*").eq("cafe_id", staff.cafe.id).order("sort_order"),
    supabase.from("menu_items").select("*").eq("cafe_id", staff.cafe.id).order("sort_order"),
  ]);

  return (
    <MenuManager
      currency={staff.cafe.currency}
      categories={categories ?? []}
      items={items ?? []}
    />
  );
}
