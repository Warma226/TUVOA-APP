"use client";
// Le Grin : la boîte de réception de la communauté, préparée par VOA (community manager de la Page Facebook TUVOA).
// Autonomie réglable (pause, VOA propose et je valide, VOA répond seule), réponses à valider avec choix du ton,
// réponses enregistrées, humeur du grin, questions qui reviennent, radar à arnaques, grin du jeudi, piliers, brief du soir.
import { useVoirPlus } from "@/components/VoirPlus";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { VOIX_BRIEF } from "@/lib/voix-liste";
import type { CmFil, CmLigne, CmRapport, CmReglages } from "@/lib/cm";
import Voa, { HUMEURS, type Humeur } from "@/components/Voa";
import { Trait } from "@/components/BottomNav";

type Diag = { id: string; label: string; ok: boolean; detail: string };
type Etat = {
  reglages: CmReglages; journal: CmLigne[]; aTraiter: CmLigne[]; rapport: CmRapport | null; delaiAnnulation: number;
  aujourdhui: CmFil[]; piliers: { nom: string; n: number }[]; dernierGrin: { created_at: string; lien: string | null } | null; diagnostic?: Diag[];
};
type Filtre = "tout" | "valider" | "message" | "commentaire" | "mention" | "arnaque" | "traite";

const CANAL: Record<string, string> = { commentaire: "Commentaire", message: "Message privé", mention: "Mention de TUVOA", lien: "Publication", grin: "Grin du jeudi", piliers: "Piliers du grin", alerte: "Radar à arnaques", crise: "Mode crise" };
const ETAT: Record<string, [string, string]> = {
  propose: ["À valider", "#E94A06"], signale: ["Pour vous", "#E94A06"], erreur: ["Erreur", "#B42318"], repondu: ["Répondu par VOA", "#16A34A"],
  aime: ["Aimé", "#16A34A"], masque: ["Masqué", "#5B6B86"], ignore: ["Ignoré", "#9AA8BE"], lien: ["Lien ajouté", "#2563EB"], publie: ["Publié", "#2563EB"], annule: ["Annulé", "#5B6B86"],
};
const TONS = [["rassurant", "Rassurant"], ["factuel", "Factuel"], ["taquin", "Taquin"], ["court", "Court"]] as const;
const REPONSES_DEFAUT = [
  { titre: "Double authentification", texte: "Le meilleur réflexe : activez la double authentification sur ce compte. Même si votre mot de passe fuite, personne ne pourra se connecter sans le code." },
  { titre: "Signaler une arnaque", texte: "Ne partagez jamais vos codes. Contactez votre opérateur ou votre banque par son numéro officiel, et signalez le compte suspect directement sur Facebook." },
  { titre: "Lire l'article complet", texte: "Merci pour votre intérêt. L'article complet, avec la source, est en lien dans le premier commentaire." },
];
const ANNULABLES = ["repondu", "masque", "aime", "lien", "publie"];

