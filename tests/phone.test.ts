import { describe, it, expect } from "vitest";
import { normalizePhone, tryNormalizePhone, InvalidPhoneError } from "@/lib/phone";

describe("normalisation téléphone E.164", () => {
  it("079…, +4179…, 0041 79… résolvent vers le MÊME E.164 (CH)", () => {
    const a = normalizePhone("079 123 45 67", "CH");
    const b = normalizePhone("+41 79 123 45 67", "CH");
    const c = normalizePhone("0041 79 123 45 67", "CH");
    expect(a.e164).toBe("+41791234567");
    expect(b.e164).toBe("+41791234567");
    expect(c.e164).toBe("+41791234567");
  });

  it("détecte le pays et produit un affichage national", () => {
    const n = normalizePhone("0791234567", "CH");
    expect(n.country).toBe("CH");
    expect(n.display).toContain("79");
  });

  it("accepte un numéro international (touriste) — ex. France", () => {
    const n = normalizePhone("+33 6 12 34 56 78", "CH");
    expect(n.e164).toBe("+33612345678");
    expect(n.country).toBe("FR");
  });

  it("accepte un numéro US saisi au format international", () => {
    const n = normalizePhone("+1 202 555 0182", "CH");
    expect(n.e164).toBe("+12025550182");
  });

  it("lève InvalidPhoneError sur une saisie invalide", () => {
    expect(() => normalizePhone("12", "CH")).toThrow(InvalidPhoneError);
    expect(() => normalizePhone("", "CH")).toThrow(InvalidPhoneError);
    expect(() => normalizePhone("pas un numéro", "CH")).toThrow();
  });

  it("tryNormalizePhone renvoie null au lieu de lever", () => {
    expect(tryNormalizePhone("12", "CH")).toBeNull();
    expect(tryNormalizePhone("079 123 45 67", "CH")?.e164).toBe("+41791234567");
  });
});
