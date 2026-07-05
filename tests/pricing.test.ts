import { describe, it, expect } from "vitest";
import {
  includedVat,
  priceOrder,
  vatRateKey,
  formatCents,
} from "@/lib/pricing";

describe("TVA incluse (modèle suisse TTC)", () => {
  it("calcule la TVA contenue à 2.6 %", () => {
    // 1000 cts TTC à 2.6 % → TVA = 1000 * 2.6/102.6 ≈ 25.34 → 25
    expect(includedVat(1000, 2.6)).toBe(25);
  });

  it("calcule la TVA contenue à 8.1 % (alcool)", () => {
    // 950 cts TTC à 8.1 % → 950 * 8.1/108.1 ≈ 71.18 → 71
    expect(includedVat(950, 8.1)).toBe(71);
  });

  it("ventile la TVA PAR LIGNE et par taux, jamais globalement", () => {
    const order = priceOrder([
      { unitPriceCents: 450, vatRate: 2.6, qty: 2 }, // café x2 = 900
      { unitPriceCents: 950, vatRate: 8.1, qty: 1 }, // mimosa = 950
    ]);

    expect(order.subtotalCents).toBe(1850);
    expect(order.totalCents).toBe(1850); // TTC : total == subtotal
    expect(order.vatBreakdown[vatRateKey(2.6)]).toBe(includedVat(900, 2.6));
    expect(order.vatBreakdown[vatRateKey(8.1)]).toBe(includedVat(950, 8.1));
  });

  it("agrège la TVA de plusieurs lignes au même taux", () => {
    const order = priceOrder([
      { unitPriceCents: 450, vatRate: 2.6, qty: 1 },
      { unitPriceCents: 340, vatRate: 2.6, qty: 3 },
    ]);
    const expected = includedVat(450, 2.6) + includedVat(340 * 3, 2.6);
    expect(order.vatBreakdown["2.6"]).toBe(expected);
    expect(Object.keys(order.vatBreakdown)).toEqual(["2.6"]);
  });

  it("rejette une quantité invalide", () => {
    expect(() => priceOrder([{ unitPriceCents: 100, vatRate: 2.6, qty: 0 }])).toThrow();
    expect(() =>
      priceOrder([{ unitPriceCents: 100, vatRate: 2.6, qty: 1.5 }]),
    ).toThrow();
  });

  it("formatCents rend une chaîne à 2 décimales", () => {
    expect(formatCents(2052)).toBe("20.52");
    expect(formatCents(400)).toBe("4.00");
  });

  it("clé de taux stable (2.6 et non 2.60)", () => {
    expect(vatRateKey(2.6)).toBe("2.6");
    expect(vatRateKey(8.1)).toBe("8.1");
  });
});
