"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Accueil", icon: "accueil" },
  { href: "/veille", label: "Veille", icon: "veille" },
  { href: "/creer", label: "Créer", icon: "creer" },
  { href: "/calendrier", label: "Calendrier", icon: "calendrier" },
  { href: "/connexions", label: "Connexions", icon: "connexions" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Navigation principale">
      {items.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}>
            <Icon name={it.icon} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

// En-tête des écrans secondaires : flèche retour + titre (+ élément à droite).
export function TopBar({ title, back, right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <header className="topbar">
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
