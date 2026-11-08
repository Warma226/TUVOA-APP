"use client";
// Listes longues : on montre les 5 premiers éléments, puis « Voir plus » en ajoute 5 à chaque clic.
import { useEffect, useState } from "react";

export function useVoirPlus<T>(items: T[], pas = 5, cle?: unknown) {
  const [n, setN] = useState(pas);
  useEffect(() => setN(pas), [cle, pas]);
  const reste = Math.max(0, items.length - n);
  const bouton =
    items.length > pas ? (
      <div className="tv-voirplus">
        {reste > 0 ? (
          <button type="button" onClick={() => setN(n + pas)}>Voir plus <span>({reste} de plus)</span></button>
        ) : (
          <button type="button" onClick={() => setN(pas)}>Voir moins</button>
        )}
      </div>
    ) : null;
  return { visibles: items.slice(0, n), bouton };
}
