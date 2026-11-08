"use client";
// Connexions : l'état de santé de chaque compte et service (dernière publication réussie, autorisations,
// expiration du jeton Facebook, quotas, incidents), avec la marche à suivre pour relier ce qui manque.
// Les clés restent dans Vercel : cette page n'en affiche jamais le contenu.
import { useVoirPlus } from "@/components/VoirPlus";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Trait } from "@/components/BottomNav";
import { taille } from "@/components/Tableau";
import { PLATFORMS, type Platform } from "@/lib/config";
import { getInfo, type Info } from "@/lib/client";

const LETTRE: Record<Platform, string> = { wordpress: "W", facebook: "F", linkedin: "in", tiktok: "T" };

// Les comptes se relient avec des variables d'environnement dans Vercel : « Connecter » affiche la marche à suivre.
const HELP: Record<Platform, string[]> = {
  wordpress: [
    "Dans WordPress : Utilisateurs › Profil › Mots de passe d'application, crée « TUVOA ».",
    "Dans Vercel (Settings › Environment Variables) : WP_URL, WP_USER et WP_APP_PASSWORD.",
    "Redéploie l'app (Deployments › Redeploy).",
  ],
  facebook: [
    "Crée une application sur developers.facebook.com et relie ta Page TUVOA.",
    "Obtiens un jeton de Page longue durée (pages_manage_posts, pages_read_engagement).",
    "Dans Vercel : FB_PAGE_ID et FB_PAGE_TOKEN, puis redéploie.",
  ],
  linkedin: [
    "Sur make.com (gratuit), crée un scénario : module « Webhooks › Custom webhook », puis copie son adresse.",
    "Dans Vercel : LINKEDIN_WEBHOOK_URL = cette adresse, puis redéploie.",
    "Dans Make, sur le webhook : « Redetermine data structure », puis ici « Envoyer un exemple à Make ».",
    "Ajoute « HTTP › Get a file » (URL : image_url) puis « LinkedIn › Create an Organization Image Post » (Page TUVOA, texte : text, image : le fichier). Active le scénario.",
  ],
  tiktok: [
    "Sur developers.tiktok.com, crée une application « TUVOA » et ajoute les produits « Login Kit » et « Content Posting API » (avec « Direct Post »).",
    "Adresse de redirection (Login Kit) : https://tuvoa-app.vercel.app/api/tiktok/callback. Autorisations : user.info.basic et video.publish.",
    "Vérifie l'adresse https://tuvoa-app.vercel.app/ comme préfixe d'URL (Content Posting API › URL properties) : envoie-moi le fichier de vérification, je le mets en ligne.",
    "Dans Vercel : TIKTOK_CLIENT_KEY et TIKTOK_CLIENT_SECRET (onglet « Credentials » de l'app TikTok), puis redéploie.",
    "Ouvre https://tuvoa-app.vercel.app/api/tiktok/login et autorise le compte TikTok de TUVOA.",
    "Tant que TikTok n'a pas validé l'app (audit), les publications sont visibles par toi seul. Demande l'audit dans le portail pour publier en public.",
  ],
};

type Diag = { id: string; label: string; ok: boolean; detail: string };
type Sante = {
  dernier: Partial<Record<Platform, string>>;
  incidents: { plateforme: Platform; at: string; detail: string; titre: string; id: string; resolu: boolean }[];
  jeton: { expire: string | null; accesDonnees: string | null; autorisations: string[] } | null;
  diagnostic: Diag[];
  stockage: { capacite: number; utilise: number; n: number } | null;
  ia: "claude" | "gemini" | null;
  voix: boolean;
  demo?: boolean;
};
type Etat = "ok" | "warn" | "off" | "err";
const ETATS: Record<Etat, [string, string, string, string]> = {
  ok: ["Opérationnel", "#D9F7E6", "#05603A", "#16A34A"],
  warn: ["À surveiller", "#FFE8DC", "#9A3412", "#E94A06"],
  off: ["Non connecté", "#EEF2F8", "#5B6B86", "#9AA8BE"],
  err: ["En panne", "#FDE3E6", "#9F1239", "#E11D2E"],
};
const COULEUR: Record<Platform, string> = { facebook: "#1877F2", linkedin: "#0A66C2", wordpress: "#0A2A66", tiktok: "#0B1A33" };
const ROLE: Record<Platform, string> = { facebook: "Publications, commentaires, messages", linkedin: "Publication via Make", wordpress: "Articles du site", tiktok: "Vidéos et carrousels" };
const AUTORISATIONS: [string, string][] = [
  ["pages_manage_posts", "Publier sur la Page"],
  ["pages_read_engagement", "Lire les réactions et commentaires"],
  ["pages_manage_engagement", "Répondre et masquer les commentaires"],
  ["pages_messaging", "Répondre aux messages privés"],
  ["pages_read_user_content", "Voir les mentions de la Page"],
];

