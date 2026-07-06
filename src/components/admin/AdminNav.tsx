"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

const LINKS = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/orders", label: "Commandes" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/slots", label: "Créneaux" },
  { href: "/admin/loyalty", label: "Fidélité caisse" },
  { href: "/admin/scan", label: "Scan récompense" },
];

export function AdminNav({ cafeName }: { cafeName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await browserClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
        padding: "10px 0",
      }}
    >
      <strong style={{ marginRight: 12 }}>{cafeName}</strong>
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className="badge"
            style={{
              background: active ? "var(--brand-primary)" : "var(--brand-border)",
              color: active ? "#fff" : "var(--brand-muted)",
              textDecoration: "none",
              padding: "6px 12px",
            }}
          >
            {l.label}
          </Link>
        );
      })}
      {/* Route handler (CSV), pas une page → lien natif volontaire. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/admin/orders/export" className="badge" style={{ padding: "6px 12px", textDecoration: "none" }}>
        Export CSV
      </a>
      <button className="btn btn-ghost" onClick={logout} style={{ marginLeft: "auto", padding: "6px 12px" }}>
        Déconnexion
      </button>
    </nav>
  );
}
