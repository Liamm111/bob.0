// =============================================================
// Types de la base Supabase — reflètent supabase/migrations/*.sql.
// Écrits à la main dans le format généré par `supabase gen types`
// (le générateur nécessite Docker, indisponible ici). À régénérer
// avec `pnpm db:types` dès qu'un projet Supabase local/distant existe.
// =============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      cafes: {
        Row: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          currency: string;
          country_default: string;
          stripe_account: string | null;
          brand_tokens: Json;
          points_per_currency: number;
          points_expiry_months: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          currency?: string;
          country_default?: string;
          stripe_account?: string | null;
          brand_tokens?: Json;
          points_per_currency?: number;
          points_expiry_months?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cafes"]["Insert"]>;
        Relationships: [];
      };
      staff: {
        Row: {
          user_id: string;
          cafe_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          cafe_id: string;
          role?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff"]["Insert"]>;
        Relationships: [];
      };
      menu_categories: {
        Row: {
          id: string;
          cafe_id: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          cafe_id: string;
          name: string;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["menu_categories"]["Insert"]>;
        Relationships: [];
      };
      menu_items: {
        Row: {
          id: string;
          cafe_id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          price_cents: number;
          vat_rate: number;
          image_url: string | null;
          is_available: boolean;
          allergens: Json;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          cafe_id: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          price_cents: number;
          vat_rate?: number;
          image_url?: string | null;
          is_available?: boolean;
          allergens?: Json;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["menu_items"]["Insert"]>;
        Relationships: [];
      };
      slots_config: {
        Row: {
          id: string;
          cafe_id: string;
          open_time: string;
          close_time: string;
          slot_minutes: number;
          capacity_per_slot: number;
          min_prep_minutes: number;
          is_ordering_open: boolean;
        };
        Insert: {
          id?: string;
          cafe_id: string;
          open_time?: string;
          close_time?: string;
          slot_minutes?: number;
          capacity_per_slot?: number;
          min_prep_minutes?: number;
          is_ordering_open?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["slots_config"]["Insert"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          cafe_id: string;
          phone_e164: string;
          phone_display: string | null;
          name: string | null;
          email: string | null;
          points_balance: number;
          points_lifetime: number;
          pass_serial: string | null;
          pass_platform: Database["public"]["Enums"]["pass_platform"] | null;
          marketing_consent: boolean;
          joined_at: string;
          last_order_at: string | null;
          last_activity_at: string;
        };
        Insert: {
          id?: string;
          cafe_id: string;
          phone_e164: string;
          phone_display?: string | null;
          name?: string | null;
          email?: string | null;
          points_balance?: number;
          points_lifetime?: number;
          pass_serial?: string | null;
          pass_platform?: Database["public"]["Enums"]["pass_platform"] | null;
          marketing_consent?: boolean;
          joined_at?: string;
          last_order_at?: string | null;
          last_activity_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          cafe_id: string;
          customer_id: string;
          order_number: string;
          status: Database["public"]["Enums"]["order_status"];
          pickup_slot: string;
          subtotal_cents: number;
          vat_breakdown: Json;
          total_cents: number;
          stripe_payment_intent: string | null;
          track_token: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          cafe_id: string;
          customer_id: string;
          order_number: string;
          status?: Database["public"]["Enums"]["order_status"];
          pickup_slot: string;
          subtotal_cents: number;
          vat_breakdown?: Json;
          total_cents: number;
          stripe_payment_intent?: string | null;
          track_token?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          menu_item_id: string | null;
          name_snapshot: string;
          qty: number;
          unit_price_cents: number;
          vat_rate: number;
          note: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          menu_item_id?: string | null;
          name_snapshot: string;
          qty: number;
          unit_price_cents: number;
          vat_rate: number;
          note?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [];
      };
      rewards: {
        Row: {
          id: string;
          cafe_id: string;
          name: string;
          cost_points: number;
          is_active: boolean;
          sort_order: number;
        };
        Insert: {
          id?: string;
          cafe_id: string;
          name: string;
          cost_points: number;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["rewards"]["Insert"]>;
        Relationships: [];
      };
      points_ledger: {
        Row: {
          id: string;
          cafe_id: string;
          customer_id: string;
          order_id: string | null;
          reward_id: string | null;
          delta: number;
          reason: Database["public"]["Enums"]["points_reason"];
          balance_after: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          cafe_id: string;
          customer_id: string;
          order_id?: string | null;
          reward_id?: string | null;
          delta: number;
          reason: Database["public"]["Enums"]["points_reason"];
          balance_after: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["points_ledger"]["Insert"]>;
        Relationships: [];
      };
      apple_wallet_registrations: {
        Row: {
          id: string;
          cafe_id: string;
          customer_id: string;
          pass_serial: string;
          device_library_id: string;
          push_token: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          cafe_id: string;
          customer_id: string;
          pass_serial: string;
          device_library_id: string;
          push_token: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["apple_wallet_registrations"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_cafe_staff: {
        Args: { target_cafe: string };
        Returns: boolean;
      };
      get_order_by_token: {
        Args: { p_token: string };
        Returns: {
          order_number: string;
          status: Database["public"]["Enums"]["order_status"];
          pickup_slot: string;
          total_cents: number;
          items: Json;
        }[];
      };
      confirm_order_paid: {
        Args: { p_order_id: string; p_payment_intent: string };
        Returns: {
          customer_id: string;
          points_delta: number;
          points_balance: number;
          overbooked: boolean;
          already_confirmed: boolean;
        }[];
      };
      redeem_reward: {
        Args: { p_customer_id: string; p_reward_id: string };
        Returns: { points_balance: number; spent: number }[];
      };
      adjust_points: {
        Args: { p_customer_id: string; p_delta: number };
        Returns: { points_balance: number }[];
      };
      expire_points: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: {
      order_status:
        | "pending_payment"
        | "paid"
        | "preparing"
        | "ready"
        | "collected"
        | "cancelled"
        | "refunded";
      points_reason: "earn" | "redeem" | "adjust" | "expire";
      pass_platform: "apple" | "google";
    };
    CompositeTypes: Record<never, never>;
  };
};

// ---- Helpers d'usage (mêmes noms que le générateur Supabase) ----
type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
