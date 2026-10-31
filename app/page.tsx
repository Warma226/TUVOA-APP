"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { BottomNav } from "@/components/BottomNav";
import { STATUS_LABEL, STATUS_BADGE, PLATFORM_LABEL } from "@/lib/labels";
import type { Post } from "@/lib/store";
import { getInfo, listPosts, saveSettings } from "@/lib/client";

type Info = { settings: { autopilot: boolean }; demo: boolean; ai: boolean };

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
  const auto = info?.settings.autopilot ?? false;
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <header className="topbar">
        <Logo />
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
      </header>
      <main className="page">
        <div>
          <p className="muted" style={{ textTransform: "capitalize" }}>{today}</p>
          <h1 style={{ marginTop: 4 }}>Ton studio de posts tech</h1>
        </div>

        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {info?.demo ? <p className="notice">Mode démo : tes posts sont gardés sur ce téléphone. Pour la veille automatique et les publications planifiées, branche Supabase (voir Comptes).</p> : null}
        {info && !info.ai ? <p className="notice ambre">Rédaction par l'IA inactive : les brouillons sont préparés à partir de l'actu, à compléter à la main. Ajoute ANTHROPIC_API_KEY dans Vercel pour l'activer.</p> : null}

        <div className="grid3">
          <Stat value={count("a_valider")} label="À valider" dark />
          <Stat value={count("planifie")} label="Planifiés" />
          <Stat value={count("erreur")} label="En erreur" danger />
        </div>

        <Link href="/creer" className="btn primary">+ Nouveau post</Link>

        <section className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Derniers posts</h2>
            <Link href="/veille" style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Voir la veille</Link>
          </div>
          {posts === null ? <p className="muted">Chargement…</p> : null}
          {posts?.length === 0 ? <p className="muted">Aucun post pour l'instant. Crée le premier ou ouvre la veille.</p> : null}
          {posts?.map((p) => (
            <Link key={p.id} href={`/apercu?id=${p.id}`} className="card link">
              <p style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.35 }}>{p.title || p.visual.titre || p.idea || "Sans titre"}</p>
              <div className="wrap">
                <span className="badge">{p.rubrique === "cyberbase" ? "#CyberBase" : p.rubrique === "portrait" ? "#Portrait" : "#ActuTech"}</span>
                {p.platforms.map((pl) => (
                  <span key={pl} className="badge bleu">{PLATFORM_LABEL[pl]}</span>
                ))}
                <span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}{p.auto ? " · auto" : ""}</span>
              </div>
              {p.scheduled_at && p.status === "planifie" ? (
                <p className="muted small">Prévu le {new Date(p.scheduled_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</p>
              ) : null}
            </Link>
          ))}
        </section>
      </main>
      <BottomNav />
    </>
  );
}

function Stat({ value, label, dark, danger }: { value: number; label: string; dark?: boolean; danger?: boolean }) {
  return (
    <div style={{ background: dark ? "var(--noir)" : "var(--gris-1)", color: dark ? "#fff" : undefined, borderRadius: 14, padding: 12 }}>
      <p style={{ fontFamily: "var(--font-archivo)", fontWeight: 800, fontSize: 24, color: danger && value ? "var(--rouge)" : undefined }}>{value}</p>
      <p className="small" style={{ color: dark ? "#c9ccd3" : "var(--texte-2)" }}>{label}</p>
    </div>
  );
}
