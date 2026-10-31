"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { PostRow } from "@/components/PostRow";
import type { Post, PostStatus } from "@/lib/store";
import { listPosts } from "@/lib/client";
import { joursManquants } from "@/lib/schedule";

const FILTRES: { id: "tout" | PostStatus; label: string }[] = [
  { id: "tout", label: "Tout" },
  { id: "a_valider", label: "À valider" },
  { id: "planifie", label: "Planifiés" },
  { id: "publie", label: "Publiés" },
  { id: "brouillon", label: "Brouillons" },
  { id: "erreur", label: "En erreur" },
];

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Date de référence d'un post : publication réelle, sinon date prévue.
function postDate(p: Post): string | null {
  if (p.status === "publie") return Object.values(p.results).find((r) => r?.ok)?.at ?? p.scheduled_at;
  return p.scheduled_at;
}

export default function CalendrierPage() {
  return (
    <Suspense fallback={null}>
      <Calendrier />
    </Suspense>
  );
}

function Calendrier() {
  const q = useSearchParams();
  const initial = FILTRES.find((f) => f.id === q.get("filtre"))?.id ?? "tout";
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]["id"]>(initial);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState("");
  const [jour, setJour] = useState<string | null>(null);

  useEffect(() => {
    listPosts()
      .then(setPosts)
      .catch((e: Error) => {
        setError(e.message);
        setPosts([]);
      });
  }, []);

  // Les 7 prochains jours, avec le nombre de posts prévus chaque jour.
  const semaine = useMemo(() => {
    const start = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = dayKey(d);
      const n = (posts ?? []).filter((p) => p.status !== "annule" && postDate(p) && dayKey(new Date(postDate(p) as string)) === key).length;
      return { key, d, n };
    });
  }, [posts]);

  const groupes = useMemo(() => {
    const shown = (posts ?? [])
      .filter((p) => p.status !== "annule")
      .filter((p) => filtre === "tout" || p.status === filtre)
      .filter((p) => !jour || (postDate(p) && dayKey(new Date(postDate(p) as string)) === jour));
    const map = new Map<string, Post[]>();
    for (const p of shown) {
      const d = postDate(p);
      const k = d ? dayKey(new Date(d)) : "sans-date";
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === "sans-date") return 1;
      if (b === "sans-date") return -1;
      // à venir d'abord (ordre chronologique), puis le passé (du plus récent au plus ancien)
      const today = dayKey(new Date());
      const fa = a >= today;
      const fb = b >= today;
      if (fa !== fb) return fa ? -1 : 1;
      return fa ? a.localeCompare(b) : b.localeCompare(a);
    });
    return keys.map((k) => ({
      k,
      posts: (map.get(k) ?? []).sort((a, b) => (postDate(a) ?? "").localeCompare(postDate(b) ?? "")),
    }));
  }, [posts, filtre, jour]);

  const titreJour = (k: string) => {
    if (k === "sans-date") return "Sans date";
    const [y, m, d] = k.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const diff = Math.round((date.getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
    const label = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    return diff === 0 ? `Aujourd'hui · ${label}` : diff === 1 ? `Demain · ${label}` : label.charAt(0).toUpperCase() + label.slice(1);
  };

  return (
    <>
      <header className="topbar">
        <h1>Calendrier</h1>
        <Link href="/creer" className="icon-btn primary" aria-label="Nouveau post">
          <Icon name="plus" size={22} stroke={2.2} />
        </Link>
      </header>
      <main className="page" style={{ paddingTop: 8 }}>
        <div className="grid7" role="group" aria-label="Les 7 prochains jours">
          {semaine.map(({ key, d, n }) => (
            <button
              key={key}
              type="button"
              aria-pressed={jour === key}
              aria-label={`${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}, ${n} post${n > 1 ? "s" : ""}`}
              className="day"
              onClick={() => setJour(jour === key ? null : key)}
            >
              <span className="small">{d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}</span>
              <strong>{d.getDate()}</strong>
              <span className="pips" aria-hidden="true">
                {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                  <i key={i} />
                ))}
              </span>
            </button>
          ))}
        </div>

        <div className="hscroll" role="tablist" aria-label="Statut">
          {FILTRES.map((f) => (
            <button key={f.id} type="button" role="tab" className="chip" aria-selected={filtre === f.id} onClick={() => setFiltre(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        {posts && joursManquants(posts, "cyberbase").length ? (
          <div className="notice row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span>
              <strong>#CyberBase à 8 h</strong> : {joursManquants(posts, "cyberbase").length} jour{joursManquants(posts, "cyberbase").length > 1 ? "s" : ""} sans notion cette semaine, à partir du{" "}
              {joursManquants(posts, "cyberbase")[0].toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}.
            </span>
            <Link href="/creer?rubrique=cyberbase" className="btn small primary" style={{ flexShrink: 0 }}>Créer</Link>
          </div>
        ) : null}

        {jour ? (
          <p className="muted small">
            Jour sélectionné.{" "}
            <button type="button" className="btn link small" onClick={() => setJour(null)}>Voir tous les jours</button>
          </p>
        ) : null}

        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {posts === null ? <p className="muted">Chargement…</p> : null}
        {posts && groupes.length === 0 ? <p className="muted">Aucun post ici pour l'instant.</p> : null}

        {groupes.map((g) => (
          <section key={g.k} className="stack">
            <h2 className="label" style={{ color: "var(--texte-2)" }}>{titreJour(g.k)}</h2>
            {g.posts.map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </section>
        ))}
      </main>
      <BottomNav />
    </>
  );
}
