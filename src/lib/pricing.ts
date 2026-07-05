/**
 * Calcul des prix et de la TVA — TOUJOURS côté serveur.
 *
 * Modèle suisse : les prix menu (`menu_items.price_cents`) sont affichés
 * TTC (TVA incluse), conformément à l'ordonnance sur l'indication des prix.
 * La TVA est donc *contenue* dans le prix, calculée PAR LIGNE selon le taux
 * de la ligne (2.6 % à emporter, 8.1 % alcool) et ventilée par taux sur le
 * reçu. Aucun montant n'est ajouté au checkout (pas de frais/livraison en V1),
 * donc `total_cents == subtotal_cents`.
 *
 * Les montants venant du client ne sont JAMAIS utilisés : on repart toujours
 * de `unit_price_cents`/`vat_rate` figés depuis la base.
 */

export type PricedLineInput = {
  /** Prix unitaire TTC en centimes (figé depuis menu_items.price_cents). */
  unitPriceCents: number;
  /** Taux de TVA de la ligne, en pourcentage (2.6, 8.1…). */
  vatRate: number;
  /** Quantité (entier > 0). */
  qty: number;
};

export type PricedLine = PricedLineInput & {
  /** Total TTC de la ligne (unit × qty). */
  lineGrossCents: number;
  /** TVA contenue dans la ligne. */
  lineVatCents: number;
};

export type PricedOrder = {
  lines: PricedLine[];
  subtotalCents: number;
  totalCents: number;
  /** TVA contenue, ventilée par taux, ex. { "2.6": 130, "8.1": 40 }. */
  vatBreakdown: Record<string, number>;
};

/** TVA contenue dans un montant TTC pour un taux donné (arrondi au centime). */
export function includedVat(grossCents: number, vatRate: number): number {
  return Math.round((grossCents * vatRate) / (100 + vatRate));
}

/** Clé de ventilation stable pour un taux ("2.6", "8.1"). */
export function vatRateKey(vatRate: number): string {
  return String(vatRate);
}

/**
 * Calcule le récapitulatif complet d'une commande à partir des lignes
 * (déjà validées/fetchées côté serveur).
 */
export function priceOrder(inputs: PricedLineInput[]): PricedOrder {
  const lines: PricedLine[] = [];
  const vatBreakdown: Record<string, number> = {};
  let subtotalCents = 0;

  for (const input of inputs) {
    if (!Number.isInteger(input.qty) || input.qty <= 0) {
      throw new Error(`Quantité invalide : ${input.qty}`);
    }
    const lineGrossCents = input.unitPriceCents * input.qty;
    const lineVatCents = includedVat(lineGrossCents, input.vatRate);

    lines.push({ ...input, lineGrossCents, lineVatCents });
    subtotalCents += lineGrossCents;

    const key = vatRateKey(input.vatRate);
    vatBreakdown[key] = (vatBreakdown[key] ?? 0) + lineVatCents;
  }

  return {
    lines,
    subtotalCents,
    totalCents: subtotalCents,
    vatBreakdown,
  };
}

/** Formatage d'un montant en centimes vers une chaîne (ex. "20.52"). */
export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
