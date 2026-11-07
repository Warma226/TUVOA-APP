"use client";
// Tableau de bord : courbe des publications, rubriques, alertes de VOA et médiathèque.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Voa from "@/components/Voa";
import { LogoTuile, NAV_ICONS, Trait } from "@/components/BottomNav";
import { Courbe, Disque, Dossiers, Repartition, type Jour, type Stockage } from "@/components/Tableau";
import { getInfo, saveSettings, type Info } from "@/lib/client";

type Compte = Partial<Record<"publie" | "planifie" | "a_valider" | "brouillon" | "erreur" | "annule" | "recap", number>>;
type Donnees = {
  maintenant: string;
  autopilot: boolean;
  jours: Jour[];
  rubriques: Record<"actu" | "citation" | "cyberbase" | "portrait", Compte>;
  planifiees: number;
  prochaine: { at: string; titre: string; rubrique: string } | null;
  citationsSansPhoto: number;
  erreurs: { id: string; titre: string; rubrique: string; detail: string }[];
  nbErreurs: number;
  minute: { total: number; montes: number; brouillons: number; dernier: number };
  grin: { aTraiter: number };
  recap: { date: string; statut: string } | null;
  media: Stockage | null;
  error?: string;
  demo?: boolean;
};

const VERT = "#22C55E", ROUGE = "#E11D2E";
const n = (x?: number) => x ?? 0;
const pl = (k: number, mot: string) => `${k} ${mot}${k > 1 ? "s" : ""}`;

function horodatage(d: Date) {
  const j = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return `${j.charAt(0).toUpperCase()}${j.slice(1)} · ${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;
}
function heure(iso: string) {
  const d = new Date(iso);
  const auj = new Date().toDateString() === d.toDateString();
  return `${auj ? "" : d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "") + " "}${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;
}
const tuile = (a: string, b: string, size: number): React.CSSProperties => ({ width: size, height: size, borderRadius: Math.round(size * 0.28), background: `linear-gradient(145deg, ${a} 0%, ${b} 100%)` });

type Alerte = { type: string; tag: [string, string]; txt: string; cta: string; href?: string; action?: () => void };

