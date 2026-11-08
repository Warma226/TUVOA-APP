"use client";
// Mon compte : l'administrateur principal y gère l'équipe ; chaque membre y voit son profil, ses publications et ses appareils.
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trait } from "@/components/BottomNav";
import Voa from "@/components/Voa";
import { chargerMoi } from "@/components/Moi";
import { DROITS, ROLES, ROLES_MEMBRES, ROLE_NOM, ZONE_DETAIL, ZONE_NOM, type Role, type Zone } from "@/lib/roles";

type Session = { id: string; appareil: string | null; created_at: string; vu_at: string; moi: boolean };
type MiniPost = { id: string; title: string; idea: string; status: string; platforms: string[]; created_at: string; scheduled_at: string | null };
type Compte = { uid: string; role: Role; roleNom: string; nom: string; contact?: string; created_at?: string; sessions: Session[]; stats: { publies: number; planifies: number; brouillons: number }; posts: MiniPost[] };
type Membre = { id: string; nom: string; contact: string; role: Role; statut: "invite" | "actif" | "suspendu"; created_at: string; derniere_connexion: string | null; invitation_expire: string | null };
type Equipe = { membres: Membre[]; parMembre: Record<string, number>; journal: { id: string; auteur: string; auteur_id: string; titre: string; status: string; at: string }[] };

const ZONES = Object.keys(ZONE_NOM) as Zone[];
const COUL = ["#2563EB", "#0E9F8E", "#E94A06", "#7C3AED", "#0A2A66", "#DB2777"];
const couleur = (id: string) => COUL[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % COUL.length];
const initiales = (n: string) => n.trim().split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase() || "?";
const date = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—");
const ilya = (s: string | null) => {
  if (!s) return "jamais";
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  return m < 60 ? `il y a ${Math.max(1, m)} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : m < 2880 ? "hier" : `il y a ${Math.round(m / 1440)} jours`;
};
const STATUT: Record<string, [string, string, string]> = { publie: ["Publié", "#16A34A", "#D9F7E6"], planifie: ["Programmé", "#2563EB", "#E0EAFF"], brouillon: ["Brouillon", "#5B6B86", "#EEF2F8"], a_valider: ["À relire", "#92400E", "#FEF3C7"], erreur: ["Erreur", "#B42318", "#FDE3E6"], annule: ["Annulé", "#5B6B86", "#EEF2F8"] };

function Av({ nom, id, taille = 44 }: { nom: string; id: string; taille?: number }) {
  return <span style={{ width: taille, height: taille, borderRadius: taille / 2, flexShrink: 0, background: id === "admin" ? "#0A2A66" : couleur(id), color: "#fff", fontWeight: 800, fontSize: taille * 0.36, display: "flex", alignItems: "center", justifyContent: "center" }}>{initiales(nom)}</span>;
}

async function api(url: string, body?: unknown) {
  const r = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Erreur ${r.status}`);
  return d;
}

export default function ComptePage() {
  return <Suspense fallback={null}><Compte /></Suspense>;
}

function Compte() {
  const refus = useSearchParams().get("refus");
  const [c, setC] = useState<Compte | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const charger = useCallback(() => api("/api/compte").then(setC).catch((e: Error) => setError(e.message)), []);
  useEffect(() => { void charger(); }, [charger]);
  const admin = c?.role === "admin";

  return (
    <div className="tv-page">
      <div className="tv-corps" style={{ paddingTop: 20 }}>
        <div className="tv-entete" style={{ gap: 12 }}>
          <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 6 }}>
            <Link href="/" className="tv-gris" style={{ textDecoration: "none", fontWeight: 600 }}>← Tableau de bord</Link>
            <h1 className="tv-titre">Mon compte</h1>
            <span style={{ fontSize: 14, color: "#33425C" }}>{admin ? "Le compte principal de l'administration de TUVOA, et l'équipe qui travaille avec vous." : "Votre espace dans l'administration de TUVOA."}</span>
          </div>
          <button type="button" className="btn" onClick={async () => { await fetch("/api/logout", { method: "POST" }).catch(() => {}); window.location.href = "/acces"; }}><Trait d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" size={16} />Se déconnecter</button>
        </div>
        {refus ? <p className="notice ambre">Cette page est réservée à un autre rôle de l&apos;équipe.</p> : null}
        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {info ? <p className="notice vert" role="status">{info}</p> : null}
        {!c ? <p className="tv-gris">Chargement…</p> : admin ? <VueAdmin c={c} recharger={charger} setError={setError} setInfo={setInfo} /> : <VueMembre c={c} recharger={charger} setError={setError} setInfo={setInfo} />}
      </div>
    </div>
  );
}

