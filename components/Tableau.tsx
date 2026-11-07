"use client";
// Briques de la nouvelle interface : courbe des publications, stockage façon Windows.
import Link from "next/link";

export type Jour = { date: string; publie: number; citations: number; prevu: number; prevuCitations: number };
export type Stockage = { capacite: number; utilise: number; n: number; categories: Record<CatId, { n: number; taille: number }> };
export type CatId = "images" | "voix" | "videos" | "documents";

// ─── Courbe lissée (Catmull-Rom) ─────────────────────────────────────
const BAS = 206, HAUT = 20;
function lisse(P: [number, number][], from: number, to: number): string {
  let d = `M${P[from][0].toFixed(1)} ${P[from][1].toFixed(1)}`;
  for (let i = from; i < to; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, Math.min(BAS, p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, Math.min(BAS, p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1.map((v) => v.toFixed(1)).join(" ")} ${c2.map((v) => v.toFixed(1)).join(" ")} ${p2.map((v) => v.toFixed(1)).join(" ")}`;
  }
  return d;
}

export function libelleJour(iso: string, compact = false): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const wd = d.toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  const j = d.getUTCDate();
  return compact ? `${wd.charAt(0).toUpperCase()}${j}` : `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${j}`;
}

export function Courbe({ jours, auj, compact = false }: { jours: Jour[]; auj: number; compact?: boolean }) {
  const n = jours.length;
  // Passé : publié ; aujourd'hui : publié ; futur : planifié
  const tot = jours.map((j, i) => (i <= auj ? j.publie : j.prevu));
  const cit = jours.map((j, i) => (i <= auj ? j.citations : j.prevuCitations));
  const max = Math.max(5, ...tot.map((v, i) => (i === auj ? v + jours[auj].prevu : v))) * 1.12;
  const X = (i: number) => 20 + i * (960 / Math.max(1, n - 1));
  const Y = (v: number) => BAS - v * ((BAS - HAUT) / max);
  const P = tot.map((v, i) => [X(i), Y(v)] as [number, number]);
  const C = cit.map((v, i) => [X(i), Y(v)] as [number, number]);
  const ligne = lisse(P, 0, auj), cl = lisse(C, 0, auj);
  const fin = n - 1;
  const aire = `${ligne} L${X(auj)} ${BAS} L${X(0)} ${BAS} Z`;
  const aireCit = `${cl} L${X(auj)} ${BAS} L${X(0)} ${BAS} Z`;
  const px = X(auj), py = Y(tot[auj]);
  const encore = jours[auj]?.prevu ?? 0;
  const h = compact ? 150 : 240;
  const k = h / 240;
  const desc = jours.map((j, i) => `${libelleJour(j.date)} : ${i <= auj ? `${j.publie} publiées` : `${j.prevu} planifiées`}`).join(", ");
  return (
    <div style={{ overflowX: compact ? "visible" : "auto" }}>
      <div style={{ position: "relative", minWidth: compact ? 0 : 600, height: h + 40 }}>
        <svg viewBox="0 0 1000 240" preserveAspectRatio="none" width="100%" height={h} role="img" aria-label={`Publications par jour. ${desc}`} style={{ display: "block", overflow: "visible" }}>
          <defs>
            <linearGradient id="tv-aire" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity="0.35" /><stop offset="100%" stopColor="#2563EB" stopOpacity="0" /></linearGradient>
            <linearGradient id="tv-aire2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity="0.18" /><stop offset="100%" stopColor="#7C3AED" stopOpacity="0" /></linearGradient>
          </defs>
          <path d={`M0 ${HAUT} H1000 M0 ${(HAUT + BAS) / 2} H1000`} stroke="#E1E8F3" strokeWidth="1" vectorEffect="non-scaling-stroke" fill="none" />
          <path d={`M0 ${BAS} H1000`} stroke="#C9D3E3" strokeWidth="1" vectorEffect="non-scaling-stroke" fill="none" />
          <path d={aire} fill="url(#tv-aire)" />
          <path d={ligne} stroke="#2563EB" strokeWidth={compact ? 3 : 4} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {auj < fin ? <path d={lisse(P, auj, fin)} stroke="#2563EB" strokeWidth={compact ? 2.5 : 3} strokeDasharray="8 8" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : null}
          <path d={aireCit} fill="url(#tv-aire2)" />
          <path d={cl} stroke="#7C3AED" strokeWidth={compact ? 2.5 : 3} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {auj < fin ? <path d={lisse(C, auj, fin)} stroke="#7C3AED" strokeWidth="2.5" strokeDasharray="6 7" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : null}
          <path d={`M${px} 10 V${BAS}`} stroke="#E94A06" strokeWidth="1.5" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" fill="none" />
        </svg>
        <span aria-hidden="true" style={{ position: "absolute", left: `${px / 10}%`, top: py * k - 9, width: 18, height: 18, marginLeft: -9, borderRadius: 9, background: "#fff", border: "4px solid #2563EB", boxSizing: "border-box", boxShadow: "0 0 0 6px rgba(37,99,235,0.18)" }} />
        {!compact ? (
          <div aria-hidden="true" style={{ position: "absolute", left: `${px / 10}%`, top: Math.max(-6, py * k - 78), transform: "translateX(-50%)", padding: "8px 12px", borderRadius: 12, background: "#0A2A66", color: "#fff", display: "flex", flexDirection: "column", whiteSpace: "nowrap", boxShadow: "0 10px 24px rgba(10,42,102,0.25)" }}>
            <strong style={{ fontSize: 13 }}>Aujourd'hui</strong>
            <span style={{ fontSize: 12, color: "#C9D6F2" }}>{tot[auj]} publiée{tot[auj] > 1 ? "s" : ""} · {encore} encore prévue{encore > 1 ? "s" : ""}</span>
          </div>
        ) : null}
        <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: h + 12, height: 20 }}>
          {jours.map((j, i) => (
            <span key={j.date} style={{ position: "absolute", left: `${X(i) / 10}%`, transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: compact ? 11 : 12, color: i === auj ? "#0A2A66" : i > auj ? "#7C3AED" : "#5B6B86", fontWeight: i === auj ? 800 : i > auj ? 600 : 400 }}>
              {libelleJour(j.date, compact)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Stockage façon Windows ─────────────────────────────────────────
export function taille(o: number): string {
  if (o >= 1024 ** 3) return `${(o / 1024 ** 3).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Go`;
  if (o >= 1024 ** 2) return `${(o / 1024 ** 2).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
  if (o >= 1024) return `${Math.round(o / 1024)} Ko`;
  return `${o} o`;
}

export const CATS: { id: CatId; nom: string; dossier: string; couleur: string; d: string }[] = [
  { id: "images", nom: "Images", dossier: "Images", couleur: "#2563EB", d: "M3 5h18v14H3zM8 11a2 2 0 1 0 0-.01M21 15l-5-5L5 19" },
  { id: "voix", nom: "Voix off", dossier: "Voix off", couleur: "#7C3AED", d: "M12 3v18M8 8v8M4 11v2M16 6v12M20 10v4" },
  { id: "videos", nom: "Vidéos", dossier: "Vidéos", couleur: "#0E9F8E", d: "M3 6h13v12H3zM16 10l5-3v10l-5-3" },
  { id: "documents", nom: "Autres fichiers", dossier: "Documents", couleur: "#8A93A6", d: "M6 3h9l5 5v13H6zM14 3v6h6" },
];

type Ouvrir = { href: (c: CatId | null) => string } | { onOuvrir: (c: CatId | null) => void; ouvert?: CatId | null };

function Cible({ cat, o, className, children, label }: { cat: CatId | null; o: Ouvrir; className: string; children: React.ReactNode; label?: string }) {
  if ("href" in o) return <Link href={o.href(cat)} className={className} aria-label={label}>{children}</Link>;
  return <button type="button" className={className} aria-label={label} aria-current={o.ouvert === cat && cat ? "true" : undefined} onClick={() => o.onOuvrir(cat)}>{children}</button>;
}

export function Disque({ s, o }: { s: Stockage; o: Ouvrir }) {
  const libre = Math.max(0, s.capacite - s.utilise);
  const pct = Math.min(100, (s.utilise / s.capacite) * 100);
  return (
    <Cible cat={null} o={o} className="tv-disque">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" style={{ flexShrink: 0 }}><rect x="6" y="18" width="52" height="30" rx="5" fill="#E7ECF4" stroke="#9AA8BE" strokeWidth="2" /><rect x="6" y="38" width="52" height="10" rx="3" fill="#C9D3E3" /><circle cx="49" cy="43" r="2.5" fill="#22C55E" /><rect x="16" y="24" width="18" height="10" rx="2" fill="#2563EB" /><path d="M19 27h12M19 31h8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></svg>
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <strong style={{ fontSize: 15 }}>Stockage TUVOA (T:)</strong>
        <span className="tv-win-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Espace utilisé"><span style={{ width: `${pct}%` }} /></span>
        <span style={{ fontSize: 13, color: "#5B6B86" }}>{taille(libre)} libres sur {taille(s.capacite)}</span>
      </span>
    </Cible>
  );
}

export function Repartition({ s, o }: { s: Stockage; o: Ouvrir }) {
  const total = Math.max(1, s.utilise);
  return (
    <div className="tv-repart">
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 15 }}>{taille(s.utilise)} utilisés</strong>
        <span style={{ fontSize: 13, color: "#5B6B86" }}>· {taille(Math.max(0, s.capacite - s.utilise))} libres</span>
      </div>
      <div style={{ height: 10, borderRadius: 5, background: "#EDEFF3", overflow: "hidden", display: "flex" }} aria-hidden="true">
        {CATS.map((c) => (s.categories[c.id]?.taille ? <span key={c.id} style={{ width: `${(s.categories[c.id].taille / s.capacite) * 100}%`, minWidth: 6, background: c.couleur }} /> : null))}
      </div>
      {CATS.map((c) => {
        const v = s.categories[c.id] ?? { n: 0, taille: 0 };
        return (
          <Cible key={c.id} cat={c.id} o={o} className="tv-cat">
            <span className="tv-cat-ico" style={{ background: c.couleur }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={c.d} /></svg></span>
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <span style={{ display: "flex", gap: 8, fontSize: 14 }}><strong style={{ flex: 1 }}>{c.nom}</strong><span style={{ color: "#33425C" }}>{taille(v.taille)}</span></span>
              <span style={{ height: 4, borderRadius: 2, background: "#EDEFF3", display: "flex" }}><span style={{ width: `${(v.taille / total) * 100}%`, borderRadius: 2, background: c.couleur }} /></span>
            </span>
            <span aria-hidden="true" style={{ color: "#8A93A6", fontSize: 18 }}>›</span>
          </Cible>
        );
      })}
    </div>
  );
}

export function Dossiers({ s, o }: { s: Stockage; o: Ouvrir }) {
  return (
    <div className="tv-dossiers">
      {CATS.map((c) => {
        const n = s.categories[c.id]?.n ?? 0;
        return (
          <Cible key={c.id} cat={c.id} o={o} className="tv-dossier">
            <svg width="64" height="52" viewBox="0 0 64 52" aria-hidden="true"><path d="M2 8a4 4 0 0 1 4-4h16l6 6h30a4 4 0 0 1 4 4v4H2z" fill="#E8A92E" />{n ? <rect x="8" y="9" width="48" height="14" rx="2" fill="#fff" opacity="0.9" /> : null}<rect x="2" y="14" width="60" height="36" rx="4" fill="#FFC83D" /><rect x="2" y="14" width="60" height="6" fill="#FFD866" /></svg>
            <span style={{ fontSize: 13, fontWeight: 600, textAlign: "center" }}>{c.dossier}</span>
            <span style={{ fontSize: 12, color: "#5B6B86" }}>{n ? `${n} élément${n > 1 ? "s" : ""}` : "Vide"}</span>
          </Cible>
        );
      })}
    </div>
  );
}