export default function Dashboard() {
  const router = useRouter();
  const [d, setD] = useState<Donnees | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [q, setQ] = useState("");

  useEffect(() => {
    getInfo().then(setInfo).catch(() => {});
    fetch("/api/tableau", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({ error: `Erreur du serveur (${r.status}).` }))) as Donnees;
        if (j.error) throw new Error(j.error);
        setD(j);
      })
      .catch((e: Error) => setError(e.message));
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const auto = info?.settings.autopilot ?? d?.autopilot ?? false;
  async function basculer() {
    if (!info) return;
    const autopilot = !auto;
    setInfo({ ...info, settings: { ...info.settings, autopilot } });
    await saveSettings({ autopilot }).catch((e: Error) => setError(e.message));
  }
  function chercher(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/calendrier?q=${encodeURIComponent(q.trim())}`);
  }

  const pret = d && !d.demo && d.jours;
  const auj = 6;
  const jours = pret ? d.jours : [];
  const publiees7 = jours.slice(0, auj + 1).reduce((s, j) => s + j.publie, 0);
  const record = jours.slice(0, auj + 1).reduce((m, j) => (j.publie > m.publie ? j : m), jours[0] ?? { publie: 0, date: "" });
  const R = d?.rubriques ?? { actu: {}, citation: {}, cyberbase: {}, portrait: {} };
  const actu = R.actu, cit = R.citation, cyb = R.cyberbase, por = R.portrait;
  const erreursAutres = (d?.erreurs ?? []).filter((e) => e.rubrique !== "citation");
  const aValider = n(actu.a_valider) + n(cit.a_valider) + n(cyb.a_valider) + n(por.a_valider);

  const alertes: Alerte[] = [];
  if (d?.citationsSansPhoto) alertes.push({ type: "À FAIRE", tag: ["#E94A06", "#fff"], txt: `${pl(d.citationsSansPhoto, "citation")} ${d.citationsSansPhoto > 1 ? "attendent" : "attend"} leur photo avant de partir.`, cta: "Ajouter les photos", href: "/calendrier?filtre=erreur" });
  if (erreursAutres.length) {
    const e = erreursAutres[0];
    const quoi = e.rubrique === "actu" ? "Une actualité" : e.rubrique === "cyberbase" ? "Un numéro #CyberBase" : "Un post";
    const canal = /facebook/i.test(e.detail) ? " sur Facebook" : /linkedin/i.test(e.detail) ? " sur LinkedIn" : "";
    alertes.push({ type: "ERREUR", tag: ["#FDD5D9", "#9F1239"], txt: erreursAutres.length > 1 ? `${erreursAutres.length} publications n'ont pas pu partir.` : `${quoi} n'a pas pu être publiée${canal}.`, cta: "Voir et republier", href: "/calendrier?filtre=erreur" });
  }
  if (aValider) alertes.push({ type: "À VALIDER", tag: ["#DBE7FF", "#1D4ED8"], txt: `${pl(aValider, "post")} ${aValider > 1 ? "attendent" : "attend"} ton feu vert.`, cta: "Valider", href: "/calendrier?filtre=a_valider" });
  if (d?.grin.aTraiter) alertes.push({ type: "LE GRIN", tag: ["#FDE68A", "#7A4A00"], txt: `${pl(d.grin.aTraiter, "message")} de la communauté ${d.grin.aTraiter > 1 ? "attendent" : "attend"} une réponse.`, cta: "Ouvrir le Grin", href: "/communaute" });
  if (info && !auto) alertes.push({ type: "RÉGLAGE", tag: ["rgba(255,255,255,0.15)", "#fff"], txt: "Le pilote automatique est en pause : rien ne part sans toi.", cta: "Le réactiver", action: basculer });
  if (info && !info.ai) alertes.push({ type: "RÉGLAGE", tag: ["rgba(255,255,255,0.15)", "#fff"], txt: "Rédaction par l'IA inactive : ajoute la clé GEMINI_API_KEY dans Vercel.", cta: "Ouvrir les connexions", href: "/connexions" });
  const bulle = !d ? "Je regarde ce qui se passe…" : alertes.length === 0 ? "Tout est en ordre. Je garde un œil sur la Page." : alertes.length === 1 ? "Une seule chose pour vous. Rien de grave." : `${["", "", "Deux", "Trois", "Quatre", "Cinq", "Six"][alertes.length] ?? alertes.length} choses pour vous. La première est facile, promis.`;

  const segs = (vals: number[], cols: [string, string][]) => (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {vals.map((v, i) => <span key={i} className="tv-seg" style={{ background: cols[i][0], color: cols[i][1], flex: `${Math.max(1, v)} 1 0` }}>{v}</span>)}
    </div>
  );
  const etat = (ok: boolean, label: string) => (
    <span role="img" aria-label={label} title={label} style={{ width: 14, height: 14, borderRadius: 7, flexShrink: 0, background: ok ? VERT : ROUGE, boxShadow: `0 0 0 5px ${ok ? "rgba(34,197,94,0.18)" : "rgba(225,29,46,0.16)"}` }} />
  );

  const une = [
    { nom: "Actualités", href: "/calendrier", meta1: `${n(actu.publie)} publiées`, meta2: "7 derniers jours", desc: "La veille repère l'info tech, l'IA la résume en français, convertit les montants en FCFA et publie seule.", c: ["#60A5FA", "#1D4ED8"], ok: !n(actu.erreur), vals: [n(actu.publie), n(actu.a_valider) + n(actu.brouillon), n(actu.erreur)], cols: [["#2563EB", "#fff"], ["#FDE7C8", "#9A4A00"], ["#FDD5D9", "#B4111F"]] as [string, string][], leg: "Publiées · à valider · erreurs", canaux: ["F", "in", "W"], rythme: auto ? "Toutes les 30 min" : "Sur validation" },
    { nom: "Citations", href: "/calendrier", meta1: `${n(cit.planifie)} planifiées`, meta2: `${n(cit.publie)} publiées`, desc: "Des voix tech d'Afrique et du monde, vérifiées, une toutes les deux heures. Il suffit d'ajouter la photo.", c: ["#C4B5FD", "#7C3AED"], ok: !n(cit.erreur), vals: [n(cit.publie), n(cit.planifie), n(cit.erreur)], cols: [["#7C3AED", "#fff"], ["#E9E3FF", "#5B21B6"], ["#FDD5D9", "#B4111F"]] as [string, string][], leg: "Publiées · planifiées · erreurs", canaux: ["F", "in"], rythme: "Toutes les 2 h" },
  ];

  const recapDate = d?.recap ? new Date(d.recap.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" }) : null;
  const m = d?.media?.categories;
  const rubriques = [
    { nom: "Actualités", href: "/calendrier", meta: `${n(actu.publie)} publiées · 7 j`, c: ["#60A5FA", "#1D4ED8"], ok: !n(actu.erreur), et: n(actu.erreur) ? `${pl(n(actu.erreur), "erreur")} à corriger` : auto ? "Pilote automatique actif" : "En attente de validation", bl: "Publiées · à valider · en erreur", v: [n(actu.publie), n(actu.a_valider) + n(actu.brouillon), n(actu.erreur)] },
    { nom: "Citations", href: "/calendrier", meta: `${n(cit.planifie)} planifiées`, c: ["#C4B5FD", "#7C3AED"], ok: !n(cit.erreur), et: d?.citationsSansPhoto ? `${d.citationsSansPhoto} en attente de photo` : "Photos prêtes", bl: "Publiées · planifiées · en erreur", v: [n(cit.publie), n(cit.planifie), n(cit.erreur)] },
    { nom: "#CyberBase", href: "/rubriques", meta: "Chaque jour à 7 h", c: ["#5EEAD4", "#0E9F8E"], ok: !n(cyb.erreur), et: n(cyb.planifie) ? `${pl(n(cyb.planifie), "numéro")} d'avance` : "Aucun numéro d'avance", bl: "Publiés · planifiés · en erreur", v: [n(cyb.publie), n(cyb.planifie), n(cyb.erreur)] },
    { nom: "Portrait", href: "/creer", meta: "Vos visuels", c: ["#FDBA74", "#E94A06"], ok: !n(por.erreur), et: n(por.planifie) ? `${pl(n(por.planifie), "portrait")} planifié${n(por.planifie) > 1 ? "s" : ""}` : "Prêt à recevoir un visuel", bl: "Publiés · planifiés · à faire", v: [n(por.publie), n(por.planifie), n(por.brouillon) + n(por.a_valider)] },
    { nom: "La minute cyber", href: "/minute-cyber", meta: "Vidéo · 1 min", c: ["#FCA5A5", "#B91C1C"], ok: true, et: d?.minute.dernier ? `Épisode ${d.minute.dernier} prêt` : "Premier épisode à écrire", bl: "Montés · brouillons", v: [n(d?.minute.montes), n(d?.minute.brouillons), 0] },
    { nom: "Récap du vendredi", href: "/calendrier", meta: "Chaque vendredi", c: ["#93C5FD", "#0A2A66"], ok: d?.recap?.statut !== "erreur", et: recapDate ? `Dernier : ${recapDate}` : "Pas encore de récap", bl: "Publiés cette semaine", v: [n(actu.recap), 0, 0] },
    { nom: "Le Grin · VOA", href: "/communaute", meta: "Community manager", c: ["#FDE68A", "#D97706"], ok: !d?.grin.aTraiter, et: d?.grin.aTraiter ? `${pl(d.grin.aTraiter, "message")} à traiter` : "Commentaires et messages suivis", bl: "À traiter", v: [0, n(d?.grin.aTraiter), 0] },
    { nom: "Studio", href: "/studio", meta: "Visuels et vidéos", c: ["#A5B4FC", "#4338CA"], ok: true, et: "Visuels, carrousels, vidéos", bl: "Images · voix off · vidéos", v: [n(m?.images.n), n(m?.voix.n), n(m?.videos.n)] },
  ];
  const BAR = ["#2563EB", "#F5B94A", "#C9D3E3"];

  const piloteTexte = d?.prochaine ? `Prochaine : ${heure(d.prochaine.at)}${d.prochaine.titre ? ` · ${d.prochaine.titre.slice(0, 40)}` : ""}` : "Rien de planifié pour les prochaines heures";

  return (
    <div className="tv-page">
      {/* En-tête téléphone */}
      <header className="tv-hero-mobile tv-mobile">
        <div className="row">
          <LogoTuile taille={52} />
          <span style={{ fontFamily: "var(--font-mont)", fontWeight: 700, fontSize: 12, letterSpacing: 2, color: "#9FB6E8" }}>STUDIO</span>
          <span style={{ flex: 1 }} />
          <Link href="/calendrier" className="tv-rond" aria-label="Rechercher une publication"><Trait d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5" size={18} stroke={2} /></Link>
          <Link href="/calendrier?filtre=a_valider" className="tv-rond" aria-label={aValider ? `${pl(aValider, "post")} à valider` : "Posts à valider"}>
            <Trait d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" size={18} />
            {aValider || d?.nbErreurs ? <span className="pastille" /> : null}
          </Link>
        </div>
        <div>
          <span style={{ fontSize: 13, color: "#BFD0FF" }}>{horodatage(now)}</span>
          <h1 className="tv-titre" style={{ color: "#fff", marginTop: 4 }}>Tableau de bord</h1>
        </div>
        <button type="button" role="switch" aria-checked={auto} className="tv-pilote-mobile" onClick={basculer} disabled={!info}>
          <span className={`tv-led${auto ? "" : " off"}`} style={{ width: 12, height: 12 }} />
          <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 14 }}>Pilote automatique {auto ? "actif" : "en pause"}</strong>
            <span style={{ fontSize: 12, color: "#C9D6F2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{piloteTexte}</span>
          </span>
          <span className={`switch${auto ? " on" : ""}`} aria-hidden="true" style={{ pointerEvents: "none" }}><span /></span>
        </button>
      </header>

      <div className="tv-corps">
        {/* Barre du haut (ordinateur) */}
        <div className="tv-desk" style={{ flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <form className="tv-recherche" role="search" onSubmit={chercher}>
            <Trait d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5" size={18} stroke={2} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une publication, une source, une citation…" aria-label="Rechercher une publication" />
          </form>
          <span style={{ flex: 1 }} />
          <button type="button" role="switch" aria-checked={auto} onClick={basculer} disabled={!info} className="tv-rond" style={{ width: "auto", padding: "0 16px 0 12px", gap: 10, fontSize: 13, fontWeight: 700 }}>
            <span className={`switch${auto ? " on" : ""}`} aria-hidden="true" style={{ pointerEvents: "none", width: 40, height: 24 }}><span style={{ width: 18, height: 18 }} /></span>
            Pilote auto {auto ? "activé" : "en pause"}
          </button>
          <Link href="/calendrier?filtre=a_valider" className="tv-rond" aria-label={aValider ? `${pl(aValider, "post")} à valider` : "Posts à valider"}>
            <Trait d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" size={20} />
            {aValider || d?.nbErreurs ? <span className="pastille" /> : null}
          </Link>
          <Link href="/connexions" className="tv-rond" aria-label="Connexions et réglages">
            <Trait d={NAV_ICONS.cnx} size={20} />
          </Link>
          <div className="tv-rond" style={{ width: "auto", padding: "0 16px 0 6px", gap: 10, cursor: "default" }}>
            <span style={{ width: 36, height: 36, borderRadius: 18, background: "#0A2A66", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mont)", fontWeight: 800, fontSize: 14 }}>T</span>
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, color: "var(--encre)" }}><strong style={{ fontSize: 14 }}>Équipe TUVOA</strong><span style={{ fontSize: 12, color: "#5B6B86" }}>Administrateur</span></span>
          </div>
        </div>

        {/* En-tête (ordinateur) */}
        <div className="tv-entete tv-desk">
          <div style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="tv-gris">{horodatage(now)}</span>
            <h1 className="tv-titre">Tableau de bord</h1>
          </div>
          <Link href="/creer" className="tv-btn-nuit"><Trait d={NAV_ICONS.plus} size={18} stroke={2.2} />CRÉER UNE PUBLICATION</Link>
        </div>

        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {d?.demo || info?.demo ? <p className="notice">Mode démo : branche Supabase (voir Connexions) pour voir les chiffres du tableau de bord.</p> : null}

        {/* Courbe */}
        <section aria-labelledby="graph" className="tv-verre tv-graph">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 240px" }}>
              <h2 id="graph" className="tv-h2">Publications par jour</h2>
              <span className="tv-gris">Les 7 derniers jours, puis ce qui est déjà planifié</span>
            </div>
            <div className="tv-graph-chiffres">
              <div><strong>{pret ? publiees7 : "…"}</strong><span>publiées en 7 jours</span></div>
              <div><strong>{pret ? record.publie : "…"}</strong><span>record{pret && record.date ? ` · ${new Date(`${record.date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", timeZone: "UTC" })}` : ""}</span></div>
              <div><strong style={{ color: "#7C3AED" }}>{pret ? d.planifiees : "…"}</strong><span>déjà planifiées</span></div>
            </div>
          </div>
          {pret ? (
            <>
              <div className="tv-desk-b"><Courbe jours={jours} auj={auj} /></div>
              <div className="tv-mobile"><Courbe jours={jours} auj={auj} compact /></div>
            </>
          ) : <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }} className="tv-gris">{error ? "Chiffres indisponibles." : "Chargement des chiffres…"}</div>}
          <div className="tv-legende">
            <span><span style={{ width: 18, height: 4, borderRadius: 2, background: "#2563EB" }} />Toutes les publications</span>
            <span><span style={{ width: 18, height: 4, borderRadius: 2, background: "#7C3AED" }} />Dont citations</span>
            <span><span style={{ width: 18, height: 0, borderTop: "3px dashed #5B6B86" }} />Planifié</span>
            <span style={{ flex: 1 }} />
            <Link href="/calendrier" style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Ouvrir le calendrier →</Link>
          </div>
        </section>

        {/* Raccourcis (téléphone) */}
        <nav className="tv-raccourcis tv-mobile" aria-label="Raccourcis">
          {[["/studio", "Studio", NAV_ICONS.studio], ["/minute-cyber", "Minute cyber", NAV_ICONS.minute], ["/mediatheque", "Médiathèque", NAV_ICONS.media], ["/connexions", "Connexions", NAV_ICONS.cnx]].map(([href, l, ic]) => (
            <Link key={href} href={href}><span><Trait d={ic} size={20} /></span><span>{l}</span></Link>
          ))}
        </nav>

        {/* Deux rubriques à la une */}
        <div className="tv-une">
          {une.map((r) => (
            <Link key={r.nom} href={r.href} style={{ textDecoration: "none", color: "inherit" }}>
              <article>
                <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                  <div className="tv-tuile tv-desk-b" style={tuile(r.c[0], r.c[1], 112)} />
                  <div className="tv-tuile tv-mobile" style={tuile(r.c[0], r.c[1], 64)} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: "#5B6B86", flexWrap: "wrap" }}>
                      <span>{r.meta1}</span><span style={{ width: 1, height: 14, background: "#C9D3E3" }} /><span>{r.meta2}</span>
                      <span style={{ flex: 1 }} />
                      {etat(r.ok, r.ok ? "En bonne santé" : "Des erreurs à corriger")}
                    </div>
                    <h3 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>{r.nom}</h3>
                    <p style={{ fontSize: 15, lineHeight: 1.5, color: "#33425C" }}>{r.desc}</p>
                  </div>
                </div>
                <div className="tv-une-stats">
                  <div><span style={{ fontSize: 13, color: "#5B6B86" }} title={r.leg}>Cette semaine · {r.leg.toLowerCase()}</span>{segs(r.vals, r.cols)}</div>
                  <div><span style={{ fontSize: 13, color: "#5B6B86" }}>Canaux</span><div style={{ display: "flex", gap: 6 }}>{r.canaux.map((c) => <span key={c} className="tv-canal">{c}</span>)}</div></div>
                  <div><span style={{ fontSize: 13, color: "#5B6B86" }}>Rythme</span><span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}><span style={{ width: 26, height: 26, borderRadius: 13, border: "1px solid #C7D6FB", color: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Trait d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" size={14} stroke={2.2} /></span>{r.rythme}</span></div>
                </div>
              </article>
            </Link>
          ))}
        </div>

        {/* Toutes les rubriques + VOA */}
        <div className="tv-bas">
          <section aria-labelledby="toutes" style={{ flex: "999 1 600px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 id="toutes" className="tv-h2" style={{ fontSize: 22 }}>Toutes les rubriques</h2>
            <div className="tv-rubriques">
              {rubriques.map((r) => {
                const tot = r.v.reduce((s, x) => s + x, 0);
                return (
                  <Link key={r.nom} href={r.href} className={`tv-rub${r.ok ? "" : " alerte"}`}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <span className="tv-tuile" style={tuile(r.c[0], r.c[1], 52)} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 12, color: "#5B6B86" }}>{r.meta}</span>
                        <strong style={{ fontFamily: "var(--font-mont)", fontSize: 17, color: "#0B1A33" }}>{r.nom}</strong>
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#33425C" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 5, flexShrink: 0, background: r.ok ? VERT : ROUGE }} /><span>{r.et}</span>
                    </div>
                    <div className="tv-rub-bar">
                      <span style={{ fontSize: 12, color: "#5B6B86" }}>{r.bl}{tot ? ` · ${r.v.filter((x, i) => x || i === 0).join(" · ")}` : ""}</span>
                      <div style={{ display: "flex", gap: 4, height: 8 }}>
                        {tot ? r.v.map((x, i) => (x ? <span key={i} style={{ flex: `${x} 1 0`, borderRadius: 4, background: BAR[i] }} /> : null)) : <span style={{ flex: 1, borderRadius: 4, background: "#DDE3EE" }} />}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <aside aria-labelledby="voa" className="tv-voa">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ flexShrink: 0, width: 92, display: "flex", justifyContent: "center" }}>
                <Voa humeur={!d ? "veille" : alertes.length ? "parle" : "content"} taille={88} />
              </span>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <h2 id="voa" style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>VOA vous signale</h2>
                <span style={{ fontSize: 13, color: "#BFD0FF" }}>Votre community manager</span>
                <span style={{ marginTop: 6, padding: "8px 12px", borderRadius: "14px 14px 14px 4px", background: "rgba(255,255,255,0.12)", fontSize: 13, lineHeight: 1.35 }}>{bulle}</span>
              </div>
            </div>
            {alertes.slice(0, 4).map((a, i) => (
              <div key={i} className="tv-voa-alerte">
                <span className="tv-tag" style={{ background: a.tag[0], color: a.tag[1] }}>{a.type}</span>
                <span style={{ fontSize: 15, lineHeight: 1.4, fontWeight: 600 }}>{a.txt}</span>
                {a.href ? <Link href={a.href}>{a.cta} →</Link> : <button type="button" onClick={a.action} style={{ alignSelf: "flex-start", border: 0, background: "none", padding: 0, fontSize: 13, fontWeight: 700, color: "#FFB48A", cursor: "pointer" }}>{a.cta} →</button>}
              </div>
            ))}
            <Link href="/communaute" style={{ fontSize: 13, fontWeight: 700, color: "#C9D6F2", textDecoration: "none" }}>Ouvrir le Grin de VOA →</Link>
          </aside>
        </div>

        {/* Médiathèque */}
        <section aria-labelledby="media" className="tv-verre tv-media">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 id="media" className="tv-h2" style={{ fontSize: 22 }}>Médiathèque</h2>
              <span className="tv-gris">Ouvrez un dossier ou une catégorie pour voir ses fichiers.</span>
            </div>
            <Link href="/mediatheque" style={{ height: 40, padding: "0 14px", borderRadius: 10, background: "#0A2A66", color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
              <Trait d={NAV_ICONS.media} size={16} stroke={2} />Ouvrir
            </Link>
          </div>
          {d?.media ? (
            <>
              <div className="tv-disques">
                <Disque s={d.media} o={{ href: () => "/mediatheque" }} />
                <Repartition s={d.media} o={{ href: (c) => (c ? `/mediatheque?dossier=${c}` : "/mediatheque") }} />
              </div>
              <Dossiers s={d.media} o={{ href: (c) => (c ? `/mediatheque?dossier=${c}` : "/mediatheque") }} />
            </>
          ) : <p className="tv-gris">{d ? "Stockage indisponible pour le moment." : "Lecture du stockage…"}</p>}
        </section>
      </div>
    </div>
  );
}
