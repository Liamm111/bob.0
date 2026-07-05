import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export type NormalizedPhone = {
  /** Format canonique E.164, ex. +41791234567 — clé d'identité client. */
  e164: string;
  /** Format lisible national/international, ex. "079 123 45 67". */
  display: string;
  /** Indicatif pays détecté, ex. "CH". */
  country: CountryCode | undefined;
};

export class InvalidPhoneError extends Error {
  constructor(input: string) {
    super(`Numéro de téléphone invalide : ${input}`);
    this.name = "InvalidPhoneError";
  }
}

/**
 * Normalise un numéro saisi en E.164, en utilisant l'indicatif par défaut du
 * café (`cafes.country_default`) pour les numéros nationaux sans préfixe.
 *
 * Garantit qu'un même client — qu'il tape `079…`, `+4179…` ou `0041 79…` —
 * résout vers UN seul `phone_e164`, donc un seul compte `(cafe_id, phone_e164)`.
 * Les numéros internationaux (touristes) sont acceptés nativement.
 *
 * @throws {InvalidPhoneError} si le numéro n'est pas valide.
 */
export function normalizePhone(
  input: string,
  defaultCountry: string,
): NormalizedPhone {
  const raw = (input ?? "").trim();
  if (!raw) throw new InvalidPhoneError(input);

  const parsed = parsePhoneNumberFromString(
    raw,
    defaultCountry.toUpperCase() as CountryCode,
  );

  if (!parsed || !parsed.isValid()) {
    throw new InvalidPhoneError(input);
  }

  return {
    e164: parsed.number,
    display: parsed.formatNational(),
    country: parsed.country,
  };
}

/** Variante non-levante : renvoie `null` au lieu de lever. */
export function tryNormalizePhone(
  input: string,
  defaultCountry: string,
): NormalizedPhone | null {
  try {
    return normalizePhone(input, defaultCountry);
  } catch {
    return null;
  }
}
