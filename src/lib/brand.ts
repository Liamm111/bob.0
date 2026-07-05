import type { BrandTokens } from "@/lib/cafe";

/**
 * Traduit les brand_tokens du café en variables CSS inline. Aucune couleur
 * n'est codée en dur : un café sans tokens garde les valeurs neutres par défaut
 * (globals.css). C'est ce qui rend le thème 100 % piloté par la base.
 */
export function brandStyle(tokens: BrandTokens): React.CSSProperties {
  const style: Record<string, string> = {};
  if (tokens.primary) style["--brand-primary"] = tokens.primary;
  if (tokens.accent) style["--brand-accent"] = tokens.accent;
  if (tokens.bg) style["--brand-bg"] = tokens.bg;
  return style as React.CSSProperties;
}
