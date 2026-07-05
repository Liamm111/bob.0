import { notFound } from "next/navigation";
import { getCafeBySlug } from "@/lib/cafe";
import { getMenu } from "@/lib/data/menu";
import { CartProvider } from "@/components/cart/CartContext";
import { MenuBrowser } from "@/components/storefront/MenuBrowser";

export default async function CafeHomePage({
  params,
}: {
  params: Promise<{ cafeSlug: string }>;
}) {
  const { cafeSlug } = await params;
  const cafe = await getCafeBySlug(cafeSlug);
  if (!cafe) notFound();

  const menu = await getMenu(cafe.id);

  return (
    <CartProvider cafeSlug={cafe.slug}>
      <MenuBrowser cafeSlug={cafe.slug} currency={cafe.currency} menu={menu} />
    </CartProvider>
  );
}
