import "server-only";
import { staffClient } from "@/lib/supabase/server";
import { getCafeById, type Cafe } from "@/lib/cafe";

export type StaffContext = {
  userId: string;
  email: string | null;
  cafe: Cafe;
  role: string;
};

/**
 * Contexte du staff connecté : son utilisateur + SON café (via la table staff,
 * soumise à la RLS). `null` si non authentifié ou non rattaché. Base du
 * scoping de tout le back-office.
 */
export async function getStaffContext(): Promise<StaffContext | null> {
  const supabase = await staffClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staffRow } = await supabase
    .from("staff")
    .select("cafe_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!staffRow) return null;

  const cafe = await getCafeById(staffRow.cafe_id);
  if (!cafe) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    cafe,
    role: staffRow.role,
  };
}

/** Variante levante pour les server actions (garantit le scoping). */
export async function requireStaff(): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) throw new Error("non_authentifié");
  return ctx;
}
