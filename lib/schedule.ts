// Créneaux des rubriques à heure fixe (#CyberBase : chaque jour à 8 h).
import { RUBRIQUES, type RubriqueId } from "./config";
import type { Post } from "./store";

const ACTIFS: Post["status"][] = ["planifie", "a_valider", "publie"];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function heureFixe(rubrique: RubriqueId): number | undefined {
  return RUBRIQUES.find((r) => r.id === rubrique)?.heure;
}

// Jours (à partir d'aujourd'hui) qui ont déjà un post de cette rubrique.
function joursPris(posts: Post[], rubrique: RubriqueId, sauf?: string): Set<string> {
  return new Set(
    posts
      .filter((p) => p.rubrique === rubrique && p.id !== sauf && ACTIFS.includes(p.status) && p.scheduled_at)
      .map((p) => dayKey(new Date(p.scheduled_at as string)))
  );
}

// Prochain créneau libre : aujourd'hui à l'heure fixe si elle n'est pas passée, sinon les jours suivants.
export function prochainCreneau(posts: Post[], rubrique: RubriqueId, sauf?: string, from = new Date()): Date | null {
  const h = heureFixe(rubrique);
  if (h === undefined) return null;
  const pris = joursPris(posts, rubrique, sauf);
  for (let i = 0; i < 60; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, h, 0);
    if (d.getTime() > from.getTime() && !pris.has(dayKey(d))) return d;
  }
  return null;
}

// Jours des 7 prochains sans post de cette rubrique (pour le rappel du calendrier).
export function joursManquants(posts: Post[], rubrique: RubriqueId, from = new Date()): Date[] {
  const h = heureFixe(rubrique);
  if (h === undefined) return [];
  const pris = joursPris(posts, rubrique);
  const out: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, h, 0);
    if (d.getTime() > from.getTime() && !pris.has(dayKey(d))) out.push(d);
  }
  return out;
}
