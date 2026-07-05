import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import type { Tables } from "@/types/supabase";

export type MenuItem = Tables<"menu_items">;
export type MenuCategory = Tables<"menu_categories">;

export type MenuCategoryWithItems = {
  category: MenuCategory;
  items: MenuItem[];
};

/**
 * Menu public d'un café (service role, scopé par cafe_id).
 * Renvoie toutes les catégories triées avec leurs items ; les items en
 * rupture (`is_available = false`) sont inclus mais marqués côté UI.
 */
export async function getMenu(cafeId: string): Promise<MenuCategoryWithItems[]> {
  const supabase = serviceClient();

  const [{ data: categories, error: catErr }, { data: items, error: itemErr }] =
    await Promise.all([
      supabase
        .from("menu_categories")
        .select("*")
        .eq("cafe_id", cafeId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("menu_items")
        .select("*")
        .eq("cafe_id", cafeId)
        .order("sort_order", { ascending: true }),
    ]);

  if (catErr) throw catErr;
  if (itemErr) throw itemErr;

  return (categories ?? []).map((category) => ({
    category,
    items: (items ?? []).filter((i) => i.category_id === category.id),
  }));
}

/**
 * Recharge les items par IDs, scopés par cafe_id, POUR LE CALCUL SERVEUR du
 * prix/TVA au checkout. On ne fait jamais confiance aux montants du client.
 */
export async function getItemsForPricing(
  cafeId: string,
  itemIds: string[],
): Promise<Map<string, MenuItem>> {
  if (itemIds.length === 0) return new Map();
  const { data, error } = await serviceClient()
    .from("menu_items")
    .select("*")
    .eq("cafe_id", cafeId)
    .in("id", itemIds);
  if (error) throw error;
  return new Map((data ?? []).map((i) => [i.id, i]));
}
