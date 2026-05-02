import type { LandingAccent } from "./content";

export type LandingAccentStyle = {
  accent: string;
  dim: string;
  glow: string;
};

export function getLandingAccentStyle(accent: LandingAccent): LandingAccentStyle {
  if (accent === "secondary") {
    return {
      accent: "var(--accent-secondary)",
      dim: "var(--accent-secondary-dim)",
      glow: "var(--accent-secondary-glow)",
    };
  }

  return {
    accent: "var(--accent-primary)",
    dim: "var(--accent-primary-dim)",
    glow: "var(--accent-primary-glow)",
  };
}

export const LANDING_TICKER_ACCENT_COLOR = {
  primary: "var(--accent-primary)",
  secondary: "var(--accent-secondary)",
  neutral: "var(--tone-bark)",
} as const;