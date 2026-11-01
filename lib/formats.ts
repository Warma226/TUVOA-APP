// Formats des visuels (sans dépendance serveur : utilisable dans le navigateur).
export type VisualFormat = "portrait" | "carre" | "paysage" | "vertical";
export const FORMATS: Record<VisualFormat, { w: number; h: number; label: string }> = {
  portrait: { w: 1080, h: 1350, label: "4:5 · 1080 × 1350" },
  carre: { w: 1080, h: 1080, label: "Carré · 1080 × 1080" },
  paysage: { w: 1200, h: 630, label: "Paysage · 1200 × 630" },
  vertical: { w: 1080, h: 1920, label: "Vertical · 1080 × 1920" },
};

export function formatFor(platform: string, rubrique: string): VisualFormat {
  if (platform === "tiktok") return "vertical";
  if (platform === "wordpress") return "paysage";
  // Facebook et LinkedIn : même visuel 4:5 (1080 × 1350).
  void rubrique;
  return "portrait";
}
