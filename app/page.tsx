"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { BottomNav } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { PostRow } from "@/components/PostRow";
import type { Post } from "@/lib/store";
import { getInfo, listPosts, saveSettings, type Info } from "@/lib/client";

// Ordre de la liste « Prochaines publications » : à valider et planifiés par date, puis brouillons et erreurs.
function upcoming(posts: Post[]): Post[] {
  const rank: Partial<Record<Post["status"], number>> = { a_valider: 0, planifie: 0, erreur: 1, brouillon: 2 };
  return posts
    .filter((p) => rank[p.status] !== undefined)
    .sort((a, b) => {
      const r = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (r) return r;
      const da = a.scheduled_at ?? "9999";
      const db = b.scheduled_at ?? "9999";
      return da.localeCompare(db) || b.created_at.localeCompare(a.created_at);
    });
}

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getInfo()
      .then((i) => {
        setInfo(i);
        return listPosts();
      })
      .then(setPosts)
      .catch((e: Error) => {
        setError(e.message);
        setPosts([]);
      });
  }, []);

  async function toggleAuto() {
    if (!info) return;
    const autopilot = !info.settings.autopilot;
    setInfo({ ...info, settings: { ...info.settings, autopilot } });
    await saveSettings({ autopilot }).catch((e: Error) => setError(e.message));
  }

  const count = (s: Post["status"]) => posts?.filter((p) => p.status === s).length ?? 0;
  const toValidate = count("a_valider");
  const auto = info?.settings.autopilot ?? false;
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const list = upcoming(posts ?? []).slice(0, 5);

  return (
    <>
      <header className="topbar" style={{ paddingTop: 20 }}>
        <Logo />
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            role="switch"
            aria-checked={auto}
            onClick={toggleAuto}
            className="btn small"
            style={auto ? { background: "var(--bleu)", borderColor: "var(--bleu)", color: "#fff", borderRadius: 22 } : { borderRadius: 22 }}
          >
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 5, background: auto ? "#fff" : "#9ca3af" }} />
            {auto ? "Auto ON" : "Manuel"}
          </button>
          <Link
            href="/calendrier?filtre=a_valider"
            className="icon-btn"
            aria-label={toValidate ? `${toValidate} post${toValidate > 1 ? "s" : ""} à valider` : "Posts à valider"}
          >
            <Icon name="cloche" size={20} />
            {toValidate ? <span className="dot" aria-hidden="true">{toValidate}</span> : null}
          </Link>
        </div>
      </header>
      <main className="page">
        <div>
          <p className="muted" style={{ textTransform: "capitalize" }}>{today}</p>
          <h1 style={{ marginTop: 4 }}>Ton studio de posts tech</h1>
        </div>

        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {info?.demo ? <p className="notice">Mode démo : tes posts sont gardés sur ce téléphone. Pour la veille automatique et les publications planifiées, branche Supabase (voir Connexions).</p> : null}
        {info && !info.ai ? <p className="notice ambre">Rédaction par l'IA inactive : les brouillons sont préparés à partir de l'actu, à compléter à la main. Ajoute une clé gratuite Google Gemini (GEMINI_API_KEY) dans Vercel pour l'activer.</p> : null}

        <div className="grid3">
          <Stat value={count("planifie")} label="Planifiés" href="/calendrier?filtre=planifie" dark />
          <Stat value={count("publie")} label="Publiés" href="/calendrier?filtre=publie" />
          <Stat value={count("erreur")} label="En erreur" href="/calendrier?filtre=erreur" danger />
        </div>

        <Link href="/creer" className="btn primary">
          <Icon name="plus" size={20} stroke={2.2} />
          Nouveau post
        </Link>

        <section className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 className="section-title">Prochaines publications</h2>
            <Link href="/calendrier" style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Tout voir</Link>
          </div>
          {posts === null ? <p className="muted">Chargement…</p> : null}
          {posts && list.length === 0 ? (
            <p className="muted">Rien de prévu pour l'instant. Crée un post ou pars d'une actu de la <Link href="/veille">veille</Link>.</p>
          ) : null}
          {list.map((p) => (
            <PostRow key={p.id} post={p} />
          ))}
        </section>
      </main>
      <BottomNav />
    </>
  );
}

function Stat({ value, label, href, dark, danger }: { value: number; label: string; href: string; dark?: boolean; danger?: boolean }) {
  return (
    <Link
      href={href}
      style={{ background: dark ? "var(--noir)" : "var(--gris-1)", color: dark ? "#fff" : "var(--noir)", borderRadius: 14, padding: "14px 12px", textDecoration: "none", display: "block" }}
    >
      <span style={{ display: "block", fontFamily: "var(--font-archivo)", fontWeight: 800, fontSize: 24, color: danger && value ? "var(--rouge)" : undefined }}>{value}</span>
      <span className="small" style={{ display: "block", marginTop: 2, color: dark ? "#c9ccd3" : "var(--texte-2)" }}>{label}</span>
    </Link>
  );
}
