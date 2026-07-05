import { getStaffContext } from "@/lib/staff";
import { staffClient } from "@/lib/supabase/server";
import { OrdersBoard, type QueueOrder } from "@/components/admin/OrdersBoard";
import type { Enums } from "@/types/supabase";

export const dynamic = "force-dynamic";

const ACTIVE: Enums<"order_status">[] = ["paid", "preparing", "ready"];

export default async function OrdersPage() {
  const staff = await getStaffContext();
  if (!staff) return null;
  const supabase = await staffClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, pickup_slot, total_cents, customer_id")
    .in("status", ACTIVE)
    .order("pickup_slot", { ascending: true });

  const list = orders ?? [];
  const orderIds = list.map((o) => o.id);
  const customerIds = [...new Set(list.map((o) => o.customer_id))];

  const [{ data: items }, { data: customers }] = await Promise.all([
    orderIds.length
      ? supabase
          .from("order_items")
          .select("order_id, name_snapshot, qty, note")
          .in("order_id", orderIds)
      : Promise.resolve({ data: [] as never[] }),
    customerIds.length
      ? supabase.from("customers").select("id, name").in("id", customerIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const nameById = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const itemsByOrder = new Map<string, QueueOrder["items"]>();
  for (const it of items ?? []) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push({ name: it.name_snapshot, qty: it.qty, note: it.note });
    itemsByOrder.set(it.order_id, arr);
  }

  const queue: QueueOrder[] = list.map((o) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    pickup_slot: o.pickup_slot,
    total_cents: o.total_cents,
    customer_name: nameById.get(o.customer_id) ?? null,
    items: itemsByOrder.get(o.id) ?? [],
  }));

  return (
    <OrdersBoard
      cafeId={staff.cafe.id}
      currency={staff.cafe.currency}
      timeZone={staff.cafe.timezone}
      orders={queue}
    />
  );
}
