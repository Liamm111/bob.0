"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

export type CartLine = {
  menuItemId: string;
  name: string;
  unitPriceCents: number;
  vatRate: number;
  qty: number;
  note?: string;
};

type CartState = {
  lines: CartLine[];
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (menuItemId: string, qty: number) => void;
  setNote: (menuItemId: string, note: string) => void;
  remove: (menuItemId: string) => void;
  clear: () => void;
  count: number;
  /** Sous-total indicatif (TTC) — le montant réel est recalculé serveur. */
  subtotalCents: number;
};

const CartCtx = createContext<CartState | null>(null);

export function CartProvider({
  cafeSlug,
  children,
}: {
  cafeSlug: string;
  children: React.ReactNode;
}) {
  const storageKey = `cart:${cafeSlug}`;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Charge depuis localStorage (par café).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines, loaded, storageKey]);

  const add = useCallback((line: Omit<CartLine, "qty">, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.menuItemId === line.menuItemId);
      if (existing) {
        return prev.map((l) =>
          l.menuItemId === line.menuItemId ? { ...l, qty: l.qty + qty } : l,
        );
      }
      return [...prev, { ...line, qty }];
    });
  }, []);

  const setQty = useCallback((menuItemId: string, qty: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.menuItemId === menuItemId ? { ...l, qty } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  const setNote = useCallback((menuItemId: string, note: string) => {
    setLines((prev) =>
      prev.map((l) => (l.menuItemId === menuItemId ? { ...l, note } : l)),
    );
  }, []);

  const remove = useCallback((menuItemId: string) => {
    setLines((prev) => prev.filter((l) => l.menuItemId !== menuItemId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartState>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotalCents = lines.reduce((n, l) => n + l.unitPriceCents * l.qty, 0);
    return { lines, add, setQty, setNote, remove, clear, count, subtotalCents };
  }, [lines, add, setQty, setNote, remove, clear]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart doit être utilisé dans <CartProvider>");
  return ctx;
}
