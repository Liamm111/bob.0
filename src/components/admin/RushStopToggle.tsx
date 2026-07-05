"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrderingOpen } from "@/actions/admin";

export function RushStopToggle({ open }: { open: boolean }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(open);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !isOpen;
    startTransition(async () => {
      await setOrderingOpen(next);
      setIsOpen(next);
      router.refresh();
    });
  }

  return (
    <div className="card" style={{ borderColor: isOpen ? "var(--brand-border)" : "#c0392b" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <strong>Prise de commande en ligne</strong>
          <div className="muted">
            {isOpen
              ? "Ouverte — les clients peuvent commander."
              : "FERMÉE (Rush stop) — aucune nouvelle commande."}
          </div>
        </div>
        <button
          className={isOpen ? "btn btn-ghost" : "btn btn-accent"}
          onClick={toggle}
          disabled={pending}
        >
          {isOpen ? "Couper (Rush stop)" : "Rouvrir"}
        </button>
      </div>
    </div>
  );
}
