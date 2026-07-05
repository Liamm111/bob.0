"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSlotsConfig } from "@/actions/admin";
import type { Tables } from "@/types/supabase";

export function SlotsManager({ config }: { config: Tables<"slots_config"> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    open_time: config.open_time.slice(0, 5),
    close_time: config.close_time.slice(0, 5),
    slot_minutes: config.slot_minutes,
    capacity_per_slot: config.capacity_per_slot,
    min_prep_minutes: config.min_prep_minutes,
  });
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await updateSlotsConfig(form);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div>
      <h1>Créneaux de retrait</h1>
      <div className="card grid" style={{ maxWidth: 480 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Ouverture</label>
            <input
              type="time"
              value={form.open_time}
              onChange={(e) => setForm({ ...form, open_time: e.target.value })}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Fermeture</label>
            <input
              type="time"
              value={form.close_time}
              onChange={(e) => setForm({ ...form, close_time: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label>Durée d'un créneau (min)</label>
          <input
            type="number"
            value={form.slot_minutes}
            onChange={(e) => setForm({ ...form, slot_minutes: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>Capacité par créneau</label>
          <input
            type="number"
            value={form.capacity_per_slot}
            onChange={(e) => setForm({ ...form, capacity_per_slot: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>Délai de préparation minimal (min)</label>
          <input
            type="number"
            value={form.min_prep_minutes}
            onChange={(e) => setForm({ ...form, min_prep_minutes: Number(e.target.value) })}
          />
        </div>
        <button className="btn" onClick={save} disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && !pending && <span className="muted">Enregistré ✓</span>}
      </div>
    </div>
  );
}