const heure = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const ilYa = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `il y a ${h} h` : new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};
const initiales = (n: string | null) => (n ?? "?").split(/\s+/).map((x) => x[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
const court = (t: string | null, n = 90) => { const x = (t ?? "").replace(/\s+/g, " ").trim(); return x.length > n ? x.slice(0, n - 1) + "…" : x; };
const aValider = (l: CmLigne) => !l.traite && ["propose", "signale", "erreur"].includes(l.action) && !["alerte", "crise"].includes(l.canal);

async function api(body?: unknown, diag = false) {
  const res = await fetch(`/api/cm${diag ? "?diag=1" : ""}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Erreur ${res.status}`);
  return d;
}

function Interrupteur({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch${on ? " on" : ""}`} onClick={onClick}><span /></button>;
}

export default function Grin() {
  const [e, setE] = useState<Etat | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("valider");
  const [choix, setChoix] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState("");
  const [lecture, setLecture] = useState(false);
  const sonBrief = useRef<HTMLAudioElement | null>(null);
  const audioBrief = useRef<{ texte: string; url: string } | null>(null);

  const charger = (diag = false) => api(undefined, diag).then((d: Etat) => setE((old) => ({ ...d, diagnostic: d.diagnostic ?? old?.diagnostic }))).catch((x: Error) => setError(x.message));
  useEffect(() => {
    void charger(true);
    const t = setInterval(() => void charger(), 60000);
    return () => { clearInterval(t); sonBrief.current?.pause(); if (typeof window !== "undefined") window.speechSynthesis?.cancel(); };
  }, []);

  async function regler(patch: Partial<CmReglages>) {
    if (!e) return;
    setE({ ...e, reglages: { ...e.reglages, ...patch } });
    await api({ reglages: patch }).catch((x: Error) => setError(x.message));
  }
  async function action(nom: string, body: unknown, suite?: () => void) {
    setBusy(nom); setError(""); setInfo("");
    try {
      const d = await api(body);
      if (d.log?.length) setInfo(d.log.join(" "));
      suite?.();
      await charger();
    } catch (x) { setError((x as Error).message); } finally { setBusy(""); }
  }

  // Tous les échanges : à traiter + journal récent
  const lignes = useMemo(() => {
    const m = new Map<string, CmLigne>();
    for (const l of [...(e?.aTraiter ?? []), ...(e?.journal ?? [])]) if (!m.has(l.id)) m.set(l.id, l);
    return [...m.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [e]);
  const humains = (l: CmLigne) => ["commentaire", "message", "mention"].includes(l.canal);
  const FILTRES: [Filtre, string, (l: CmLigne) => boolean][] = [
    ["valider", "À valider", aValider],
    ["tout", "Tout", (l) => humains(l) || ["alerte", "crise"].includes(l.canal)],
    ["message", "Messages privés", (l) => l.canal === "message"],
    ["commentaire", "Commentaires", (l) => l.canal === "commentaire"],
    ["mention", "Mentions", (l) => l.canal === "mention"],
    ["arnaque", "Arnaques signalées", (l) => l.canal === "alerte" || Boolean(l.sujet)],
    ["traite", "Traités par VOA", (l) => humains(l) && ["repondu", "aime", "masque"].includes(l.action)],
  ];
  const liste = lignes.filter(FILTRES.find((f) => f[0] === filtre)?.[2] ?? (() => true));
  const ouvert = lignes.find((l) => l.id === choix) ?? liste[0] ?? null;
  useEffect(() => {
    setBrouillon(ouvert && aValider(ouvert) ? ouvert.reponse ?? "" : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert?.id, ouvert?.reponse]);

  const fils = e?.aujourdhui ?? [];
  const humainsAuj = fils.filter((f) => ["commentaire", "message", "mention"].includes(f.canal));
  const tons = { positif: humainsAuj.filter((f) => f.ton === "positif").length, neutre: humainsAuj.filter((f) => f.ton === "neutre").length, negatif: humainsAuj.filter((f) => f.ton === "negatif").length };
  const totalTons = Math.max(1, tons.positif + tons.neutre + tons.negatif);
  const pc = (n: number) => Math.round((n / totalTons) * 100);
  const nbValider = lignes.filter(aValider).length;
  const traitesAuj = humainsAuj.filter((f) => ["repondu", "aime", "masque"].includes(f.action)).length;
  const personnes = new Set(humainsAuj.map((f) => f.auteur)).size;
  const alertes = (e?.aTraiter ?? []).filter((l) => l.canal === "alerte");
  const reponsesTypes = e?.reglages.reponsesTypes?.length ? e.reglages.reponsesTypes : REPONSES_DEFAUT;
  const autonomie = !e ? null : !e.reglages.actif ? "pause" : e.reglages.autonomie === "propose" ? "propose" : "auto";
  const r = e?.rapport?.contenu;
  const vListe = useVoirPlus(liste, 10, filtre);
  const vQ = useVoirPlus(r?.questions ?? []);

  const humeur: Humeur = (() => {
    if (!e) return "veille";
    if (lecture) return "parle";
    if (e.reglages.crise?.active) return "crise";
    if (!e.reglages.actif) return "dort";
    if (alertes.length) return "alerte";
    if (!nbValider && lignes.length) return "content";
    return nbValider ? "ecoute" : "veille";
  })();

  function changerAutonomie(a: "pause" | "propose" | "auto") {
    if (a === "pause") return regler({ actif: false });
    return regler({ actif: true, autonomie: a });
  }
  function crise() {
    const motif = window.prompt("Pourquoi déclencher le mode crise ? (publications automatiques suspendues, VOA ne répond plus seule)");
    if (motif?.trim()) void action("crise", { crise: motif.trim() });
  }
  function enregistrerType() {
    if (!brouillon.trim() || !e) return;
    const titre = window.prompt("Nom de cette réponse enregistrée :", court(brouillon, 30));
    if (!titre?.trim()) return;
    void regler({ reponsesTypes: [...reponsesTypes, { titre: titre.trim(), texte: brouillon.trim() }].slice(-12) });
  }

  function texteBrief() {
    if (!r) return "";
    const gain = r.abonnes != null && r.abonnesVeille != null ? r.abonnes - r.abonnesVeille : null;
    return [
      "Bonsoir ! Ici VOA, avec le brief du grin.", r.resume,
      gain != null ? `La Page compte ${r.abonnes} abonnés, ${gain >= 0 ? `soit ${gain} de plus` : `soit ${-gain} de moins`} qu'hier.` : "",
      r.questions.length ? `Les questions qui reviennent : ${r.questions.join(". ")}.` : "",
      r.idees.length ? `Mes idées pour demain : ${r.idees.join(". ")}.` : "",
      nbValider ? `${nbValider} échange${nbValider > 1 ? "s attendent" : " attend"} votre validation. Bonne soirée !` : "Rien ne vous attend. Bonne soirée !",
    ].filter(Boolean).join("\n\n");
  }
  function lireNavigateur(texte: string) {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) { setLecture(false); return; }
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = "fr-FR"; u.rate = 1.02;
    const v = synth.getVoices().find((x) => x.lang.startsWith("fr"));
    if (v) u.voice = v;
    u.onend = () => setLecture(false);
    synth.cancel(); synth.speak(u);
  }
  // Brief lu par une voix de synthèse chaleureuse (Gemini) ; la voix du navigateur prend le relais si elle est indisponible.
  async function ecouter() {
    if (!r) return;
    if (lecture) { sonBrief.current?.pause(); window.speechSynthesis?.cancel(); setLecture(false); return; }
    const texte = texteBrief();
    setLecture(true);
    try {
      let url = audioBrief.current?.texte === texte ? audioBrief.current.url : "";
      if (!url) {
        const res = await fetch("/api/voix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texte, voix: VOIX_BRIEF, style: "brief" }) });
        const d = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !d.url) throw new Error(d.error || "voix indisponible");
        url = d.url; audioBrief.current = { texte, url };
      }
      const a = new Audio(url); sonBrief.current = a;
      a.onended = () => setLecture(false);
      await a.play();
    } catch {
      lireNavigateur(texte.replace(/\n\n/g, " "));
    }
  }

  const annulable = (l: CmLigne) => ANNULABLES.includes(l.action) && l.canal !== "message" && Date.now() - new Date(l.created_at).getTime() < (e?.delaiAnnulation ?? 0);

  return (
    <div className="tv-page">
      <div className="tv-corps" style={{ paddingTop: 20 }}>
        {/* En-tête */}
        <div className="tv-entete" style={{ gap: 12 }}>
          <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 6 }}>
            <Link href="/" className="tv-gris tv-desk" style={{ textDecoration: "none", fontWeight: 600 }}>← Tableau de bord</Link>
            <div className="row" style={{ gap: 12 }}>
              <Voa humeur={humeur} taille={56} />
              <div>
                <h1 className="tv-titre">Le Grin · VOA</h1>
                <span className="tv-gris" style={{ fontSize: 14 }}>{e ? (e.reglages.crise?.active ? "Mode crise" : HUMEURS[humeur]) : "…"} · commentaires, messages et mentions de la Page</span>
              </div>
            </div>
          </div>
          <div role="radiogroup" aria-label="Autonomie de VOA" className="tv-segments">
            {([["pause", "Pause"], ["propose", "Propose, je valide"], ["auto", "Répond seule"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={autonomie === k} aria-pressed={autonomie === k} onClick={() => changerAutonomie(k)} disabled={!e}>{l}</button>
            ))}
          </div>
          {e && !e.reglages.crise?.active ? <button type="button" className="tv-btn-crise" onClick={crise} disabled={!!busy}><Trait d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" size={16} stroke={2} />Mode crise</button> : null}
        </div>

        {error ? <p className="notice rouge" role="alert">{error}</p> : null}
        {info ? <p className="notice" role="status">{info}</p> : null}
        {e?.reglages.crise?.active ? (
          <section role="alert" className="row" style={{ flexWrap: "wrap", gap: 14, padding: "16px 20px", borderRadius: 20, background: "#B42318", color: "#fff" }}>
            <span style={{ flex: "1 1 360px", fontSize: 15, lineHeight: 1.45 }}><strong>Mode crise depuis le {new Date(e.reglages.crise.depuis).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</strong> · {e.reglages.crise.motif}. Publications automatiques suspendues, VOA ne répond plus seule.</span>
            <button type="button" className="btn" style={{ background: "#fff", borderColor: "#fff", color: "#0B1A33" }} disabled={!!busy} onClick={() => action("fin", { finCrise: true })}>Lever le mode crise</button>
          </section>
        ) : null}

        {/* Indicateurs */}
        <div className="tv-kpis">
          {([[String(nbValider), "à valider", alertes.length ? `dont ${alertes.length} alerte${alertes.length > 1 ? "s" : ""} arnaque` : "réponses préparées par VOA", nbValider ? "#E94A06" : "#0A2A66"],
            [String(personnes), "personnes aujourd'hui", "commentaires, messages, mentions", "#0A2A66"],
            [String(traitesAuj), "échanges traités", "aujourd'hui", "#0A2A66"],
            [humainsAuj.length ? `${pc(tons.positif)} %` : "—", "de réactions positives", "aujourd'hui", "#16A34A"]] as const).map(([v, l, s, c]) => (
            <div key={l} className="tv-kpi"><strong style={{ color: c }}>{v}</strong><span style={{ fontSize: 14, fontWeight: 600 }}>{l}</span><span className="tv-gris" style={{ fontSize: 12 }}>{s}</span></div>
          ))}
        </div>

        {/* Boîte de réception */}
        <div className="tv-grin">
          <nav className="tv-grin-filtres" aria-label="Boîte de réception">
            {FILTRES.map(([k, l, f]) => {
              const n = lignes.filter(f).length;
              return (
                <button key={k} type="button" aria-current={filtre === k ? "true" : undefined} onClick={() => { setFiltre(k); setChoix(null); }}>
                  <span style={{ flex: 1, textAlign: "left" }}>{l}</span><span className="n" data-chaud={k === "valider" && n > 0}>{n}</span>
                </button>
              );
            })}
          </nav>

          <section className="tv-grin-liste" aria-label="Échanges">
            {!e ? <p className="tv-gris" style={{ padding: 12 }}>Chargement du grin…</p> : liste.length === 0 ? <p className="tv-gris" style={{ padding: 12 }}>{filtre === "valider" ? "Rien à valider. VOA s'occupe de tout." : "Aucun échange ici."}</p> : null}
            {vListe.visibles.map((l) => {
              const et = ETAT[l.action] ?? [l.action, "#5B6B86"];
              return (
                <button key={l.id} type="button" className="tv-grin-item" aria-current={ouvert?.id === l.id ? "true" : undefined} onClick={() => setChoix(l.id)}>
                  <span className="av" data-alerte={l.canal === "alerte" || l.canal === "crise"}>{l.canal === "alerte" || l.canal === "crise" ? "!" : initiales(l.auteur)}</span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
                    <span className="row" style={{ gap: 8, alignItems: "baseline" }}><strong style={{ fontSize: 14, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.auteur ?? "VOA"}</strong><span style={{ fontSize: 11, color: "#5B6B86", flexShrink: 0 }}>{ilYa(l.created_at)}</span></span>
                    <span style={{ fontSize: 12, color: "#5B6B86" }}>{CANAL[l.canal] ?? l.canal}</span>
                    <span style={{ fontSize: 13, lineHeight: 1.4, color: "#33425C" }}>{court(l.texte, 110)}</span>
                    <span className="etat" style={{ background: aValider(l) ? "#E94A06" : et[1] }}>{aValider(l) ? (l.action === "erreur" ? "Erreur" : "À valider") : et[0]}</span>
                  </span>
                </button>
              );
            })}
            {vListe.bouton}
          </section>

          <section className="tv-grin-conv" aria-label="Échange ouvert">
            {!ouvert ? <p className="tv-gris" style={{ padding: 20 }}>Choisissez un échange.</p> : (
              <>
                <div className="row tv-grin-conv-haut">
                  <span className="av" style={{ width: 44, height: 44 }}>{initiales(ouvert.auteur)}</span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <strong style={{ fontSize: 16 }}>{ouvert.auteur ?? "VOA"}</strong>
                    <span style={{ fontSize: 12, color: "#5B6B86" }}>{CANAL[ouvert.canal] ?? ouvert.canal} · {heure(ouvert.created_at)}{ouvert.ton ? ` · ton ${ouvert.ton === "negatif" ? "mécontent" : ouvert.ton}` : ""}{ouvert.sujet ? ` · arnaque : ${ouvert.sujet}` : ""}</span>
                  </span>
                  {ouvert.lien ? <a href={ouvert.lien} target={ouvert.lien.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 700, textDecoration: "none" }}>{ouvert.lien.startsWith("/") ? "Ouvrir" : "Voir sur Facebook"}</a> : null}
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  {ouvert.texte ? <div className="bulle">{ouvert.texte}</div> : null}
                  {ouvert.raison && (ouvert.canal === "alerte" || ouvert.canal === "crise" || ouvert.action === "erreur") ? <p style={{ fontSize: 14, lineHeight: 1.5, color: ouvert.action === "erreur" ? "#B42318" : "#33425C" }}>{ouvert.raison}</p> : null}

                  {aValider(ouvert) ? (
                    <div className="tv-proposition">
                      <span className="row" style={{ gap: 8, fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#5B21B6" }}><Trait d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z" size={14} stroke={2} />{ouvert.reponse ? "RÉPONSE PROPOSÉE PAR VOA" : "VOTRE RÉPONSE"}</span>
                      <label><span className="sr-only">Réponse</span><textarea rows={4} value={brouillon} onChange={(x) => setBrouillon(x.target.value)} placeholder="Écrivez la réponse, ou demandez une proposition à VOA avec un ton." /></label>
                      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#5B21B6" }}>Ton</span>
                        {TONS.map(([k, l]) => <button key={k} type="button" className="tv-mini clair" disabled={!!busy} onClick={() => action("ton" + k, { reformuler: ouvert.id, ton: k, texte: brouillon })}>{busy === "ton" + k ? "…" : l}</button>)}
                      </div>
                      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#5B21B6" }}>Réponses enregistrées</span>
                        {reponsesTypes.map((t) => <button key={t.titre} type="button" className="tv-tagbtn" title={t.texte} onClick={() => setBrouillon(brouillon.trim() ? `${brouillon.trim()} ${t.texte}` : t.texte)}>{t.titre}</button>)}
                        {brouillon.trim() ? <button type="button" className="btn link" style={{ fontSize: 12 }} onClick={enregistrerType}>+ Enregistrer celle-ci</button> : null}
                      </div>
                    </div>
                  ) : ouvert.reponse ? (
                    <div className="bulle voa"><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#BFD0FF" }}>{ouvert.action === "repondu" ? "RÉPONSE ENVOYÉE" : "VOA"}</span>{ouvert.reponse}</div>
                  ) : null}
                </div>
                <div className="tv-grin-conv-bas">
                  {aValider(ouvert) ? (
                    <>
                      <button type="button" className="tv-btn-nuit" disabled={!!busy || !brouillon.trim()} onClick={() => action("env", { repondre: ouvert.id, texte: brouillon })}><Trait d="M22 2L11 13M22 2l-7 20-4-9-9-4z" size={16} stroke={2} />{busy === "env" ? "ENVOI…" : "ENVOYER LA RÉPONSE"}</button>
                      {ouvert.canal !== "message" ? <button type="button" className="btn" disabled={!!busy} onClick={() => action("aim", { aimer: ouvert.id })}>Aimer seulement</button> : null}
                      <button type="button" className="btn" disabled={!!busy} onClick={() => action("ign", { traite: ouvert.id })}>Ignorer</button>
                      {ouvert.canal === "commentaire" ? <button type="button" className="btn danger" style={{ marginLeft: "auto" }} disabled={!!busy} onClick={() => action("mas", { masquer: ouvert.id })}>Masquer le commentaire</button> : null}
                    </>
                  ) : ouvert.canal === "alerte" || ouvert.canal === "crise" ? (
                    !ouvert.traite ? <button type="button" className="tv-btn-nuit" disabled={!!busy} onClick={() => action("t", { traite: ouvert.id })}>C'EST TRAITÉ</button> : <span className="tv-gris" style={{ fontSize: 13 }}>Traité.</span>
                  ) : annulable(ouvert) ? (
                    <button type="button" className="btn danger" disabled={!!busy} onClick={() => action("ann", { annuler: ouvert.id })}>Annuler l'action de VOA</button>
                  ) : <span className="tv-gris" style={{ fontSize: 13 }}>Rien à faire : c'est traité.</span>}
                </div>
              </>
            )}
          </section>
        </div>

        {/* Pouls de la communauté */}
        <div className="tv-grin-bas">
          <section className="tv-carte-side" aria-labelledby="t-humeur">
            <h2 id="t-humeur" className="tv-h2" style={{ fontSize: 18 }}>L'humeur du grin</h2>
            <div style={{ height: 14, borderRadius: 7, overflow: "hidden", display: "flex", background: "#EDF1F7" }} role="img" aria-label={`${pc(tons.positif)} % positif, ${pc(tons.neutre)} % neutre, ${pc(tons.negatif)} % mécontent`}>
              <span style={{ width: `${pc(tons.positif)}%`, background: "#16A34A" }} /><span style={{ width: `${pc(tons.neutre)}%`, background: "#9AA8BE" }} /><span style={{ width: `${pc(tons.negatif)}%`, background: "#E94A06" }} />
            </div>
            <div className="row" style={{ gap: 14, fontSize: 12, color: "#5B6B86", flexWrap: "wrap" }}>
              <span><strong style={{ color: "#16A34A" }}>{pc(tons.positif)} %</strong> positif</span><span><strong style={{ color: "#33425C" }}>{pc(tons.neutre)} %</strong> neutre</span><span><strong style={{ color: "#E94A06" }}>{pc(tons.negatif)} %</strong> mécontent</span>
            </div>
            <span style={{ fontSize: 13, color: "#33425C", lineHeight: 1.45 }}>{humainsAuj.length ? `${humainsAuj.length} échange${humainsAuj.length > 1 ? "s" : ""} aujourd'hui.${tons.negatif >= 3 ? " Plusieurs réactions mécontentes : jetez un œil aux derniers commentaires." : ""}` : "Pas encore d'échange aujourd'hui."}</span>
          </section>

          <section className="tv-carte-side" aria-labelledby="t-q">
            <h2 id="t-q" className="tv-h2" style={{ fontSize: 18 }}>Les questions qui reviennent</h2>
            {r?.questions.length ? vQ.visibles.map((q) => (
              <div key={q} className="row" style={{ gap: 10, padding: "8px 0", borderTop: "1px solid #EDF1F7" }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>{q}</span>
                <Link href={`/creer/actu?idee=${encodeURIComponent(q)}`} style={{ fontSize: 12, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>En faire un post</Link>
              </div>
            )) : <span className="tv-gris" style={{ fontSize: 13 }}>Elles apparaîtront après le premier brief du soir.</span>}
            {vQ.bouton}
          </section>

          <section className="tv-voa" aria-labelledby="t-radar" style={{ flex: "none" }}>
            <span className="tv-kicker" style={{ color: "#FFB48A" }}>RADAR À ARNAQUES</span>
            {alertes.length ? alertes.slice(0, 2).map((a) => (
              <div key={a.id} className="tv-voa-alerte">
                <strong style={{ fontSize: 15, lineHeight: 1.35 }}>{a.auteur} signalent : « {court(a.texte, 90)} »</strong>
                <span style={{ fontSize: 13, color: "#DCE5F7" }}>{court(a.raison, 140)}</span>
                <div className="row" style={{ gap: 12 }}>
                  {a.lien ? <Link href={a.lien}>Relire et publier l'alerte →</Link> : null}
                  <button type="button" onClick={() => action("t" + a.id, { traite: a.id })} style={{ border: 0, background: "none", padding: 0, color: "#C9D6F2", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>C'est traité</button>
                </div>
              </div>
            )) : <span style={{ fontSize: 14, color: "#DCE5F7", lineHeight: 1.45 }}>Aucune arnaque signalée en ce moment. Dès que trois personnes signalent la même, VOA prépare une alerte pour les abonnés.</span>}
            {e ? <div className="row" style={{ justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 10 }}><span style={{ fontSize: 13 }}>Radar actif</span><Interrupteur on={e.reglages.radar} label="Radar à arnaques" onClick={() => regler({ radar: !e.reglages.radar })} /></div> : null}
          </section>

          <section className="tv-carte-side" aria-labelledby="t-jeudi">
            <div className="row" style={{ alignItems: "baseline" }}><h2 id="t-jeudi" className="tv-h2" style={{ fontSize: 18, flex: 1 }}>Le grin du jeudi</h2><span style={{ fontSize: 12, fontWeight: 800, color: "#E94A06" }}>jeudi · 19 h</span></div>
            <span style={{ fontSize: 13, color: "#33425C", lineHeight: 1.45 }}>VOA lance une question-débat sur l'actu de la semaine ; vendredi à 12 h, elle publie le meilleur des réponses.</span>
            {e?.dernierGrin?.lien ? <a href={e.dernierGrin.lien} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Voir le dernier grin →</a> : null}
            {e ? <div className="row" style={{ justifyContent: "space-between", borderTop: "1px solid #EDF1F7", paddingTop: 10 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{e.reglages.grin ? "Activé" : "Désactivé"}</span><Interrupteur on={e.reglages.grin} label="Le grin du jeudi" onClick={() => regler({ grin: !e.reglages.grin })} /></div> : null}
          </section>

          <section className="tv-carte-side" aria-labelledby="t-piliers">
            <h2 id="t-piliers" className="tv-h2" style={{ fontSize: 18 }}>Les piliers du grin</h2>
            <div className="row" style={{ gap: 8 }}>
              {e?.piliers.length ? e.piliers.map((p, i) => (
                <span key={p.nom} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textAlign: "center" }}>
                  <span style={{ width: 42, height: 42, borderRadius: 21, background: ["#2563EB", "#7C3AED", "#0E9F8E"][i], color: "#fff", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{initiales(p.nom)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{p.nom}</span><span style={{ fontSize: 11, color: "#5B6B86" }}>{p.n} échange{p.n > 1 ? "s" : ""}</span>
                </span>
              )) : <span className="tv-gris" style={{ fontSize: 13 }}>Les membres les plus actifs de la semaine apparaîtront ici.</span>}
            </div>
            {e ? <div className="row" style={{ justifyContent: "space-between", borderTop: "1px solid #EDF1F7", paddingTop: 10 }}><span style={{ fontSize: 12, color: "#5B6B86" }}>Merci public le vendredi</span><Interrupteur on={e.reglages.piliers} label="Les piliers du grin" onClick={() => regler({ piliers: !e.reglages.piliers })} /></div> : null}
          </section>

          <section className="tv-carte-side" aria-labelledby="t-brief">
            <h2 id="t-brief" className="tv-h2" style={{ fontSize: 18 }}>Le brief du soir</h2>
            <div className="row" style={{ gap: 12, padding: "10px 12px", borderRadius: 16, background: "#EEF3FF" }}>
              <button type="button" aria-label={lecture ? "Arrêter la lecture" : "Écouter le brief"} onClick={ecouter} disabled={!r} style={{ width: 44, height: 44, borderRadius: 22, border: 0, background: "#2563EB", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <Trait d={lecture ? "M6 4h4v16H6zM14 4h4v16h-4z" : "M7 4l13 8-13 8z"} size={18} stroke={2} />
              </button>
              <span style={{ fontSize: 13, color: "#1D4ED8", fontWeight: 600 }}>{r ? `Brief du ${new Date(e?.rapport?.jour ?? Date.now()).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : `Premier brief ce soir à ${e?.reglages.heureRapport ?? 20} h`}</span>
            </div>
            {r?.resume ? <span style={{ fontSize: 13, color: "#33425C", lineHeight: 1.45 }}>{court(r.resume, 220)}</span> : null}
            <button type="button" className="btn small" style={{ alignSelf: "flex-start" }} disabled={!!busy} onClick={() => action("rapport", { rapport: true })}>{busy === "rapport" ? "VOA rédige…" : "Brief maintenant"}</button>
          </section>
        </div>

        {/* Réglages et journal */}
        {e ? (
          <details className="tv-carte">
            <summary className="tv-h2" style={{ cursor: "pointer", fontSize: 18 }}>Réglages de VOA</summary>
            {([["lienArticle", "Lien de l'article en commentaire", "Sous chaque publication, le lien vers l'article du site."]] as const).map(([cle, titre, texte]) => (
              <div key={cle} className="row" style={{ justifyContent: "space-between", gap: 14, borderTop: "1px solid #EDF1F7", paddingTop: 12 }}>
                <div><p style={{ fontWeight: 700, fontSize: 15 }}>{titre}</p><p className="tv-gris" style={{ fontSize: 13 }}>{texte}</p></div>
                <Interrupteur on={e.reglages[cle]} label={titre} onClick={() => regler({ [cle]: !e.reglages[cle] } as Partial<CmReglages>)} />
              </div>
            ))}
            <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
              <button type="button" className="btn small" disabled={!!busy} onClick={() => action("lancer", { lancer: true })}>{busy === "lancer" ? "Passage en cours…" : "Lancer un passage maintenant"}</button>
            </div>
            {e.diagnostic?.some((d) => !d.ok) ? (
              <div className="notice ambre">
                <strong>Accès à la Page incomplet</strong>
                <ul style={{ paddingLeft: 18, marginTop: 6 }}>{e.diagnostic.filter((d) => !d.ok).map((d) => <li key={d.id}>{d.label} : {d.detail}</li>)}</ul>
                <p style={{ marginTop: 6 }}>Voir <Link href="/connexions">Connexions</Link> pour corriger.</p>
              </div>
            ) : null}
          </details>
        ) : null}
      </div>
    </div>
  );
}
