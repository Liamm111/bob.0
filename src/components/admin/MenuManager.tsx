"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/pricing";
import {
  toggleItemAvailability,
  upsertMenuItem,
  uploadMenuImage,
} from "@/actions/admin";
import type { Tables } from "@/types/supabase";

type Item = Tables<"menu_items">;
type Category = Tables<"menu_categories">;

export function MenuManager({
  currency,
  categories,
  items,
}: {
  currency: string;
  categories: Category[];
  items: Item[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Partial<Item> | null>(null);

  function save(form: Partial<Item>) {
    startTransition(async () => {
      await upsertMenuItem({
        id: form.id,
        category_id: form.category_id ?? null,
        name: form.name ?? "",
        description: form.description ?? null,
        price_cents: Number(form.price_cents ?? 0),
        vat_rate: Number(form.vat_rate ?? 2.6),
        is_available: form.is_available ?? true,
        image_url: form.image_url ?? null,
        sort_order: form.sort_order ?? 0,
      });
      setEditing(null);
      router.refresh();
    });
  }

  function startNew() {
    setEditing({
      id: crypto.randomUUID(), // id anticipé → l'upload photo marche avant la 1re sauvegarde
      name: "",
      price_cents: 0,
      vat_rate: 2.6,
      is_available: true,
    });
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Menu</h1>
        <button className="btn" onClick={startNew}>
          + Nouvel article
        </button>
      </div>

      {editing && (
        <ItemForm
          item={editing}
          categories={categories}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}

      <div className="grid">
        {items.map((it) => (
          <div key={it.id} className="card row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{it.name}</strong> · {currency} {formatCents(it.price_cents)}{" "}
              <span className="badge">TVA {it.vat_rate}%</span>
              {!it.is_available && (
                <span className="badge" style={{ marginLeft: 6 }}>
                  rupture
                </span>
              )}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn btn-ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await toggleItemAvailability(it.id, !it.is_available);
                    router.refresh();
                  })
                }
              >
                {it.is_available ? "Marquer en rupture" : "Remettre dispo"}
              </button>
              <button className="btn btn-ghost" onClick={() => setEditing(it)}>
                Éditer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemForm({
  item,
  categories,
  pending,
  onCancel,
  onSave,
}: {
  item: Partial<Item>;
  categories: Category[];
  pending: boolean;
  onCancel: () => void;
  onSave: (form: Partial<Item>) => void;
}) {
  const [form, setForm] = useState<Partial<Item>>(item);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const priceInput = ((form.price_cents ?? 0) / 100).toString();

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !form.id) return;
    setUploadErr(null);
    setUploading(true);
    const fd = new FormData();
    fd.set("itemId", form.id);
    fd.set("file", file);
    const res = await uploadMenuImage(fd);
    setUploading(false);
    if (res.ok) setForm((f) => ({ ...f, image_url: res.url }));
    else setUploadErr(res.error);
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Photo de l'article */}
      <div className="field">
        <label>Photo</label>
        <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <div
            style={{
              width: 96,
              height: 72,
              borderRadius: 10,
              flex: "0 0 auto",
              backgroundSize: "cover",
              backgroundPosition: "center",
              background: form.image_url
                ? `center/cover no-repeat url(${form.image_url})`
                : "linear-gradient(140deg,#c69a5e,#9a6f3c)",
              border: "1px solid var(--brand-border)",
            }}
          />
          <div style={{ flex: 1 }}>
            <input type="file" accept="image/*" onChange={onPickFile} disabled={uploading} />
            <input
              style={{ marginTop: 8 }}
              placeholder="…ou coller une URL d'image"
              value={form.image_url ?? ""}
              onChange={(e) => setForm({ ...form, image_url: e.target.value || null })}
            />
            {uploading && <div className="muted" style={{ fontSize: "0.8rem", marginTop: 6 }}>Envoi…</div>}
            {uploadErr && (
              <div style={{ color: "#c0392b", fontSize: "0.8rem", marginTop: 6 }}>{uploadErr}</div>
            )}
          </div>
        </div>
      </div>

      <div className="field">
        <label>Nom</label>
        <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="field">
        <label>Description</label>
        <input
          value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Prix ({/* currency handled server-side */}CHF)</label>
          <input
            type="number"
            step="0.05"
            defaultValue={priceInput}
            onChange={(e) =>
              setForm({ ...form, price_cents: Math.round(Number(e.target.value) * 100) })
            }
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>TVA</label>
          <select
            value={String(form.vat_rate ?? 2.6)}
            onChange={(e) => setForm({ ...form, vat_rate: Number(e.target.value) })}
          >
            <option value="2.6">2.6 % (à emporter)</option>
            <option value="8.1">8.1 % (alcool)</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Catégorie</label>
        <select
          value={form.category_id ?? ""}
          onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}
        >
          <option value="">— Aucune —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <label className="row" style={{ fontWeight: 400 }}>
        <input
          type="checkbox"
          checked={form.is_available ?? true}
          onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
          style={{ width: "auto" }}
        />
        <span>Disponible</span>
      </label>
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn" disabled={pending} onClick={() => onSave(form)}>
          Enregistrer
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}