function quand(iso?: string | null): string {
  if (!iso) return "jamais ces 14 derniers jours";
  const d = new Date(iso);
  const auj = d.toDateString() === new Date().toDateString();
  return `${auj ? "aujourd'hui" : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })}, ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}
const jours = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5) : null);

function Puce({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  return (
    <li className="row" style={{ gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.4 }}>
      <span style={{ width: 18, height: 18, borderRadius: 9, flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: ok ? "#16A34A" : ok === false ? "#E94A06" : "#C9D3E3" }}>
        <Trait d={ok ? "M20 6L9 17l-5-5" : "M12 8v5M12 17h.01"} size={11} stroke={3.2} />
      </span>
      <span style={{ color: ok === false ? "#9A3412" : "#33425C", fontWeight: ok === false ? 600 : 400 }}>{children}</span>
    </li>
  );
}

function Carte({ ini, couleur, nom, role, etat, children, actions, extra }: { ini: string; couleur: string; nom: string; role: string; etat: Etat; children: React.ReactNode; actions?: React.ReactNode; extra?: React.ReactNode }) {
  const e = ETATS[etat];
  return (
    <article className="tv-cnx" data-etat={etat}>
      <div className="row" style={{ gap: 12 }}>
        <span className="ico" style={{ background: couleur }}>{ini}</span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}><strong style={{ fontFamily: "var(--font-mont)", fontSize: 16 }}>{nom}</strong><span className="tv-gris" style={{ fontSize: 12 }}>{role}</span></span>
        <span className="tv-etat" style={{ background: e[1], color: e[2] }}><i style={{ background: e[3] }} />{e[0]}</span>
      </div>
      {extra}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>{children}</ul>
      {actions ? <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: "auto" }}>{actions}</div> : null}
    </article>
  );
}

export default function Connexions() {
  const [info, setInfo] = useState<Info | null>(null);
  const [sante, setSante] = useState<Sante | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [tests, setTests] = useState<Record<string, { ok: boolean; detail: string }> | null>(null);
  const [testeA, setTesteA] = useState<Date | null>(null);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [makeMsg, setMakeMsg] = useState("");

  async function sendMakeExample() {
    setSending(true);
    setMakeMsg("");
    try {
      const res = await fetch("/api/connexions/make-exemple", { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || `Envoi impossible (${res.status}).`);
      setMakeMsg("Exemple envoyé : Make connaît maintenant les champs text, image_url, title…");
    } catch (e) {
      setMakeMsg(`Échec : ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  }

  async function runTests() {
    setTesting(true);
    setError("");
    try {
      const [res] = await Promise.all([
        fetch("/api/connexions", { cache: "no-store" }),
        fetch("/api/connexions/sante", { cache: "no-store" }).then((r) => r.json()).then((d: Sante) => !d.demo && setSante(d)).catch(() => {}),
      ]);
      const d = (await res.json()) as { results?: Record<string, { ok: boolean; detail: string }>; error?: string };
      if (!res.ok || !d.results) throw new Error(d.error || `Test impossible (${res.status}).`);
      setTests(d.results);
      setTesteA(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    getInfo().then(setInfo).catch((e: Error) => setError(e.message));
    fetch("/api/connexions/sante", { cache: "no-store" }).then((r) => r.json()).then((d: Sante) => !d.demo && setSante(d)).catch(() => {});
  }, []);

  // État de chaque canal
  const etatCanal = (p: Platform): Etat => {
    const c = info?.connections[p];
    if (!c?.configured) return "off";
    if (tests?.[p] && !tests[p].ok) return "err";
    const recents = (sante?.incidents ?? []).filter((i) => i.plateforme === p && !i.resolu);
    if (recents.length) return "warn";
    if (p === "facebook") {
      const j = jours(sante?.jeton?.expire ?? null);
      if ((j !== null && j < 15) || (sante?.diagnostic ?? []).some((d) => !d.ok)) return "warn";
    }
    return "ok";
  };
  const etats = PLATFORMS.map((p) => etatCanal(p.id));
  const svcOk = [Boolean(info?.ai), Boolean(sante?.voix), Boolean(info && !info.demo)];
  const total = etats.length + svcOk.length;
  const okCount = etats.filter((e) => e === "ok").length + svcOk.filter(Boolean).length;

  const jetonJours = jours(sante?.jeton?.expire ?? null);
  const vInc = useVoirPlus(sante?.incidents ?? []);
  const scopes = sante?.jeton?.autorisations ?? [];
  const manquantes = AUTORISATIONS.filter(([k]) => scopes.length && !scopes.includes(k));
  const alerte =
    jetonJours !== null && jetonJours < 15 ? `Le jeton de la Page Facebook expire dans ${jetonJours} jour${jetonJours > 1 ? "s" : ""}. Renouvelez-le dans Vercel (FB_PAGE_TOKEN) avant cette date.`
    : manquantes.length ? `Une autorisation manque sur la Page Facebook : « ${manquantes[0][1]} ». Sans elle, VOA ne peut pas faire ce travail.`
    : (sante?.diagnostic ?? []).find((d) => !d.ok)?.detail ?? "";

  const aide = (id: string, lignes: string[]) =>
    open === id ? <li><ol id={`aide-${id}`} className="tv-aide">{lignes.map((h) => <li key={h}>{h}</li>)}</ol></li> : null;
  const btnAide = (id: string, configure: boolean) => (
    <button type="button" className={configure ? "btn small" : "btn small dark"} aria-expanded={open === id} aria-controls={`aide-${id}`} onClick={() => setOpen(open === id ? null : id)}>
      {configure ? "Changer de compte" : "Relier"}
    </button>
  );

  return (
    <div className="tv-page">
      <div className="tv-corps" style={{ paddingTop: 20 }}>
        <div className="tv-entete" style={{ gap: 12 }}>
          <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 6 }}>
            <Link href="/" className="tv-gris tv-desk" style={{ textDecoration: "none", fontWeight: 600 }}>← Tableau de bord</Link>
            <h1 className="tv-titre">Connexions</h1>
            <span style={{ fontSize: 14, color: "#33425C" }}>L'état de chaque compte et service dont TUVOA a besoin pour publier.</span>
          </div>
          <span className="tv-rond" style={{ width: "auto", height: 52, padding: "0 16px", borderRadius: 16, gap: 8, fontSize: 14, cursor: "default" }}>
            <strong style={{ fontFamily: "var(--font-mont)", fontSize: 20 }}>{info ? `${okCount} / ${total}` : "…"}</strong>
            opérationnels{testeA ? ` · testé à ${testeA.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
          <button type="button" className="tv-btn-nuit" onClick={runTests} disabled={testing}>
            <Trait d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" size={16} stroke={2.2} />{testing ? "TEST EN COURS…" : "TOUT TESTER"}
          </button>
        </div>

        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {alerte ? (
          <div className="tv-alerte-cnx" role="status">
            <Trait d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" size={22} stroke={2} />
            <span style={{ flex: "1 1 300px" }}>{alerte}</span>
            <button type="button" className="tv-btn-nuit" style={{ height: 44 }} onClick={() => setOpen("facebook")}>Voir la marche à suivre</button>
          </div>
        ) : null}

        <div className="row" style={{ alignItems: "baseline", gap: 10 }}><h2 className="tv-h2" style={{ fontSize: 22 }}>Canaux de publication</h2><span className="tv-gris">là où TUVOA publie</span></div>
        <div className="tv-cnx-grille">
          {PLATFORMS.map((p) => {
            const c = info?.connections[p.id];
            const t = tests?.[p.id];
            return (
              <Carte
                key={p.id}
                ini={LETTRE[p.id]}
                couleur={COULEUR[p.id]}
                nom={p.id === "wordpress" ? "Site tuvoa.media" : p.label}
                role={ROLE[p.id]}
                etat={info ? etatCanal(p.id) : "off"}
                extra={p.id === "facebook" && jetonJours !== null ? (
                  <div className="tv-jeton" data-urgent={jetonJours < 15}>
                    <strong>{jetonJours} j</strong>
                    <span>avant l'expiration du jeton de la Page ({new Date(sante?.jeton?.expire as string).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}).</span>
                  </div>
                ) : p.id === "facebook" && sante?.jeton && !sante.jeton.expire ? (
                  <div className="tv-jeton"><strong>∞</strong><span>Jeton de Page sans date d'expiration.</span></div>
                ) : null}
                actions={
                  <>
                    {btnAide(p.id, Boolean(c?.configured))}
                    {p.id === "linkedin" && c?.configured && c.detail.includes("Make") ? <button type="button" className="btn small" disabled={sending} onClick={sendMakeExample}>{sending ? "Envoi…" : "Envoyer un exemple à Make"}</button> : null}
                    {p.id === "tiktok" && c?.configured ? <a className="btn small" href="/api/tiktok/login">Autoriser le compte</a> : null}
                  </>
                }
              >
                {!info ? <Puce ok={null}>…</Puce> : !c?.configured ? (
                  <Puce ok={null}>Pas encore relié.</Puce>
                ) : (
                  <>
                    <Puce ok={Boolean(sante?.dernier[p.id])}>Dernière publication réussie : {sante ? quand(sante.dernier[p.id]) : "…"}</Puce>
                    {t ? <Puce ok={t.ok}>{t.detail}</Puce> : <Puce ok={null}>Relié · {c.detail}</Puce>}
                    {p.id === "facebook" && scopes.length ? AUTORISATIONS.map(([k, l]) => <Puce key={k} ok={scopes.includes(k)}>{l}{scopes.includes(k) ? "" : " : autorisation manquante"}</Puce>) : null}
                    {(sante?.incidents ?? []).filter((i) => i.plateforme === p.id && !i.resolu).slice(0, 1).map((i) => <Puce key={i.id} ok={false}>Échec non résolu : {i.detail}</Puce>)}
                  </>
                )}
                {makeMsg && p.id === "linkedin" ? <Puce ok={!makeMsg.startsWith("Échec")}>{makeMsg}</Puce> : null}
                {aide(p.id, c?.configured ? ["Pour changer de compte, remplacez les variables dans Vercel puis redéployez.", ...(p.id === "facebook" ? ["Un nouveau jeton de Page doit avoir les autorisations listées ci-dessus."] : [])] : HELP[p.id])}
              </Carte>
            );
          })}
        </div>

        <div className="row" style={{ alignItems: "baseline", gap: 10 }}><h2 className="tv-h2" style={{ fontSize: 22 }}>Services</h2><span className="tv-gris">ce qui fait tourner l'app</span></div>
        <div className="tv-veille">
          <div className="tv-cnx-grille" style={{ flex: "999 1 600px", minWidth: 0 }}>
            <Carte ini="IA" couleur="linear-gradient(145deg, #C4B5FD, #7C3AED)" nom="Rédaction par l'IA" role={info?.aiProvider === "claude" ? "Claude" : "Google Gemini · gratuit"} etat={!info ? "off" : info.ai ? "ok" : "off"}
              actions={!info?.ai ? btnAide("ia", false) : undefined}>
              <Puce ok={info ? info.ai : null}>{info?.ai ? "Rédige les posts, les accroches et les réponses de VOA" : "Non configurée : les textes sont préparés sans IA"}</Puce>
              <Puce ok={null}>Claude prend le relais si une clé ANTHROPIC_API_KEY est ajoutée</Puce>
              {aide("ia", ["Gratuit : créez une clé sur aistudio.google.com (Get API key), puis ajoutez GEMINI_API_KEY dans Vercel et redéployez.", "Ou payant à l'usage : clé Claude sur platform.claude.com, à ajouter comme ANTHROPIC_API_KEY."])}
            </Carte>
            <Carte ini="V" couleur="linear-gradient(145deg, #FCA5A5, #B91C1C)" nom="Voix off" role="Synthèse vocale Gemini" etat={!sante ? "off" : sante.voix ? "ok" : "off"}
              actions={<Link className="btn small" href="/minute-cyber">Ouvrir La minute cyber</Link>}>
              <Puce ok={sante ? sante.voix : null}>{sante?.voix ? "Voix de Mara disponible pour La minute cyber et le Studio" : "Ajoutez GEMINI_API_KEY dans Vercel pour la voix off"}</Puce>
            </Carte>
            <Carte ini="DB" couleur="linear-gradient(145deg, #5EEAD4, #0E9F8E)" nom="Base de données" role="Supabase" etat={!info ? "off" : info.demo ? "warn" : "ok"}
              actions={info?.demo ? btnAide("db", false) : <Link className="btn small" href="/mediatheque">Ouvrir la médiathèque</Link>}
              extra={sante?.stockage ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div className="row" style={{ fontSize: 12 }}><span className="tv-gris" style={{ flex: 1, fontSize: 12 }}>Stockage des fichiers</span><strong>{taille(sante.stockage.utilise)} / {taille(sante.stockage.capacite)}</strong></div>
                  <span style={{ height: 8, borderRadius: 4, background: "#EDF1F7", display: "flex" }}><span style={{ width: `${Math.max(1, (sante.stockage.utilise / sante.stockage.capacite) * 100)}%`, borderRadius: 4, background: "#0E9F8E" }} /></span>
                </div>
              ) : null}>
              <Puce ok={info ? !info.demo : null}>{info?.demo ? "Mode démo : posts gardés sur ce téléphone" : "Supabase connecté : publications, réglages, journal de VOA"}</Puce>
              {sante?.stockage ? <Puce ok>{sante.stockage.n} fichiers dans la médiathèque</Puce> : null}
              {aide("db", ["Créez un projet sur supabase.com et lancez supabase/schema.sql dans SQL Editor.", "Dans Vercel : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY, puis redéployez."])}
            </Carte>
          </div>
          <aside className="tv-veille-side">
            <section className="tv-carte-side" aria-labelledby="t-incidents">
              <h2 id="t-incidents" className="tv-h2" style={{ fontSize: 18 }}>Incidents récents</h2>
              {sante && sante.incidents.length === 0 ? <span className="tv-gris" style={{ fontSize: 13 }}>Aucun échec de publication ces 14 derniers jours.</span> : null}
              {!sante ? <span className="tv-gris">…</span> : null}
              <ol className="tv-fil">
                {vInc.visibles.map((i) => (
                  <li key={`${i.id}-${i.plateforme}`}>
                    <span className="trait" style={{ background: i.resolu ? "#9AA8BE" : "#E11D2E" }} />
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 11, color: "#5B6B86" }}>{quand(i.at)} · {PLATFORMS.find((x) => x.id === i.plateforme)?.label}</span>
                      <Link href={`/apercu?id=${i.id}`} style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35, color: "#0B1A33", textDecoration: "none" }}>{i.detail}</Link>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: i.resolu ? "#05603A" : "#9F1239", whiteSpace: "nowrap" }}>{i.resolu ? "Résolu" : "À voir"}</span>
                  </li>
                ))}
              </ol>
              {vInc.bouton}
            </section>
            <p className="notice row" style={{ alignItems: "flex-start", gap: 10 }}>
              <Trait d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01" size={18} />
              <span>TikTok demande une validation de l'application avant toute publication publique. Comptez quelques jours.</span>
            </p>
            <span className="tv-gris" style={{ fontSize: 12, lineHeight: 1.45, padding: "0 6px" }}>Les clés et mots de passe restent dans Vercel : cette page n'en affiche jamais le contenu.</span>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
                window.location.href = "/acces";
              }}
            >
              <Trait d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" size={18} />
              Se déconnecter
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
