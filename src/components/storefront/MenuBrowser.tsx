"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartContext";
import { formatCents } from "@/lib/pricing";
import type { MenuCategoryWithItems } from "@/lib/data/menu";

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
    <div style={{ paddingBottom: 90 }}>
      <h1 style={{ marginTop: 0 }}>Notre carte</h1>

      {menu.map(({ category, items }) => (
        <section key={category.id} style={{ marginBottom: 28 }}>
          <h2 style={{ borderBottom: "2px solid var(--brand-accent)", paddingBottom: 6 }}>
            {category.name}
          </h2>
          <div className="grid">
            {items.map((item) => {
              const inCart = cart.lines.find((l) => l.menuItemId === item.id);
              return (
                <div
                  key={item.id}
                  className="card"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    opacity: item.is_available ? 1 : 0.55,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      {item.name}{" "}
                      {item.vat_rate >= 8 && <span className="badge">alcool</span>}
                      {!item.is_available && (
                        <span className="badge" style={{ marginLeft: 6 }}>
                          en rupture
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <div className="muted" style={{ fontSize: "0.9rem" }}>
                        {item.description}
                      </div>
                    )}
                    <div style={{ marginTop: 4, fontWeight: 600 }}>
                      {currency} {formatCents(item.price_cents)}
                    </div>
                  </div>

                  {item.is_available ? (
                    inCart ? (
                      <div className="row">
                        <button
                          className="btn btn-ghost"
                          aria-label="moins"
                          onClick={() => cart.setQty(item.id, inCart.qty - 1)}
                        >
                          −
                        </button>
                        <strong style={{ minWidth: 20, textAlign: "center" }}>
                          {inCart.qty}
                        </strong>
                        <button
                          className="btn btn-ghost"
                          aria-label="plus"
                          onClick={() => cart.setQty(item.id, inCart.qty + 1)}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-accent"
                        onClick={() =>
                          cart.add({
                            menuItemId: item.id,
                            name: item.name,
                            unitPriceCents: item.price_cents,
                            vatRate: item.vat_rate,
                          })
                        }
                      >
                        Ajouter
                      </button>
                    )
                  ) : (
                    <span className="muted">indisponible</span>
                  )}
                </div>
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
              Commander →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