type Props = { c: Compte; recharger: () => void; setError: (s: string) => void; setInfo: (s: string) => void };

function Nom({ c, recharger, setError, setInfo }: Props) {
  const [nom, setNom] = useState(c.nom);
  return (
    <form className="row" style={{ gap: 8, flex: "1 1 260px" }} onSubmit={async (e) => { e.preventDefault(); try { await api("/api/compte", { action: "nom", nom }); setInfo("Nom enregistré."); await chargerMoi(true); recharger(); } catch (x) { setError((x as Error).message); } }}>
      <label className="field" style={{ flex: 1 }}>Nom affiché<input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Prénom N." /></label>
      <button className="btn small" style={{ alignSelf: "flex-end", height: 44 }} disabled={!nom.trim() || nom === c.nom}>Enregistrer</button>
    </form>
  );
}

function Securite({ c, recharger, setError, setInfo }: Props) {
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  return (
    <section className="tv-carte" aria-labelledby="t-secu">
      <h2 id="t-secu" className="tv-h2">Mon mot de passe et mes appareils</h2>
      <form className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end" }} onSubmit={async (e) => { e.preventDefault(); try { await api("/api/compte", { action: "mdp", ancien, nouveau }); setAncien(""); setNouveau(""); setInfo("Mot de passe changé. Vos autres appareils devront se reconnecter."); recharger(); } catch (x) { setError((x as Error).message); } }}>
        <label className="field" style={{ flex: "1 1 180px" }}>Mot de passe actuel<input type="password" autoComplete="current-password" value={ancien} onChange={(e) => setAncien(e.target.value)} /></label>
        <label className="field" style={{ flex: "1 1 180px" }}>Nouveau mot de passe<input type="password" autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} placeholder="10 caractères, lettres et chiffres" /></label>
        <button className="tv-btn-nuit" style={{ height: 44 }} disabled={!ancien || !nouveau}>CHANGER</button>
      </form>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {c.sessions.map((s) => (
          <div key={s.id} className="row" style={{ gap: 12, padding: "10px 0", borderTop: "1px solid #EDF1F7" }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF2F8", color: "#0A2A66", display: "flex", alignItems: "center", justifyContent: "center" }}><Trait d={/iPhone|Android|Téléphone/.test(s.appareil ?? "") ? "M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2" : "M4 5h16v11H4zM8 20h8M12 16v4"} size={17} /></span>
            <span style={{ flex: 1, display: "flex", flexDirection: "column" }}><strong style={{ fontSize: 14 }}>{s.appareil ?? "Appareil"}</strong><span style={{ fontSize: 12, color: "#5B6B86" }}>Connecté le {date(s.created_at)} · actif {ilya(s.vu_at)}</span></span>
            {s.moi ? <span className="tv-pill bleu">CET APPAREIL</span> : <button type="button" className="btn small danger" onClick={async () => { await api("/api/compte", { action: "deconnecter", id: s.id }).catch((x: Error) => setError(x.message)); recharger(); }}>Déconnecter</button>}
          </div>
        ))}
      </div>
      {c.sessions.length > 1 ? <button type="button" className="btn small ghost" style={{ alignSelf: "flex-start", color: "#B42318" }} onClick={async () => { await api("/api/compte", { action: "deconnecter-tout" }).catch((x: Error) => setError(x.message)); recharger(); }}>Se déconnecter de tous les autres appareils</button> : null}
      {c.role !== "admin" ? <span className="tv-gris" style={{ fontSize: 12 }}>Mot de passe oublié ? Demandez à l&apos;administration un nouveau lien : il remplace l&apos;ancien mot de passe.</span> : null}
    </section>
  );
}

