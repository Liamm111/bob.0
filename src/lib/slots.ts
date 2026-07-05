/**
 * Génération des créneaux de retrait et calcul de disponibilité.
 *
 * Les créneaux sont dérivés EN CODE de l'unique ligne `slots_config` du café
 * (rien n'est stocké par créneau). Règles :
 *  - `is_ordering_open = false` (Rush stop) → aucun créneau.
 *  - un créneau doit être au moins à `min_prep_minutes` dans le futur.
 *  - la capacité (`capacity_per_slot`) est décomptée par les commandes qui
 *    "tiennent" une place : payées (paid/preparing/ready) + réservations soft
 *    (pending_payment récentes). Le décompte réel vient de la base ; ici on
 *    fournit la génération pure + la fusion avec les compteurs.
 */

export const SOFT_RESERVATION_MINUTES = 10;

export type SlotsConfigLike = {
  open_time: string; // "08:00" ou "08:00:00"
  close_time: string; // "15:00"
  slot_minutes: number;
  capacity_per_slot: number;
  min_prep_minutes: number;
  is_ordering_open: boolean;
};

export type Slot = {
  /** Instant du créneau en ISO (UTC). Correspond à orders.pickup_slot. */
  at: string;
  capacity: number;
  taken: number;
  available: boolean;
};

/** Décalage (tz - UTC) en ms pour un instant donné dans un fuseau. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  const asUTC = Date.UTC(
    map.year!,
    map.month! - 1,
    map.day!,
    map.hour === 24 ? 0 : map.hour!,
    map.minute!,
    map.second!,
  );
  return asUTC - date.getTime();
}

/** Convertit une heure murale (dans `timeZone`) en instant UTC. */
function zonedWallTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offset = tzOffsetMs(new Date(guessUtc), timeZone);
  return new Date(guessUtc - offset);
}

/** Composants calendaires (dans `timeZone`) d'un instant. */
function zonedParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

function parseHm(t: string): { h: number; m: number } {
  const [h, m] = t.split(":");
  return { h: Number(h), m: Number(m ?? 0) };
}

export type GenerateOptions = {
  now?: Date;
  timeZone: string;
  /** Nombre de jours (incluant aujourd'hui) à proposer. Défaut 1 (jour même). */
  daysAhead?: number;
  /**
   * Fenêtre maximale de réservation en avance, en minutes. Un créneau au-delà
   * de `now + maxAheadMinutes` n'est pas proposé. Non défini = pas de plafond.
   */
  maxAheadMinutes?: number;
};

/**
 * Génère les instants de créneaux candidats (ISO UTC), filtrés par le délai
 * de préparation ET par la fenêtre maximale de réservation. Renvoie `[]` si la
 * prise de commande est fermée (rush stop).
 */
export function generateSlotTimes(
  config: SlotsConfigLike,
  opts: GenerateOptions,
): string[] {
  if (!config.is_ordering_open) return [];

  const now = opts.now ?? new Date();
  const daysAhead = opts.daysAhead ?? 1;
  const tz = opts.timeZone;
  const earliest = new Date(now.getTime() + config.min_prep_minutes * 60_000);
  const latest =
    opts.maxAheadMinutes != null
      ? new Date(now.getTime() + opts.maxAheadMinutes * 60_000)
      : null;

  const open = parseHm(config.open_time);
  const close = parseHm(config.close_time);
  const step = config.slot_minutes;
  if (step <= 0) return [];

  const times: string[] = [];
  const today = zonedParts(now, tz);
  const base = new Date(Date.UTC(today.year, today.month - 1, today.day));

  for (let d = 0; d < daysAhead; d++) {
    const day = new Date(base.getTime() + d * 86_400_000);
    const dp = zonedParts(day, tz);

    const openMin = open.h * 60 + open.m;
    const closeMin = close.h * 60 + close.m;
    for (let mins = openMin; mins < closeMin; mins += step) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const at = zonedWallTimeToUtc(dp.year, dp.month, dp.day, h, m, tz);
      if (at.getTime() < earliest.getTime()) continue;
      if (latest && at.getTime() > latest.getTime()) continue;
      times.push(at.toISOString());
    }
  }

  return times;
}

/**
 * Fusionne les instants candidats avec les compteurs de places prises
 * (venant de la base, clé = ISO du créneau) et la capacité.
 */
export function buildSlotAvailability(
  times: string[],
  capacityPerSlot: number,
  takenByIso: Record<string, number>,
): Slot[] {
  return times.map((at) => {
    const taken = takenByIso[at] ?? 0;
    return {
      at,
      capacity: capacityPerSlot,
      taken,
      available: taken < capacityPerSlot,
    };
  });
}

/** Un créneau donné a-t-il encore de la place (décompte "soft" inclus) ? */
export function hasCapacity(taken: number, capacity: number): boolean {
  return taken < capacity;
}
