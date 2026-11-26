"use client";
// Navigation principale : barre d'onglets flottante sur téléphone, menu latéral bleu nuit sur ordinateur (≥ 1024 px).
// Rendue une seule fois dans le layout. Sur téléphone, elle est masquée sur les écrans secondaires
// (création, éditeur, aperçu…) qui ont leur propre barre d'actions ; sur ordinateur elle reste toujours visible.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useMoi } from "./Moi";
import { lienVisible } from "@/lib/roles";

// Icônes au trait de la nouvelle interface (24 × 24)
export const NAV_ICONS = {
  bord: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  veille: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  creer: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  plus: "M12 5v14M5 12h14",
  cal: "M3 5h18v16H3zM16 3v4M8 3v4M3 10h18",
  studio: "M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z",
  minute: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM10 8l6 4-6 4z",
  grin: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-5A8 8 0 1 1 21 12z",
  cnx: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  sources: "M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 19a1 1 0 1 0 0-.01",
  eclair: "M13 2L4 14h7l-1 8 9-12h-7z",
  media: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 15l3-3 2 2 3-3 3 4",
} as const;

export function Trait({ d, size = 22, stroke = 1.8 }: { d: string; size?: number; stroke?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

// Tuile logo TUVOA (carré bleu, point orange)
export function LogoTuile({ taille = 76, bord = "#0A2A66" }: { taille?: number; bord?: string }) {
  const k = taille / 76;
  return (
    <span className="tv-logo" style={{ width: taille, height: taille, borderRadius: 20 * k }} role="img" aria-label="TUVOA Tech Media">
      <span style={{ fontSize: 19 * k }}>TUVOA</span>
      <span style={{ fontSize: 7.5 * k, letterSpacing: 1.6 * k }}>TECH MEDIA</span>
      <i style={{ width: 14 * k, height: 14 * k, borderWidth: Math.max(2, 3 * k), borderColor: bord, right: -4 * k, top: -4 * k }} />
    </span>
  );
}

const MENU: { href: string; label: string; d: string; badge?: "grin" }[] = [
  { href: "/", label: "Accueil", d: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/veille", label: "Veille", d: NAV_ICONS.veille },
  { href: "/creer", label: "Créer", d: NAV_ICONS.creer },
  { href: "/calendrier", label: "Calendrier", d: NAV_ICONS.cal },
  { href: "/videos", label: "Vidéos choc", d: "M4 5h16v14H4zM10 9l5 3-5 3z" },
  { href: "/communaute", label: "VOA", d: NAV_ICONS.grin, badge: "grin" },
  { href: "/sources", label: "Sources", d: NAV_ICONS.sources },
  { href: "/declencheurs", label: "Déclencheurs", d: NAV_ICONS.eclair },
  { href: "/connexions", label: "Connexions", d: NAV_ICONS.cnx },
];

const ONGLETS: { href: string; label: string; d: string }[] = [
  { href: "/", label: "Accueil", d: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/calendrier", label: "Calendrier", d: NAV_ICONS.cal },
  { href: "/communaute", label: "VOA", d: NAV_ICONS.grin },
  { href: "/compte", label: "Compte", d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
];

const SECONDAIRES = ["/studio", "/minute-cyber", "/creer/", "/editeur", "/apercu", "/rubriques", "/mediatheque"];

type Etat = { autopilot: boolean; grin: number } | null;

export function BottomNav() {
  const path = usePathname();
  const [etat, setEtat] = useState<Etat>(null);
  const moi = useMoi();
  const voit = (href: string) => !moi || lienVisible(moi.role, href);
  useEffect(() => {
    if (path.startsWith("/acces") || path.startsWith("/invitation")) return;
    fetch("/api/tableau?leger=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && !d.error && !d.demo && setEtat({ autopilot: Boolean(d.autopilot), grin: d.grin?.aTraiter ?? 0 }))
      .catch(() => {});
  }, [path]);
  if (path.startsWith("/acces") || path.startsWith("/invitation")) return null;
  const actif = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const secondaire = SECONDAIRES.some((p) => path.startsWith(p));
  const media = actif("/mediatheque");

  return (
    <>
      <nav className="tv-side" aria-label="Navigation principale">
        <Link href="/" className="tv-side-brand" aria-label="TUVOA Studio, tableau de bord">
          <LogoTuile taille={42} bord="#FFFFFF" />
          <span className="tv-side-studio">TUVOA Studio</span>
        </Link>
        <div className="tv-side-items">
          {MENU.filter((it) => voit(it.href)).map((it) => (
            <Link key={it.href} href={it.href} className="tv-side-item" aria-current={actif(it.href) ? "page" : undefined}>
              <span className="tv-side-ico"><Trait d={it.d} /></span>
              <span>{it.label}</span>
              {it.badge && etat?.grin ? <span className="tv-side-badge" aria-label={`${etat.grin} à traiter`}>{etat.grin}</span> : null}
            </Link>
          ))}
        </div>
        {voit("/mediatheque") ? (
          <Link href="/mediatheque" className="tv-side-item tv-side-media" aria-current={media ? "page" : undefined}>
            <span className="tv-side-ico"><Trait d={NAV_ICONS.media} /></span>
            <span>Médiathèque</span>
          </Link>
        ) : null}
        <Link href="/compte" className="tv-side-compte" aria-current={actif("/compte") ? "page" : undefined}>
          <span className="av">{(moi?.nom || moi?.roleNom || "TU").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase()}</span>
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <strong>{moi?.nom || (moi?.role === "admin" ? "Mon compte" : "…")}</strong>
            <small>{moi?.roleNom ?? "Mon compte"}</small>
          </span>
        </Link>
        <div className="tv-side-pilote">
          <span style={{ fontSize: 14, fontWeight: 700 }}>VOA et le pilote automatique</span>
          <span style={{ fontSize: 13, lineHeight: 1.4, color: "#4B5563" }}>
            {etat?.autopilot ? "L'app publie seule et VOA répond aux commentaires." : "Les posts attendent votre validation."}
          </span>
          <span className="row" style={{ gap: 8, fontSize: 13, fontWeight: 600 }}>
            <span className={`tv-led${etat?.autopilot ? "" : " off"}`} />
            {etat === null ? "…" : etat.autopilot ? "Actif" : "En pause"}
          </span>
        </div>
      </nav>

      <nav className={`tv-tabs${secondaire ? " sub" : ""}`} aria-label="Navigation principale">
        {ONGLETS.filter((t) => voit(t.href)).map((t) => (
          <Link key={t.href} href={t.href} aria-current={actif(t.href) ? "page" : undefined}>
            <Trait d={t.d} size={21} />
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

// En-tête des écrans secondaires : flèche retour + titre (+ élément à droite).
export function TopBar({ title, back, right, wide }: { title: string; back?: string; right?: React.ReactNode; wide?: boolean }) {
  return (
    <header className={`topbar sub${wide ? " wide" : ""}`}>
      <div className="row" style={{ gap: 6, minWidth: 0 }}>
        {back ? (
          <Link href={back} className="back" aria-label="Retour">
            <Icon name="retour" size={24} stroke={2} />
          </Link>
        ) : null}
        <h1 className="title">{title}</h1>
      </div>
      {right}
    </header>
  );
}
