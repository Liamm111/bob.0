import { describe, it, expect } from "vitest";
import {
  generateSlotTimes,
  buildSlotAvailability,
  hasCapacity,
  type SlotsConfigLike,
} from "@/lib/slots";

const config: SlotsConfigLike = {
  open_time: "08:00",
  close_time: "15:00",
  slot_minutes: 15,
  capacity_per_slot: 8,
  min_prep_minutes: 20,
  is_ordering_open: true,
};

describe("génération de créneaux", () => {
  it("ne génère aucun créneau si la prise de commande est fermée (rush stop)", () => {
    const times = generateSlotTimes(
      { ...config, is_ordering_open: false },
      { now: new Date("2026-07-06T06:00:00Z"), timeZone: "Europe/Zurich" },
    );
    expect(times).toEqual([]);
  });

  it("respecte le délai de préparation minimal", () => {
    // Zurich est UTC+2 en été. 08:00 Zurich = 06:00 UTC.
    // now = 09:00 Zurich (07:00 UTC), prep 20 min → 1er créneau ≥ 09:20 Zurich.
    const now = new Date("2026-07-06T07:00:00Z");
    const times = generateSlotTimes(config, { now, timeZone: "Europe/Zurich", daysAhead: 1 });
    expect(times.length).toBeGreaterThan(0);
    const first = new Date(times[0]!);
    // 09:20 Zurich = 07:20 UTC ; le 1er créneau valide est 09:30 Zurich (07:30 UTC).
    expect(first.getTime()).toBeGreaterThanOrEqual(new Date("2026-07-06T07:20:00Z").getTime());
    // Aucun créneau avant now+prep.
    for (const t of times) {
      expect(new Date(t).getTime()).toBeGreaterThanOrEqual(
        now.getTime() + 20 * 60_000,
      );
    }
  });

  it("génère des créneaux aux bons intervalles dans la plage horaire", () => {
    // now très tôt → toute la journée dispo.
    const now = new Date("2026-07-06T00:00:00Z");
    const times = generateSlotTimes(config, { now, timeZone: "Europe/Zurich", daysAhead: 1 });
    // 08:00→15:00, pas de 15 min → 28 créneaux (08:00 … 14:45).
    expect(times.length).toBe(28);
    // Premier créneau = 08:00 Zurich = 06:00 UTC.
    expect(times[0]).toBe("2026-07-06T06:00:00.000Z");
    // Écart de 15 min entre deux créneaux consécutifs.
    const gap = new Date(times[1]!).getTime() - new Date(times[0]!).getTime();
    expect(gap).toBe(15 * 60_000);
  });

  it("plafonne à 2 h à l'avance (jour même uniquement)", () => {
    // now = 10:00 Zurich (08:00 UTC). Fenêtre : prep 20 min → 10:20,
    // plafond +120 min → 12:00. Créneaux attendus : 10:30, 10:45 … 12:00.
    const now = new Date("2026-07-06T08:00:00Z");
    const times = generateSlotTimes(config, {
      now,
      timeZone: "Europe/Zurich",
      daysAhead: 1,
      maxAheadMinutes: 120,
    });
    expect(times.length).toBeGreaterThan(0);
    const first = new Date(times[0]!).getTime();
    const last = new Date(times[times.length - 1]!).getTime();
    // Rien avant now+prep, rien après now+120min.
    expect(first).toBeGreaterThanOrEqual(now.getTime() + 20 * 60_000);
    expect(last).toBeLessThanOrEqual(now.getTime() + 120 * 60_000);
    // Dernier créneau = 12:00 Zurich = 10:00 UTC.
    expect(times[times.length - 1]).toBe("2026-07-06T10:00:00.000Z");
  });

  it("propose plusieurs jours", () => {
    const now = new Date("2026-07-06T00:00:00Z");
    const oneDay = generateSlotTimes(config, { now, timeZone: "Europe/Zurich", daysAhead: 1 });
    const twoDays = generateSlotTimes(config, { now, timeZone: "Europe/Zurich", daysAhead: 2 });
    expect(twoDays.length).toBe(oneDay.length * 2);
  });
});

describe("disponibilité et capacité", () => {
  it("marque un créneau plein comme indisponible", () => {
    const times = ["2026-07-06T06:00:00.000Z", "2026-07-06T06:15:00.000Z"];
    const slots = buildSlotAvailability(times, 8, { "2026-07-06T06:00:00.000Z": 8 });
    expect(slots[0]!.available).toBe(false);
    expect(slots[1]!.available).toBe(true);
    expect(slots[1]!.taken).toBe(0);
  });

  it("hasCapacity : la dernière place reste réservable, pas au-delà", () => {
    expect(hasCapacity(7, 8)).toBe(true); // 8e place
    expect(hasCapacity(8, 8)).toBe(false); // plein
    expect(hasCapacity(9, 8)).toBe(false); // survente
  });
});