function VueMembre(p: Props) {
  const { c } = p;
  return (
    <div className="tv-veille">
      <div className="tv-veille-main">
        <section className="tv-carte" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 18 }}>
          <Av nom={c.nom} id={c.uid} taille={80} />
          <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 8 }}>
            <Nom {...p} />
            <span className="row" style={{ gap: 8, flexWrap: "wrap" }}><span className="tv-pill bleu">{c.roleNom.toUpperCase()}</span><span style={{ fontSize: 12, color: "#5B6B86" }}>Ajouté(e) par l&apos;administration le {date(c.created_at)} · {c.contact}</span></span>
          </div>
        </section>
        <section className="tv-carte" aria-labelledby="t-mes" style={{ gap: 4 }}>
          <div className="row" style={{ alignItems: "baseline", gap: 10, paddingBottom: 8 }}><h2 id="t-mes" className="tv-h2" style={{ flex: 1 }}>Mes publications</h2><Link href="/calendrier" style={{ fontSize: 13, fontWeight: 800, textDecoration: "none" }}>Voir dans le calendrier →</Link></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, paddingBottom: 10 }}>
            {([[c.stats.publies, "publiées · 7 jours", "#16A34A"], [c.stats.planifies, "programmées", "#2563EB"], [c.stats.brouillons, "brouillons", "#5B6B86"]] as const).map(([n, l, col]) => (
              <div key={l} style={{ borderRadius: 16, padding: "12px 14px", background: "#F4F7FC" }}><strong style={{ fontFamily: "var(--font-mont)", fontSize: 26, color: col }}>{n}</strong><span style={{ display: "block", fontSize: 12, color: "#5B6B86" }}>{l}</span></div>
            ))}
          </div>
          {c.posts.length === 0 ? <p className="tv-gris" style={{ fontSize: 13 }}>Vos publications apparaîtront ici.</p> : null}
          {c.posts.map((x) => {
            const s = STATUT[x.status] ?? [x.status, "#5B6B86", "#EEF2F8"];
            return (
              <Link key={x.id} href={x.status === "brouillon" ? `/editeur?id=${x.id}` : `/apercu?id=${x.id}`} className="row" style={{ gap: 12, padding: "12px 0", borderTop: "1px solid #EDF1F7", textDecoration: "none", color: "#0B1A33" }}>
                <span style={{ width: 6, height: 36, borderRadius: 3, background: s[1], flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}><strong style={{ fontSize: 14 }}>{x.title || x.idea}</strong><span style={{ fontSize: 12, color: "#5B6B86" }}>{date(x.scheduled_at ?? x.created_at)}</span></span>
                <span style={{ fontSize: 11, fontWeight: 800, color: s[1] }}>{s[0].toUpperCase()}</span>
              </Link>
            );
          })}
        </section>
        <Securite {...p} />
      </div>
      <aside className="tv-veille-side">
        <section className="tv-carte-side" aria-labelledby="t-droits">
          <h2 id="t-droits" className="tv-h2" style={{ fontSize: 17 }}>Ce que vous pouvez faire</h2>
          <span className="tv-gris" style={{ fontSize: 13 }}>Selon votre rôle. Seul l&apos;administrateur principal peut le changer.</span>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {ZONES.map((z) => {
              const d = DROITS[c.role][z];
              return (
                <li key={z} className="row" style={{ gap: 12, padding: "10px 0", borderTop: "1px solid #EDF1F7", opacity: d === "-" ? 0.65 : 1 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 13, flexShrink: 0, background: d === "o" ? "#16A34A" : d === "l" ? "#2563EB" : "#C9D3E3", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Trait d={d === "o" ? "M20 6L9 17l-5-5" : d === "l" ? "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" : "M5 12h14"} size={13} stroke={2.6} /></span>
                  <span style={{ flex: 1, display: "flex", flexDirection: "column" }}><strong style={{ fontSize: 14 }}>{ZONE_NOM[z]}{d === "l" ? " · lecture" : ""}</strong><span style={{ fontSize: 12, color: "#5B6B86" }}>{ZONE_DETAIL[z]}</span></span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="tv-voa" style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Voa humeur="veille" taille={40} decor />
          <span style={{ display: "flex", flexDirection: "column", gap: 6 }}><strong style={{ fontSize: 14, color: "#fff" }}>Vos publications sont signées</strong><span style={{ fontSize: 13, color: "#C9D6F2", lineHeight: 1.45 }}>Votre nom apparaît dans le calendrier et le journal de l&apos;administration. Les lecteurs, eux, ne voient que TUVOA.</span></span>
        </section>
      </aside>
    </div>
  );
}

function VueAdmin(p: Props) {
  const { c, setError, setInfo } = p;
  const [eq, setEq] = useState<Equipe | null>(null);
  const [nom, setNom] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState<Role>("redacteur");
  const [lien, setLien] = useState<{ pour: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const charger = useCallback(() => api("/api/membres").then(setEq).catch((e: Error) => setError(e.message)), [setError]);
  useEffect(() => { void charger(); }, [charger]);
  async function act(body: Record<string, unknown>, ok?: string) {
    try { const d = await api("/api/membres", body); if (d.lien) setLien({ pour: String(body.id ?? ""), url: `${window.location.origin}${d.lien}` }); if (ok) setInfo(ok); await charger(); } catch (e) { setError((e as Error).message); }
  }
  async function inviter(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const d = await api("/api/membres", { action: "inviter", nom, contact, role });
      setLien({ pour: nom, url: `${window.location.origin}${d.lien}` }); setNom(""); setContact(""); await charger();
    } catch (x) { setError((x as Error).message); } finally { setBusy(false); }
  }
  const membres = eq?.membres ?? [];
  const n = (s: string) => membres.filter((m) => m.statut === s).length;

  return (
    <div className="tv-veille">
      <div className="tv-veille-main">
        <section className="tv-compte-principal" aria-label="Compte principal">
          <span style={{ position: "relative" }}><Av nom={c.nom || "TU"} id="admin" taille={68} /><span className="etoile"><Trait d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 16.5 5.5 21l2-7.5L2 9h7z" size={12} stroke={2} /></span></span>
          <span style={{ flex: "1 1 240px", display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="tv-kicker" style={{ color: "#FFB48A", letterSpacing: 2 }}>COMPTE PRINCIPAL · ADMINISTRATION</span>
            <strong style={{ fontFamily: "var(--font-mont)", fontSize: 22, color: "#fff" }}>{c.nom || "Vous"}</strong>
            <span style={{ fontSize: 13, color: "#C9D6F2" }}>Tous les droits. Vous seul gérez l&apos;équipe, la médiathèque, les connexions et les réglages.</span>
          </span>
        </section>
        <section className="tv-carte"><Nom {...p} /></section>

        <form className="tv-carte" aria-labelledby="t-ajout" style={{ border: "2px solid #2563EB" }} onSubmit={inviter}>
          <div className="row" style={{ alignItems: "baseline", gap: 10, flexWrap: "wrap" }}><h2 id="t-ajout" className="tv-h2" style={{ flex: 1 }}>Ajouter un membre</h2><span className="tv-gris" style={{ fontSize: 13 }}>Il reçoit un lien personnel pour choisir son mot de passe.</span></div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="field" style={{ flex: "1 1 170px" }}>Nom<input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Prénom N." /></label>
            <label className="field" style={{ flex: "1 1 210px" }}>E-mail ou téléphone<input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Il s'en servira pour se connecter" /></label>
            <label className="field" style={{ flex: "1 1 170px" }}>Rôle<select value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES_MEMBRES.map((r) => <option key={r} value={r}>{ROLE_NOM[r]}</option>)}</select></label>
          </div>
          <span className="row" style={{ gap: 8, fontSize: 13, color: "#05603A", fontWeight: 700 }}><Trait d="M20 6L9 17l-5-5" size={15} stroke={2.6} />Dès qu&apos;il a choisi son mot de passe, il publie directement, selon son rôle.</span>
          <button className="tv-btn-nuit" style={{ alignSelf: "flex-start" }} disabled={busy || !nom.trim() || !contact.trim()}><Trait d="M22 2L11 13M22 2l-7 20-4-9-9-4z" size={16} />{busy ? "CRÉATION…" : "CRÉER LE LIEN D'INVITATION"}</button>
          {lien ? (
            <div className="tv-lien-invit">
              <strong>Lien à envoyer{lien.pour && !membres.some((m) => m.id === lien.pour) ? ` à ${lien.pour}` : ""}</strong>
              <code>{lien.url}</code>
              <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn small" onClick={() => { void navigator.clipboard?.writeText(lien.url); setInfo("Lien copié."); }}>Copier</button>
                <a className="btn small" href={`https://wa.me/?text=${encodeURIComponent(`Bienvenue dans l'équipe TUVOA ! Choisis ton mot de passe ici : ${lien.url}`)}`} target="_blank" rel="noopener noreferrer">Envoyer par WhatsApp</a>
                <span className="tv-gris" style={{ fontSize: 12 }}>Valable 7 jours, une seule fois.</span>
              </span>
            </div>
          ) : null}
        </form>

        <section className="tv-carte" aria-labelledby="t-equipe" style={{ gap: 4 }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", paddingBottom: 10 }}>
            <h2 id="t-equipe" className="tv-h2" style={{ flex: 1 }}>L&apos;équipe · {membres.length} membre{membres.length > 1 ? "s" : ""}</h2>
            <span className="row" style={{ gap: 6 }}>{n("actif") ? <span className="tv-pill vert">{n("actif")} ACTIF{n("actif") > 1 ? "S" : ""}</span> : null}{n("invite") ? <span className="tv-pill" style={{ background: "#FEF3C7", color: "#92400E" }}>{n("invite")} INVITATION{n("invite") > 1 ? "S" : ""}</span> : null}{n("suspendu") ? <span className="tv-pill">{n("suspendu")} SUSPENDU{n("suspendu") > 1 ? "S" : ""}</span> : null}</span>
          </div>
          {eq && membres.length === 0 ? <p className="tv-gris" style={{ fontSize: 13 }}>Personne pour l&apos;instant. Ajoutez un premier membre ci-dessus.</p> : null}
          {membres.map((m) => (
            <div key={m.id} className="tv-membre" data-statut={m.statut}>
              <Av nom={m.nom} id={m.id} />
              <span style={{ flex: "1 1 180px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <strong style={{ fontSize: 15 }}>{m.nom}</strong>
                <span style={{ fontSize: 12, color: "#5B6B86" }}>{m.contact} · {m.statut === "invite" ? `invité le ${date(m.created_at)}` : `dernière connexion ${ilya(m.derniere_connexion)}`}{eq?.parMembre[m.id] ? ` · ${eq.parMembre[m.id]} publiée${eq.parMembre[m.id] > 1 ? "s" : ""} en 7 j` : ""}</span>
              </span>
              <select aria-label={`Rôle de ${m.nom}`} value={m.role} onChange={(e) => { if (window.confirm(`Passer ${m.nom} en « ${ROLE_NOM[e.target.value as Role]} » ? Il devra se reconnecter.`)) void act({ action: "role", id: m.id, role: e.target.value }, "Rôle changé."); }}>
                {ROLES_MEMBRES.map((r) => <option key={r} value={r}>{ROLE_NOM[r]}</option>)}
              </select>
              <span className="tv-pill" style={m.statut === "actif" ? { background: "#D9F7E6", color: "#05603A" } : m.statut === "invite" ? { background: "#FEF3C7", color: "#92400E" } : {}}>{m.statut === "actif" ? "ACTIF" : m.statut === "invite" ? "INVITATION ENVOYÉE" : "SUSPENDU"}</span>
              <span className="row" style={{ gap: 6 }}>
                <button type="button" className="btn small" onClick={() => void act({ action: "lien", id: m.id })} title={m.statut === "actif" ? "Pour un mot de passe oublié" : undefined}>{m.statut === "actif" ? "Nouveau lien" : "Renvoyer le lien"}</button>
                <button type="button" className="btn small" onClick={() => void act({ action: m.statut === "suspendu" ? "reactiver" : "suspendre", id: m.id }, m.statut === "suspendu" ? "Membre réactivé." : "Membre suspendu : ses appareils sont déconnectés.")}>{m.statut === "suspendu" ? "Réactiver" : "Suspendre"}</button>
                <button type="button" className="btn small danger" aria-label={`Retirer ${m.nom}`} onClick={() => { if (window.confirm(`Retirer ${m.nom} de l'équipe ? Ses publications restent en ligne.`)) void act({ action: "retirer", id: m.id }, "Membre retiré."); }}><Trait d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" size={15} /></button>
              </span>
              {lien && lien.pour === m.id ? (
                <div className="tv-lien-invit" style={{ flexBasis: "100%" }}>
                  <code>{lien.url}</code>
                  <span className="row" style={{ gap: 8 }}><button type="button" className="btn small" onClick={() => { void navigator.clipboard?.writeText(lien.url); setInfo("Lien copié."); }}>Copier</button><a className="btn small" href={`https://wa.me/?text=${encodeURIComponent(`Ton lien TUVOA pour choisir ton mot de passe : ${lien.url}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></span>
                </div>
              ) : null}
            </div>
          ))}
        </section>

        <section className="tv-carte" aria-labelledby="t-droits">
          <h2 id="t-droits" className="tv-h2">Ce que chaque rôle peut faire</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="tv-droits">
              <thead><tr><th>RÔLE</th>{ZONES.map((z) => <th key={z}>{ZONE_NOM[z].toUpperCase()}</th>)}</tr></thead>
              <tbody>
                {ROLES.map((r) => (
                  <tr key={r}><td><span className="tv-pill" style={r === "admin" ? { background: "#0A2A66", color: "#fff" } : {}}>{ROLE_NOM[r]}</span></td>
                    {ZONES.map((z) => { const d = DROITS[r][z]; return <td key={z}><span data-d={d} title={d === "o" ? "Oui" : d === "l" ? "Lecture seule" : "Non"}><Trait d={d === "o" ? "M20 6L9 17l-5-5" : d === "l" ? "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" : "M5 12h14"} size={13} stroke={2.6} /></span></td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <Securite {...p} />
      </div>

      <aside className="tv-veille-side">
        <section className="tv-carte-side" aria-labelledby="t-journal">
          <h2 id="t-journal" className="tv-h2" style={{ fontSize: 17 }}>Qui a fait quoi · 7 jours</h2>
          {eq && eq.journal.length === 0 ? <span className="tv-gris" style={{ fontSize: 13 }}>Les publications de l&apos;équipe apparaîtront ici, avec le nom de leur auteur.</span> : null}
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {eq?.journal.map((j) => (
              <li key={j.id} className="row" style={{ gap: 10, alignItems: "flex-start", padding: "10px 0", borderTop: "1px solid #EDF1F7" }}>
                <Av nom={j.auteur} id={j.auteur_id} taille={26} />
                <Link href={`/apercu?id=${j.id}`} style={{ fontSize: 13, lineHeight: 1.4, color: "#33425C", textDecoration: "none" }}><strong>{j.auteur}</strong> {j.status === "publie" ? "a publié" : j.status === "planifie" ? "a programmé" : "a préparé"} « {j.titre} » <span style={{ color: "#9AA8BE" }}>· {ilya(j.at)}</span></Link>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
