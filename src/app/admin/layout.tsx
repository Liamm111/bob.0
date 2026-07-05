import { getStaffContext } from "@/lib/staff";
import { brandStyle } from "@/lib/brand";
import { brandTokens } from "@/lib/cafe";
import { AdminNav } from "@/components/admin/AdminNav";
import "../globals.css";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getStaffContext();

  // Page de login (ou session absente) : rendu minimal sans navigation.
  // Le middleware protège déjà les routes /admin authentifiées.
  if (!staff) {
    return <div style={{ minHeight: "100vh" }}>{children}</div>;
  }

  const tokens = brandTokens(staff.cafe);

  return (
    <div style={{ ...brandStyle(tokens), minHeight: "100vh" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid var(--brand-border)" }}>
        <div className="container">
          <AdminNav cafeName={staff.cafe.name} />
        </div>
      </header>
      <main className="container" style={{ padding: "24px 20px 64px" }}>
        {children}
      </main>
    </div>
  );
}

// Évite la redirection dans le layout pour la route login (qui rend sans staff).
export const dynamic = "force-dynamic";
