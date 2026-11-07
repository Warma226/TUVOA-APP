"use client";
// Briques communes des ateliers de création (une page par rubrique, jamais mélangées).
import Link from "next/link";
import type { RubriqueId } from "@/lib/config";
import type { Post } from "@/lib/store";
import { Trait } from "./BottomNav";
import { heureFixe } from "@/lib/schedule";

export const RUB: Record<RubriqueId, { nom: string; titre: string; c: [string, string]; d: string; pastille: [string, string] }> = {
  actu: { nom: "Actualité", titre: "Nouvelle actualité", c: ["#60A5FA", "#1D4ED8"], d: "M4 5h16v14H4zM8 9h8M8 13h5", pastille: ["#DBE7FF", "#1D4ED8"] },
  citation: { nom: "Citation", titre: "Nouvelle citation", c: ["#C4B5FD", "#7C3AED"], d: "M7 7h4v6H5V9a2 2 0 0 1 2-2zM15 7h4v6h-6V9a2 2 0 0 1 2-2zM5 13c0 2 1 3 3 4M13 13c0 2 1 3 3 4", pastille: ["#EDE7FF", "#5B21B6"] },
  cyberbase: { nom: "#CyberBase", titre: "Nouvelle #CyberBase", c: ["#5EEAD4", "#0E9F8E"], d: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z", pastille: ["#D5F5F0", "#0B6B60"] },
  portrait: { nom: "Portrait", titre: "Nouveau portrait", c: ["#FDBA74", "#E94A06"], d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0", pastille: ["#FFE8DC", "#9A3412"] },
};

export function Tuile({ rub, taille = 52 }: { rub: RubriqueId; taille?: number }) {
  const r = RUB[rub];
  return (
    <span aria-hidden="true" style={{ width: taille, height: taille, borderRadius: Math.round(taille * 0.29), flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(145deg, ${r.c[0]}, ${r.c[1]})`, color: "#fff" }}>
      <Trait d={r.d} size={Math.round(taille * 0.5)} stroke={2} />
    </span>
  );
}

export type Etape = { id: string; l: string; etat: "fait" | "cours" | "" };

export function AtelierEntete({ rub, etapes, enregistre }: { rub: RubriqueId; etapes: Etape[]; enregistre?: string }) {
  return (
    <div className="tv-entete">
      <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 6 }}>
        <Link href="/creer" className="tv-gris" style={{ textDecoration: "none", fontWeight: 600 }}>← Créer</Link>
        <div className="row" style={{ gap: 14 }}>
          <Tuile rub={rub} />
          <h1 className="tv-titre">{RUB[rub].titre}</h1>
        </div>
        {enregistre ? <span className="tv-gris" style={{ fontSize: 13 }}>{enregistre}</span> : null}
      </div>
      <ol className="tv-etapes" aria-label="Étapes">
        {etapes.map((e, i) => (
          <li key={e.id}>
            <a href={`#${e.id}`} aria-current={e.etat === "cours" ? "step" : undefined} data-etat={e.etat}>
              <span>{e.etat === "fait" ? <Trait d="M20 6L9 17l-5-5" size={14} stroke={3} /> : i + 1}</span>
              {e.l}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Carte({ id, titre, extra, children, ton }: { id: string; titre: string; extra?: React.ReactNode; children: React.ReactNode; ton?: "orange" }) {
  return (
    <section id={id} aria-labelledby={`t-${id}`} className={`tv-carte${ton ? ` ${ton}` : ""}`}>
      <div className="row" style={{ flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
        <h2 id={`t-${id}`} className="tv-h2" style={{ flex: 1 }}>{titre}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function Jauge({ n, ideal, pli, max, unite = "car." }: { n: number; ideal: [number, number]; pli?: number; max: number; unite?: string }) {
  const pc = (v: number) => `${Math.min(100, (v / max) * 100).toFixed(1)}%`;
  const ok = n >= ideal[0] && n <= ideal[1];
  return (
    <div className="tv-jauge" aria-label={`${n} ${unite}, idéal ${ideal[0]} à ${ideal[1]}`} role="img">
      <span className="zone" style={{ left: pc(ideal[0]), width: `calc(${pc(ideal[1])} - ${pc(ideal[0])})` }} />
      {pli ? <span className="pli" style={{ left: pc(pli) }} /> : null}
      {n > 0 ? <span className={`point${ok ? "" : " hors"}`} style={{ left: pc(n) }} /> : null}
    </div>
  );
}

export const CANAUX: { id: Post["platforms"][number]; ini: string; nom: string; c: string }[] = [
  { id: "facebook", ini: "F", nom: "Facebook", c: "#1877F2" },
  { id: "linkedin", ini: "in", nom: "LinkedIn", c: "#0A66C2" },
  { id: "wordpress", ini: "W", nom: "Site tuvoa.media", c: "#0A2A66" },
  { id: "tiktok", ini: "T", nom: "TikTok", c: "#0B1A33" },
];

export function Canaux({ value, onChange, details, offerts = ["facebook", "linkedin", "wordpress", "tiktok"] }: {
  value: Post["platforms"]; onChange: (v: Post["platforms"]) => void; details: Partial<Record<Post["platforms"][number], string>>; offerts?: Post["platforms"];
}) {
  return (
    <div className="tv-canaux">
      {CANAUX.filter((c) => offerts.includes(c.id)).map((c) => {
        const on = value.includes(c.id);
        return (
          <label key={c.id} className="tv-canal-choix" data-on={on}>
            <span className="ico" style={{ background: c.c }}>{c.ini}</span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <strong style={{ fontSize: 14 }}>{c.nom}</strong>
              <span style={{ fontSize: 12, color: "#5B6B86" }}>{details[c.id] ?? ""}</span>
            </span>
            <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== c.id) : [...value, c.id])} />
          </label>
        );
      })}
    </div>
  );
}

export type Quand = "libre" | "maintenant" | "choisir" | "brouillon";
export function ChoixQuand({ value, onChange, libre, libreTitre = "Prochain créneau libre", custom, setCustom, note, options = ["libre", "maintenant", "choisir"] }: {
  value: Quand; onChange: (q: Quand) => void; libre: Date | null; libreTitre?: string; custom: string; setCustom: (s: string) => void; note?: string; options?: Quand[];
}) {
  const OPTS: Record<Quand, [string, string]> = {
    libre: [libreTitre, libre ? dateLongue(libre) : "Aucun créneau trouvé"],
    maintenant: ["Tout de suite", "Publié dès que vous validez"],
    choisir: ["Choisir", "Une date et une heure"],
    brouillon: ["Plus tard", "Reste en brouillon"],
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>Quand ?</span>
      <div role="radiogroup" aria-label="Quand" className="tv-choix">
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} disabled={o === "libre" && !libre}>
            <span className="row" style={{ gap: 8 }}><span className="radio" /><strong style={{ fontSize: 14 }}>{OPTS[o][0]}</strong></span>
            <span style={{ fontSize: 13, color: "#33425C", paddingLeft: 26 }}>{OPTS[o][1]}</span>
          </button>
        ))}
      </div>
      {value === "choisir" ? (
        <label className="field" style={{ maxWidth: 320 }}>Date et heure<input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} /></label>
      ) : null}
      {note ? <span className="row" style={{ gap: 8, fontSize: 13, color: "#5B6B86" }}><span style={{ width: 8, height: 8, borderRadius: 4, background: "#7C3AED", flexShrink: 0 }} />{note}</span> : null}
    </div>
  );
}

export function Controle({ items }: { items: [string, boolean][] }) {
  return (
    <section aria-labelledby="t-controle" className="tv-carte-side">
      <h2 id="t-controle" className="tv-h2" style={{ fontSize: 18 }}>Contrôle avant départ</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map(([t, ok]) => (
          <li key={t} className="row" style={{ gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.4 }}>
            <span style={{ width: 20, height: 20, borderRadius: 10, flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", background: ok ? "#16A34A" : "#E94A06", color: "#fff" }}>
              <Trait d={ok ? "M20 6L9 17l-5-5" : "M12 8v5M12 17h.01"} size={12} stroke={3.2} />
            </span>
            <span style={{ color: ok ? "#33425C" : "#9A3412", fontWeight: ok ? 400 : 600 }}>{t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Aperçu Facebook : le pli « Voir plus » tombe vers 125 caractères sur téléphone.
export function ApercuFacebook({ texte, image, quand, vide, pli = 125 }: { texte: string; image?: string; quand?: string; vide?: string; pli?: number }) {
  const court = texte.length > pli ? texte.slice(0, pli).replace(/\s+\S*$/, "") : texte;
  return (
    <article className="tv-fb">
      <div className="row" style={{ gap: 10, padding: "12px 12px 8px" }}>
        <span style={{ width: 36, height: 36, borderRadius: 18, background: "#0A2A66", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ width: 12, height: 12, borderRadius: 6, background: "#2563EB" }} /></span>
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}><strong style={{ fontSize: 13 }}>TUVOA Tech Media</strong><span style={{ fontSize: 11, color: "#5B6B86" }}>{quand ?? "Brouillon"}</span></span>
      </div>
      {texte ? (
        <p style={{ padding: "0 12px 10px", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {court}{texte.length > court.length ? <>… <span style={{ color: "#5B6B86", fontWeight: 600 }}>Voir plus</span></> : null}
        </p>
      ) : <p style={{ padding: "0 12px 10px", fontSize: 13, color: "#5B6B86" }}>{vide ?? "Le texte apparaîtra ici."}</p>}
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="Visuel de la publication" style={{ display: "block", width: "100%", aspectRatio: "4 / 5", objectFit: "cover", background: "#EEF2F8" }} />
      ) : null}
    </article>
  );
}

export function BarreActions({ resume, busy, onBrouillon, onEditeur, onPlanifier, planifier, desactive }: {
  resume: string; busy: boolean; onBrouillon: () => void; onEditeur: () => void; onPlanifier: () => void; planifier: string; desactive?: boolean;
}) {
  return (
    <div className="tv-barre">
      <span className="tv-gris" style={{ flex: "1 1 240px", fontSize: 13 }}>{resume}</span>
      <button type="button" className="btn" onClick={onBrouillon} disabled={busy}>Garder en brouillon</button>
      <button type="button" className="btn" onClick={onEditeur} disabled={busy}>Ouvrir dans l'éditeur</button>
      <button type="button" className="tv-btn-nuit" onClick={onPlanifier} disabled={busy || desactive}>
        <Trait d="M3 5h18v16H3zM16 3v4M8 3v4M3 10h18" size={18} stroke={2} />{busy ? "UN INSTANT…" : planifier}
      </button>
    </div>
  );
}

export function dateLongue(d: Date): string {
  const auj = new Date();
  const dem = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() + 1);
  const h = `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === auj.toDateString()) return `Aujourd'hui · ${h}`;
  if (d.toDateString() === dem.toDateString()) return `Demain · ${h}`;
  const j = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return `${j.charAt(0).toUpperCase()}${j.slice(1)} · ${h}`;
}
export function heureCourte(d: Date): string {
  const auj = new Date().toDateString() === d.toDateString();
  return `${auj ? "" : d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").toUpperCase() + ". "}${d.getHours()} H ${String(d.getMinutes()).padStart(2, "0")}`;
}

// Prochain créneau libre selon le rythme de la rubrique.
export function creneauLibre(posts: Post[], rub: RubriqueId, from = new Date()): Date | null {
  const actifs = posts.filter((p) => ["planifie", "a_valider"].includes(p.status) && p.scheduled_at).map((p) => ({ r: p.rubrique, t: new Date(p.scheduled_at as string).getTime() }));
  const debut = from.getTime() + 20 * 60000;
  if (rub === "cyberbase") {
    for (let j = 0; j < 30; j++) {
      const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + j, heureFixe("cyberbase") ?? 7, 0);
      if (d.getTime() < debut) continue;
      if (!posts.some((p) => p.rubrique === "cyberbase" && ["planifie", "a_valider", "publie"].includes(p.status) && p.scheduled_at && new Date(p.scheduled_at).toDateString() === d.toDateString())) return d;
    }
    return null;
  }
  if (rub === "citation") {
    for (let j = 0; j < 30; j++) {
      for (let h = 8; h <= 22; h += 2) {
        const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + j, h, 0);
        if (d.getTime() < debut) continue;
        if (!actifs.some((a) => a.r === "citation" && Math.abs(a.t - d.getTime()) < 60 * 60000)) return d;
      }
    }
    return null;
  }
  // Actualité, portrait : demi-heure suivante, à 30 min au moins de tout autre post
  const d = new Date(Math.ceil(debut / (30 * 60000)) * 30 * 60000);
  for (let i = 0; i < 48 * 14; i++) {
    const t = d.getTime() + i * 30 * 60000;
    const h = new Date(t).getHours();
    if (h < 6 || h > 21) continue;
    if (!actifs.some((a) => Math.abs(a.t - t) < 30 * 60000)) return new Date(t);
  }
  return null;
}

export function versLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
