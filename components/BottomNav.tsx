"use client";
// Navigation principale : barre du bas sur téléphone, menu latéral sur ordinateur (≥ 1024 px).
// Rendue une seule fois dans le layout. Sur téléphone, elle est masquée sur les écrans secondaires
// (création, éditeur, aperçu…) qui ont leur propre barre d'actions ; sur ordinateur elle reste toujours visible.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { Logo } from "./Logo";

const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Accueil", icon: "accueil" },
  { href: "/veille", label: "Veille", icon: "veille" },
  { href: "/creer", label: "Créer", icon: "creer" },
  { href: "/calendrier", label: "Calendrier", icon: "calendrier" },
  { href: "/connexions", label: "Connexions", icon: "connexions" },
];

const SECONDAIRES = ["/creer", "/editeur", "/apercu", "/declencheurs", "/rubriques", "/sources"];

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/acces")) return null;
  const secondaire = SECONDAIRES.some((p) => path.startsWith(p));
  return (
    <nav className={`nav${secondaire ? " sub" : ""}`} aria-label="Navigation principale">
      <div className="nav-brand">
        <Link href="/" aria-label="Accueil TUVOA Studio" style={{ textDecoration: "none" }}>
          <Logo size={26} />
        </Link>
        <Link href="/creer" className="btn primary" style={{ height: 46 }}>
          <Icon name="plus" size={18} stroke={2.2} />
          Nouveau post
        </Link>
      </div>
      <div className="nav-items">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}>
              <Icon name={it.icon} />
              {it.label}
            </Link>
          );
        })}
        <Link href="/declencheurs" className="desktop-only" aria-current={path.startsWith("/declencheurs") ? "page" : undefined}>
          <Icon name="eclair" />
          Déclencheurs
        </Link>
      </div>
      <p className="nav-foot">www.tuvoa.media</p>
    </nav>
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
