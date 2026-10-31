"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Accueil", d: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/veille", label: "Veille", d: "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5" },
  { href: "/creer", label: "Créer", d: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" },
  { href: "/declencheurs", label: "Auto", d: "M13 2L4 14h7l-1 8 9-12h-7z" },
  { href: "/connexions", label: "Comptes", d: "M9 15l6-6M11 6l1-1a4 4 0 0 1 6 6l-1 1M13 18l-1 1a4 4 0 0 1-6-6l1-1" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Navigation principale">
      {items.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d={it.d} />
            </svg>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TopBar({ title, back, right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div className="row">
        {back ? (
          <Link href={back} className="back" aria-label="Retour">
            ‹
          </Link>
        ) : null}
        <h1 style={{ fontSize: 22 }}>{title}</h1>
      </div>
      {right}
    </header>
  );
}
