"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartContext";
import { formatCents } from "@/lib/pricing";
import type { MenuCategoryWithItems, MenuItem } from "@/lib/data/menu";

/** Dégradés chauds de repli quand un article n'a pas encore de photo. */
const FALLBACKS = [
  "linear-gradient(140deg,#8a5a34,#5c3a22)",
  "linear-gradient(140deg,#7f9455,#566b34)",
  "linear-gradient(140deg,#c56a45,#9a3f2c)",
  "linear-gradient(140deg,#c69a5e,#9a6f3c)",
  "linear-gradient(140deg,#83975a,#c56a45)",
  "linear-gradient(140deg,#caa06a,#a06a3e)",
];

function fallbackGradient(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACKS[h % FALLBACKS.length]!;
}

function isNew(createdAt: string): boolean {
  const days = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  return days >= 0 && days <= 14;
}

function allergensOf(item: MenuItem): string[] {
  return Array.isArray(item.allergens) ? (item.allergens as string[]) : [];
}

export function MenuBrowser({
  cafeSlug,
  currency,
  menu,
}: {
  cafeSlug: string;
  currency: string;
  menu: MenuCategoryWithItems[];
}) {
  const cart = useCart();

  return (
    <div style={{ paddingBottom: 96 }}>
      {menu.map(({ category, items }) => (
        <section key={category.id}>
          <h2 className="cat-title">{category.name}</h2>
          <div className="menu-cards">
            {items.map((item) => {
              const inCart = cart.lines.find((l) => l.menuItemId === item.id);
              const allergens = allergensOf(item);
              const imgStyle = item.image_url
                ? { backgroundImage: `url(${item.image_url})` }
                : { background: fallbackGradient(item.id) };
              return (
                <article
                  key={item.id}
                  className={`mcard${item.is_available ? "" : " is-out"}`}
                >
                  <div className="mcard-img" style={imgStyle}>
                    {!item.image_url && (
                      <span className="mono">{item.name.charAt(0)}</span>
                    )}
                    {!item.is_available ? (
                      <span className="mcard-flag out">Rupture</span>
                    ) : (
                      isNew(item.created_at) && <span className="mcard-flag">Nouveau</span>
                    )}
                  </div>
                  <div className="mcard-body">
                    <div className="mcard-name">{item.name}</div>
                    {item.description && (
                      <div className="mcard-desc">{item.description}</div>
                    )}
                    {allergens.length > 0 && (
                      <div className="mcard-allerg">{allergens.slice(0, 4).join(" · ")}</div>
                    )}
                    <div className="mcard-foot">
                      <span className="mcard-price">
                        {currency} {formatCents(item.price_cents)}
                      </span>
                      {item.is_available ? (
                        inCart ? (
                          <span className="mcard-step">
                            <button
                              aria-label={`Retirer ${item.name}`}
                              onClick={() => cart.setQty(item.id, inCart.qty - 1)}
                            >
                              −
                            </button>
                            <span className="q">{inCart.qty}</span>
                            <button
                              aria-label={`Ajouter ${item.name}`}
                              onClick={() => cart.setQty(item.id, inCart.qty + 1)}
                            >
                              +
                            </button>
                          </span>
                        ) : (
                          <button
                            className="mcard-add"
                            aria-label={`Ajouter ${item.name}`}
                            onClick={() =>
                              cart.add({
                                menuItemId: item.id,
                                name: item.name,
                                unitPriceCents: item.price_cents,
                                vatRate: item.vat_rate,
                              })
                            }
                          >
                            +
                          </button>
                        )
                      ) : (
                        <span className="muted">indisponible</span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {cart.count > 0 && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            background: "var(--brand-primary)",
            color: "#fff",
            padding: "12px 0",
          }}
        >
          <div
            className="container"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span>
              {cart.count} article{cart.count > 1 ? "s" : ""} · {currency}{" "}
              {formatCents(cart.subtotalCents)}
            </span>
            <Link href={`/${cafeSlug}/checkout`} className="btn btn-accent">
              Commander
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
