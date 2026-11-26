"use client";
// Accueil (design v3) : ce qui attend une action, le prochain post, la journée en frise, créer, la veille et VOA.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NAV_ICONS, Trait } from "@/components/BottomNav";
import { getInfo, listPostsEntre, saveSettings, type Info } from "@/lib/client";
import { useMoi } from "@/components/Moi";
import type { Post } from "@/lib/store";

type Compte = Partial<Record<"publie" | "planifie" | "a_valider" | "brouillon" | "erreur" | "annule", number>>;
type Donnees = {
  autopilot: boolean;
  rubriques: Record<"actu" | "citation" | "cyberbase" | "portrait", Compte>;
  citationsSansPhoto: number;
  erreurs: { id: string; titre: string; rubrique: string; detail: string }[];
  nbErreurs: number;
  grin: { aTraiter: number };
  voa: { dernier: { auteur: string; at: string } | null; reponsesAuj: number } | null;
  error?: string;
  demo?: boolean;
};

const I = {
  ...NAV_ICONS,
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0",
  chev: "M9 6l6 6-6 6",
  shield: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  news: "M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5",
  quote: "M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  camera: "M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  warn: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v5M12 16h.01",
  pause: "M7 5h3v14H7zM14 5h3v14h-3z",
  play: "M8 5l11 7-11 7z",
  film: "M4 5h16v14H4zM10 9l5 3-5 3z",
};
const NOM: Record<string, string> = { actu: "Actualité", citation: "Citation", cyberbase: "#CyberBase", portrait: "Portrait" };
const CANAL: Record<string, string> = { facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok", wordpress: "Site" };
const n = (x?: number) => x ?? 0;
const quand = (p: Post) => new Date(p.scheduled_at ?? p.created_at);
const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const visuel = (p: Post) => p.visual?.image || p.visual?.photo || "";
function ilya(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `il y a ${h} h` : `le ${new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}
function dans(d: Date) {
  const m = Math.round((d.getTime() - Date.now()) / 60000);
  if (m <= 0) return "maintenant";
  if (m < 60) return `dans ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `dans ${h} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}` : `le ${d.toLocaleDateString("fr-FR", { weekday: "long" })} à ${hm(d)}`;
}

export default function Accueil() {
  const [d, setD] = useState<Donnees | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");
  const [visuels, setVisuels] = useState<Record<string, string>>({});
  const moi = useMoi();
  const admin = !moi || moi.role === "admin";

  useEffect(() => {
    getInfo().then(setInfo).catch(() => {});
    fetch("/api/tableau", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({ error: `Erreur du serveur (${r.status}).` }))) as Donnees;
        if (j.error) throw new Error(j.error);
        setD(j);
      })
      .catch((e: Error) => setError(e.message));
    const debut = new Date(); debut.setHours(0, 0, 0, 0);
    listPostsEntre(debut, new Date(debut.getTime() + 3 * 864e5)).then(setPosts).catch(() => {});
  }, []);

  const auto = info?.settings.autopilot ?? d?.autopilot ?? false;
  async function basculer() {
    if (!info) return;
    if (!admin) return setError("Seul l'administrateur principal peut mettre VOA en pause.");
    const autopilot = !auto;
    setInfo({ ...info, settings: { ...info.settings, autopilot } });
    await saveSettings({ autopilot }).catch((e: Error) => setError(e.message));
  }

  const maintenant = new Date();
  const finJour = new Date(); finJour.setHours(23, 59, 59, 999);
  const actifs = useMemo(() => posts.filter((p) => p.status !== "annule" && p.status !== "brouillon").sort((a, b) => quand(a).getTime() - quand(b).getTime()), [posts]);
  const duJour = actifs.filter((p) => quand(p) <= finJour);
  const aVenir = actifs.filter((p) => (p.status === "planifie" || p.status === "a_valider") && quand(p) > maintenant);
  const prochain = aVenir[0] ?? null;
  const restants = aVenir.filter((p) => quand(p) <= finJour);

  // Visuels tels qu'ils seront publiés (gabarit généré compris) : le prochain post et les posts à venir du jour.
  const aCharger = [prochain, ...restants.slice(0, 8)].filter((p): p is Post => Boolean(p)).map((p) => p.id).filter((id, i, t) => t.indexOf(id) === i);
  const cleVisuels = aCharger.join(",");
  useEffect(() => {
    if (!cleVisuels) return;
    let fini = false;
    Promise.all(cleVisuels.split(",").map((id) =>
      fetch(`/api/posts?id=${id}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null))
        .then((j: { post?: { visuals?: Record<string, string> } } | null) => [id, j?.post?.visuals?.facebook || j?.post?.visuals?.linkedin || ""] as const)
        .catch(() => [id, ""] as const),
    )).then((paires) => { if (!fini) setVisuels(Object.fromEntries(paires.filter(([, u]) => u))); });
    return () => { fini = true; };
  }, [cleVisuels]);
  const apercu = (p: Post) => visuels[p.id] || visuel(p);

  // Ce qui attend une action, du plus urgent au moins urgent
  const R = d?.rubriques ?? { actu: {}, citation: {}, cyberbase: {}, portrait: {} };
  const aValider = n(R.actu.a_valider) + n(R.citation.a_valider) + n(R.cyberbase.a_valider) + n(R.portrait.a_valider);
  const alerte = !d ? null
    : d.nbErreurs ? { ico: I.warn, titre: d.nbErreurs > 1 ? `${d.nbErreurs} publications n'ont pas pu partir` : `« ${d.erreurs[0]?.titre.slice(0, 60) || "Un post"} » n'a pas pu partir`, sous: "Voir l'erreur et republier", cta: "Voir", href: "/calendrier?filtre=erreur" }
    : d.citationsSansPhoto ? { ico: I.camera, titre: `${d.citationsSansPhoto > 1 ? `${d.citationsSansPhoto} citations attendent` : "Une citation attend"} leur photo`, sous: "Sans photo, elles ne partent pas", cta: "Ajouter", href: "/calendrier?filtre=a_valider" }
    : aValider ? { ico: I.camera, titre: `${aValider > 1 ? `${aValider} posts attendent` : "Un post attend"} votre feu vert`, sous: "À relire avant l'heure prévue", cta: "Relire", href: "/calendrier?filtre=a_valider" }
    : d.grin.aTraiter ? { ico: I.grin, titre: `${d.grin.aTraiter > 1 ? `${d.grin.aTraiter} commentaires attendent` : "Un commentaire attend"} votre réponse`, sous: "VOA vous les laisse", cta: "Voir", href: "/communaute" }
    : null;

  const prenom = (moi?.nom ?? "").split(/\s+/)[0];
  const date = maintenant.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <main className="page v3-home">
      {/* En-tête */}
      <header className="row" style={{ gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <h1 style={{ fontSize: 24 }}>{prenom ? `Bonjour ${prenom}` : "Bonjour"}</h1>
          <span className="muted" style={{ fontSize: 13 }}>Ouagadougou · {date}</span>
        </div>
        <Link href="/communaute" className="v3-round" aria-label="Notifications">
          <Trait d={I.bell} size={20} />
          {alerte ? <span className="pt" /> : null}
        </Link>
        <Link href="/creer" className="v3-round bleu" aria-label="Créer un post"><Trait d={I.plus} size={20} stroke={2.2} /></Link>
      </header>

      {error ? <p className="notice ambre">{error}</p> : null}

      {alerte ? (
        <Link href={alerte.href} className="v3-alert">
          <span style={{ width: 40, height: 40, borderRadius: 12, background: "#E94A06", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Trait d={alerte.ico} size={20} stroke={2} /></span>
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <strong style={{ fontSize: 14 }}>{alerte.titre}</strong>
            <span style={{ fontSize: 12, color: "#8A3B00" }}>{alerte.sous}</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#B54708" }}>{alerte.cta}</span>
        </Link>
      ) : null}

      <div className="v3-home-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
          {/* Prochain post */}
          {prochain ? (
            <section className="v3-hero" aria-label="Prochain post">
              {apercu(prochain) ? <img src={apercu(prochain)} alt="" style={{ objectFit: "contain", objectPosition: "100% 50%" }} /> : null}
              <div>
                <span className="row" style={{ gap: 8, fontSize: 14 }}>
                  <span style={{ padding: "3px 9px", borderRadius: 8, background: "rgba(255,255,255,0.16)", fontSize: 12, fontWeight: 700 }}>{NOM[prochain.rubrique] ?? "Post"}</span>
                  Prochain post à {hm(quand(prochain))}
                </span>
                <strong style={{ fontSize: 23, lineHeight: 1.2, letterSpacing: "-0.4px", marginTop: 10, maxWidth: 520, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{prochain.title || prochain.visual?.titre || "Post sans titre"}</strong>
                <span className="row" style={{ gap: 8, fontSize: 13, marginTop: 10 }}>
                  <Trait d={I.shield} size={15} stroke={2} />
                  {prochain.platforms.map((x) => CANAL[x] ?? x).join(" et ")} · {dans(quand(prochain))}
                </span>
                <div className="row" style={{ gap: 10, marginTop: "auto" }}>
                  <Link href={`/apercu?id=${prochain.id}`} className="v3-pill blanc"><Trait d={NAV_ICONS.veille} size={16} stroke={2} />Voir l’aperçu</Link>
                  <Link href={`/editeur?id=${prochain.id}`} className="v3-pill contour"><Trait d={NAV_ICONS.cal} size={15} stroke={2} />Décaler</Link>
                </div>
              </div>
            </section>
          ) : (
            <section className="v3-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <strong style={{ fontSize: 17 }}>Rien de planifié pour l’instant</strong>
              <span className="muted">{auto ? "Le pilote automatique publiera les prochaines actus de la veille." : "Le pilote automatique est en pause."}</span>
              <Link href="/creer" className="btn primary small" style={{ alignSelf: "flex-start" }}>Créer un post</Link>
            </section>
          )}

          {/* La journée */}
          <section className="v3-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }} aria-label="La journée">
            <div className="v3-h2"><h2>Aujourd’hui</h2><Link href="/calendrier" className="v3-more">Calendrier <Trait d={I.chev} size={16} stroke={2} /></Link></div>
            {duJour.length ? (
              <div className="v3-soft" style={{ padding: "16px 14px 12px" }}>
                <div className="v3-frise">
                  {duJour.slice(0, 10).map((p) => {
                    const cls = p.status === "publie" ? "fait" : p.status === "erreur" ? "erreur" : p.id === prochain?.id ? "prochain" : "";
                    return <span key={p.id} title={`${hm(quand(p))} · ${NOM[p.rubrique] ?? ""} · ${p.title}`}><i className={cls} /><b style={{ fontWeight: cls === "prochain" ? 800 : 500 }}>{String(quand(p).getHours())}h{quand(p).getMinutes() ? String(quand(p).getMinutes()).padStart(2, "0") : ""}</b></span>;
                  })}
                </div>
                <div className="row" style={{ flexWrap: "wrap", gap: 14, marginTop: 12, fontSize: 12, color: "#4B5563" }}>
                  <span>{duJour.filter((p) => p.status === "publie").length} publiés</span>
                  <span>{restants.length} à venir</span>
                  {duJour.some((p) => p.status === "erreur") ? <span style={{ color: "var(--rouge)" }}>{duJour.filter((p) => p.status === "erreur").length} en erreur</span> : null}
                </div>
              </div>
            ) : <p className="muted">Aucun post aujourd’hui.</p>}
            {restants.length ? (
              <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "2px 2px 10px" }}>
                {restants.slice(0, 8).map((p) => (
                  <Link key={p.id} href={`/apercu?id=${p.id}`} className="v3-card v3-postcard">
                    <div className="vis" style={{ background: p.rubrique === "citation" ? "#E94A06" : p.rubrique === "cyberbase" ? "#1E3A8A" : "#E5E7EB" }}>
                      {p.rubrique === "citation" && !apercu(p)
                        ? <span style={{ display: "flex", height: "100%", padding: "16px", alignItems: "center", color: "#fff", fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>« {(p.visual?.texte || p.title).slice(0, 90)}{(p.visual?.texte || p.title).length > 90 ? "…" : ""} »</span>
                        : apercu(p) ? <img src={apercu(p)} alt="" /> : <span style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, padding: 16, textAlign: "center" }}>{p.visual?.titre || NOM[p.rubrique]}</span>}
                      <span className="v3-chip white" style={{ position: "absolute", top: 10, left: 10 }}>{p.status === "a_valider" ? "À valider" : NOM[p.rubrique] ?? "Post"}</span>
                    </div>
                    <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <strong style={{ fontSize: 15, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title || p.visual?.titre}</strong>
                      <span className="row" style={{ gap: 12, fontSize: 13, color: "#4B5563" }}>
                        <span className="row" style={{ gap: 5 }}><Trait d={I.clock} size={14} stroke={2} />{hm(quand(p))}</span>
                        <span>{p.platforms.map((x) => CANAL[x] ?? x).join(" · ")}</span>
                      </span>
                      {p.source_name ? <span className="v3-chip blue" style={{ alignSelf: "flex-start" }}><Trait d={I.shield} size={13} stroke={2.2} />{p.source_name.slice(0, 28)}</span> : null}
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          {/* Créer */}
          <section className="v3-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }} aria-label="Créer un post">
            <div className="v3-h2"><h2>Créer un post</h2><Link href="/creer" className="v3-more">Tout voir <Trait d={I.chev} size={16} stroke={2} /></Link></div>
            <div className="grid2" style={{ gap: 10 }}>
              {[
                { id: "actu", ico: I.news, info: n(R.actu.a_valider) ? `${R.actu.a_valider} à valider` : "Depuis la veille ou un lien" },
                { id: "citation", ico: I.quote, info: "Auto à 9 h, 13 h, 17 h" },
                { id: "cyberbase", ico: I.shield, info: "Auto chaque jour à 7 h" },
                { id: "videos", ico: I.film, info: "Reels d’une minute" },
              ].map((r) => (
                <Link key={r.id} href={r.id === "videos" ? "/videos" : `/creer/${r.id}`} className="v3-tile">
                  <span className="v3-ico"><Trait d={r.ico} size={22} /></span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <strong style={{ fontSize: 15 }}>{NOM[r.id] ?? "Vidéo choc"}</strong>
                    <span style={{ fontSize: 12, color: "#4B5563" }}>{r.info}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* Veille */}
          <Link href="/veille" className="v3-soft" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "#111827" }}>
            <span className="v3-ico"><Trait d={NAV_ICONS.veille} size={22} /></span>
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <strong style={{ fontSize: 15 }}>Veille : les sujets du jour</strong>
              <span style={{ fontSize: 13, color: "#05603A", fontWeight: 600 }}>Le Burkina d’abord</span>
            </span>
            <Trait d={I.chev} size={18} stroke={2} />
          </Link>

          {/* VOA */}
          <section className="v3-card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }} aria-label="VOA">
            <div className="row" style={{ gap: 12 }}>
              <span style={{ position: "relative", width: 40, height: 40, borderRadius: 20, background: "var(--bleu)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                VOA<span style={{ position: "absolute", right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, background: auto ? "#22C55E" : "#9CA3AF", border: "2px solid #fff" }} />
              </span>
              <Link href="/communaute" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, textDecoration: "none", color: "#111827" }}>
                <strong style={{ fontSize: 15 }}>{auto ? "VOA est en marche" : "VOA est en pause"}</strong>
                <span style={{ fontSize: 13, color: "#4B5563" }}>{d?.voa?.dernier ? `A répondu à ${d.voa.dernier.auteur.split(/\s+/)[0]} ${ilya(d.voa.dernier.at)}` : "Aucune réponse récente"}</span>
              </Link>
              {admin ? (
                <button type="button" onClick={basculer} className="btn ghost small" style={{ height: 40, padding: "0 12px" }}>
                  <Trait d={auto ? I.pause : I.play} size={14} />{auto ? "Pause" : "Reprendre"}
                </button>
              ) : null}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: "1px solid #F0F0F0", paddingTop: 12 }}>
              {[[String(aVenir.length), "posts à venir"], [String(d?.voa?.reponsesAuj ?? 0), "réponses aujourd’hui"], [String(d?.grin.aTraiter ?? 0), "à traiter"]].map(([v, t], i) => (
                <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, borderLeft: i ? "1px solid #F0F0F0" : "0" }}>
                  <strong style={{ fontSize: 20 }}>{v}</strong>
                  <span style={{ fontSize: 12, color: "#4B5563", textAlign: "center" }}>{t}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
