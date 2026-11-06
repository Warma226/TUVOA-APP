"use client";
// Le Grin : l'écran de VOA, l'agent community manager de la Page Facebook TUVOA.
// Le pagne du jour (chaque échange tissé à son heure), la voix de VOA, le radar à arnaques, tes décisions,
// les piliers du grin, le brief du soir (lu à voix haute par le téléphone), les réglages et le journal complet.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CmFil, CmLigne, CmRapport, CmReglages } from "@/lib/cm";
import Voa, { HUMEURS, type Humeur } from "@/components/Voa";

type Diag = { id: string; label: string; ok: boolean; detail: string };
type Etat = {
  reglages: CmReglages; journal: CmLigne[]; aTraiter: CmLigne[]; rapport: CmRapport | null; delaiAnnulation: number;
  aujourdhui: CmFil[]; piliers: { nom: string; n: number }[]; dernierGrin: { created_at: string; lien: string | null } | null; diagnostic?: Diag[];
};

// Couleurs de TUVOA Tech Media : bleu TUVOA, bleu nuit, noir, blanc, gris clair ; bleu clair et orange en accents.
const C = { coton: "#F3F4F6", papier: "#FFFFFF", encre: "#0A0A0A", gris: "#5B6170", trait: "#E5E7EB", bleu: "#2563EB", indigo: "#0A2A66", ocre: "#6E9BFF", terre: "#C2410C", rouille: "#E94A06", sable: "#CBD5E1", vide: "#1F2937", cendre: "#6B7280", blancFil: "#FFFFFF" };
const LEGENDE = [
  { label: "Enthousiaste", couleur: C.bleu }, { label: "Neutre", couleur: C.sable }, { label: "Message privé", couleur: C.ocre },
  { label: "Mécontent", couleur: C.rouille }, { label: "Spam écarté", couleur: C.cendre }, { label: "Action de VOA", couleur: C.blancFil },
];
const ACTION: Record<string, string> = { repondu: "Répondu", aime: "Aimé", masque: "Masqué", signale: "Pour toi", ignore: "Ignoré", lien: "Lien article", publie: "Publié", annule: "Annulé", erreur: "Erreur" };
const CANAL: Record<string, string> = { commentaire: "Commentaire", message: "Message privé", mention: "Mention de TUVOA", lien: "Publication", grin: "Grin du jeudi", piliers: "Piliers du grin", alerte: "Radar à arnaques", crise: "Mode crise" };
const ANNULABLES = ["repondu", "signale", "masque", "aime", "lien", "publie"];
const TITRE = "var(--font-grin), var(--font-archivo), sans-serif";

const heure = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).replace(":", "h");
const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " GMT";
const prenom = (n: string | null) => (n ?? "un abonné").split(/\s+/)[0];
const court = (t: string | null, n = 90) => { const x = (t ?? "").replace(/\s+/g, " ").trim(); return x.length > n ? x.slice(0, n - 1) + "…" : x; };

// Ce que VOA a fait, raconté par elle-même.
function voix(l: CmLigne): string {
  switch (l.action) {
    case "repondu": return l.canal === "mention" ? `J'ai répondu à ${prenom(l.auteur)}, qui a cité TUVOA : « ${court(l.reponse, 110)} »` : `J'ai répondu à ${prenom(l.auteur)} : « ${court(l.reponse, 110)} »`;
    case "aime": return `J'ai aimé le commentaire de ${prenom(l.auteur)}.`;
    case "masque": return `J'ai masqué un commentaire indésirable (${court(l.raison, 60) || "spam"}).`;
    case "signale": return l.canal === "alerte" ? `J'ai repéré une arnaque signalée par ${l.auteur} et rédigé l'alerte.` : l.canal === "crise" ? `J'ai déclenché le mode crise : ${court(l.texte, 80)}.` : `Je t'ai gardé le message de ${prenom(l.auteur)} : « ${court(l.texte, 90)} »`;
    case "lien": return `J'ai ajouté le lien de l'article sous « ${court(l.texte, 80)} ».`;
    case "publie": return l.canal === "piliers" ? "J'ai remercié les piliers du grin." : "J'ai publié le grin du jeudi.";
    case "annule": return `Tu as annulé une de mes actions (${prenom(l.auteur)}).`;
    case "erreur": return `Je n'ai pas pu traiter le message de ${prenom(l.auteur)} : ${court(l.raison, 90)}`;
    default: return `J'ai laissé passer le message de ${prenom(l.auteur)}.`;
  }
}

function couleurFil(f: CmFil): string {
  if (["lien", "publie"].includes(f.action) || ["grin", "piliers", "alerte", "crise"].includes(f.canal)) return C.blancFil;
  if (f.action === "masque") return C.cendre;
  if (f.canal === "message") return C.ocre;
  if (f.ton === "negatif") return C.rouille;
  if (f.ton === "positif") return C.bleu;
  return C.sable;
}

const colonne = (iso: string) => { const d = new Date(iso); return Math.min(71, Math.floor((d.getUTCHours() * 60 + d.getUTCMinutes()) / 20)); };

// Le pagne : 72 colonnes (une toutes les 20 min), chaque échange tissé dans la colonne de son heure,
// en partant du centre comme une trame, pour un motif équilibré.
function tisser(fils: CmFil[], rangs: number): string[] {
  const cols: string[][] = Array.from({ length: 72 }, () => []);
  for (const f of [...fils].sort((a, b) => a.created_at.localeCompare(b.created_at))) cols[colonne(f.created_at)].push(couleurFil(f));
  const milieu = Math.floor(rangs / 2);
  const cellules: string[] = [];
  for (let r = 0; r < rangs; r++) for (let c = 0; c < 72; c++) {
    const i = r >= milieu ? (r - milieu) * 2 : (milieu - r) * 2 - 1;
    cellules.push(cols[c][i] ?? C.vide);
  }
  return cellules;
}

async function api(body?: unknown, diag = false) {
  const res = await fetch(`/api/cm${diag ? "?diag=1" : ""}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Erreur ${res.status}`);
  return d;
}

function Interrupteur({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={onClick}>
      <span />
    </button>
  );
}

export default function Grin() {
  const [e, setE] = useState<Etat | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [lecture, setLecture] = useState(false);

  const charger = (diag = false) => api(undefined, diag).then((d: Etat) => setE((old) => ({ ...d, diagnostic: d.diagnostic ?? old?.diagnostic }))).catch((x: Error) => setError(x.message));
  useEffect(() => {
    void charger(true);
    const t = setInterval(() => void charger(), 60000); // le grin se met à jour tout seul
    return () => { clearInterval(t); if (typeof window !== "undefined") window.speechSynthesis?.cancel(); };
  }, []);

  async function regler(patch: Partial<CmReglages>) {
    if (!e) return;
    setE({ ...e, reglages: { ...e.reglages, ...patch } });
    await api({ reglages: patch }).catch((x: Error) => setError(x.message));
  }
  async function action(nom: string, body: unknown) {
    setBusy(nom); setError("");
    try {
      const d = await api(body);
      if (d.log) setLog(d.log);
      await charger();
    } catch (x) { setError((x as Error).message); } finally { setBusy(""); }
  }

  const fils = useMemo(() => e?.aujourdhui ?? [], [e]);
  const humains = fils.filter((f) => ["commentaire", "message", "mention"].includes(f.canal));
  const personnes = new Set(humains.map((f) => f.auteur)).size;
  const nb = (a: string) => humains.filter((f) => f.action === a).length;
  const rangs = useMemo(() => {
    const parCol = new Array(72).fill(0);
    for (const f of fils) parCol[colonne(f.created_at)]++;
    return Math.min(24, Math.max(14, Math.max(...parCol) + 2));
  }, [fils]);
  const pagne = useMemo(() => tisser(fils, rangs), [fils, rangs]);
  const couverture = useMemo(() => { const p = tisser(fils, 12); return Array.from({ length: 144 }, (_, k) => p[Math.floor(k / 12) * 72 + 24 + (k % 12) * 4] ?? C.vide); }, [fils]);
  const alertes = (e?.aTraiter ?? []).filter((l) => l.canal === "alerte" || l.canal === "crise");
  const decisions = (e?.aTraiter ?? []).filter((l) => l.canal !== "alerte" && l.canal !== "crise");
  // L'humeur de VOA suit la Page : pause, crise, arnaque repérée, réponse récente, message en cours, fête, tout traité.
  const humeur: Humeur = (() => {
    if (!e) return "veille";
    if (lecture) return "parle";
    if (e.reglages.crise?.active) return "crise";
    if (!e.reglages.actif) return "dort";
    if (alertes.length) return "alerte";
    const recent = e.journal.find((l) => l.action !== "ignore");
    const age = recent ? Date.now() - new Date(recent.created_at).getTime() : Infinity;
    if (recent && age < 10 * 60000 && recent.canal === "piliers") return "fete";
    if (recent && age < 5 * 60000 && ["repondu", "signale"].includes(recent.action)) return "parle";
    if (recent && age < 5 * 60000) return "ecoute";
    if (!decisions.length && (e.journal.length > 0)) return "content";
    return "veille";
  })();
  const r = e?.rapport?.contenu;
  const gain = r?.abonnes != null && r?.abonnesVeille != null ? r.abonnes - r.abonnesVeille : null;
  const aujourdhuiTxt = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  // Le brief lu à voix haute par le téléphone (synthèse vocale du navigateur, en français).
  function ecouter() {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth || !r) return;
    if (lecture) { synth.cancel(); setLecture(false); return; }
    const texte = [
      "Bonsoir. Ici VOA, le brief du grin.",
      r.resume,
      gain != null ? `La Page compte ${r.abonnes} abonnés, ${gain >= 0 ? `soit ${gain} de plus` : `soit ${-gain} de moins`} qu'hier.` : "",
      r.questions.length ? `Les questions qui reviennent : ${r.questions.join(". ")}.` : "",
      r.idees.length ? `Mes idées pour demain : ${r.idees.join(". ")}.` : "",
      decisions.length ? `${decisions.length} décision${decisions.length > 1 ? "s t'attendent" : " t'attend"}. Bonne soirée.` : "Rien ne t'attend. Bonne soirée.",
    ].filter(Boolean).join(" ");
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = "fr-FR";
    u.rate = 1.02;
    const v = synth.getVoices().find((x) => x.lang.startsWith("fr"));
    if (v) u.voice = v;
    u.onend = () => setLecture(false);
    synth.cancel();
    synth.speak(u);
    setLecture(true);
  }

  const carte: React.CSSProperties = { background: C.papier, border: `2px solid ${C.encre}`, padding: 22, display: "flex", flexDirection: "column", gap: 12 };
  const surtitre: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: C.bleu };
  const h3: React.CSSProperties = { fontFamily: TITRE, fontWeight: 800, fontSize: 26, lineHeight: 1.1, letterSpacing: -0.5 };
  const bouton = (plein: boolean, fond = C.encre, texte = C.coton): React.CSSProperties => ({ minHeight: 48, padding: "0 18px", border: `2px solid ${fond}`, background: plein ? fond : "transparent", color: plein ? texte : fond, fontWeight: 700, fontSize: 15, cursor: "pointer", borderRadius: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" });

  return (
    <div style={{ flex: 1, background: C.coton, color: C.encre, minHeight: "100vh", fontFamily: "var(--font-inter), sans-serif" }}>
      <style>{`
        @keyframes grinPouls{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.2);opacity:0}}
        .grin-pouls{animation:grinPouls 2.2s ease-out infinite}
        @keyframes grinOnde{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
        .grin-onde{transform-origin:bottom;animation:grinOnde 1.4s ease-in-out infinite}
        .grin-wrap{max-width:1240px;margin:0 auto;padding:0 18px;display:flex;flex-direction:column;gap:34px}
        .grin-h1{font-family:${TITRE};font-weight:800;font-size:clamp(40px,7vw,74px);line-height:.98;letter-spacing:-2px;margin:12px 0 0}
        .grin-trois{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:20px}
        .grin-pagne{display:grid;grid-template-columns:repeat(72,minmax(0,1fr));gap:2px}
        .grin a{color:${C.encre}}
        @media (prefers-reduced-motion: reduce){.grin-pouls,.grin-onde{animation:none}}
      `}</style>
      <div className="grin" style={{ paddingBottom: 64 }}>
        <div style={{ background: C.encre, color: C.coton }}>
          <div className="grin-wrap" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link href="/" aria-label="Retour à l'accueil" style={{ color: C.coton, display: "flex", width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
              </Link>
              <span style={{ fontFamily: TITRE, fontWeight: 800, fontSize: 22 }}>Le Grin</span>
              <span style={{ fontSize: 14, color: "#C7CBD6" }}>animé par VOA</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <span style={{ position: "relative", width: 12, height: 12, display: "inline-block" }} aria-hidden="true">
                {e?.reglages.actif ? <span className="grin-pouls" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#4ADE80" }} /> : null}
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: e?.reglages.actif ? "#4ADE80" : "#9CA3AF" }} />
              </span>
              <span>{e ? (e.reglages.crise?.active ? "Mode crise" : e.reglages.actif ? "VOA est au grin" : "VOA est en pause") : "…"} · {aujourdhuiTxt}</span>
            </div>
          </div>
        </div>

        <div className="grin-wrap">
          {error ? <p className="notice rouge" role="alert" style={{ marginTop: 20 }}>{error}</p> : null}

          {e?.reglages.crise?.active ? (
            <section style={{ marginTop: 24, background: "#B42318", color: "#FFFFFF", padding: 24, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }} role="alert">
              <div style={{ flex: "1 1 420px" }}>
                <p style={{ ...surtitre, color: "#FFE4D5" }}>Mode crise depuis le {quand(e.reglages.crise.depuis)}</p>
                <p style={{ fontFamily: TITRE, fontWeight: 700, fontSize: 24, lineHeight: 1.25, marginTop: 6 }}>{e.reglages.crise.motif}. Publications automatiques suspendues : VOA ne répond plus seule.</p>
              </div>
              <button type="button" disabled={!!busy} onClick={() => action("crise", { finCrise: true })} style={bouton(true, "#FFFFFF", C.encre)}>Lever le mode crise</button>
            </section>
          ) : null}

          {/* Aujourd'hui au grin + la voix de VOA */}
          <section style={{ display: "flex", flexWrap: "wrap", gap: 36, paddingTop: 36, alignItems: "flex-end" }}>
            <div style={{ flex: "999 1 520px", minWidth: 0 }}>
              <p style={surtitre}>Aujourd&apos;hui au grin</p>
              <h1 className="grin-h1">
                {e ? (personnes ? `${personnes} personne${personnes > 1 ? "s ont" : " a"} parlé avec TUVOA aujourd'hui.` : "Le grin est calme pour l'instant.") : "…"}
              </h1>
              <p style={{ marginTop: 16, maxWidth: 640, fontSize: 18, lineHeight: 1.55, color: C.gris }}>
                {e ? `VOA a répondu ${nb("repondu")} fois, aimé ${nb("aime")} commentaire${nb("aime") > 1 ? "s" : ""}, écarté ${nb("masque")} indésirable${nb("masque") > 1 ? "s" : ""} et t'a gardé ${decisions.length} décision${decisions.length > 1 ? "s" : ""}.` : ""}
              </p>
            </div>
            <div style={{ ...carte, flex: "1 1 340px", minWidth: 0, boxShadow: `8px 8px 0 ${C.encre}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Voa humeur={humeur} taille={96} />
                <div>
                  <p style={{ fontFamily: TITRE, fontWeight: 800, fontSize: 22 }}>VOA</p>
                  <p style={{ fontSize: 14, color: C.gris }}>{HUMEURS[humeur]}</p>
                </div>
              </div>
              {(e?.journal ?? []).filter((l) => l.action !== "ignore").slice(0, 4).map((l) => (
                <p key={l.id} style={{ fontSize: 15, lineHeight: 1.5, paddingTop: 12, borderTop: `1px solid ${C.trait}` }}><strong>{heure(l.created_at)}</strong> · {voix(l)}</p>
              ))}
              {e && !e.journal.some((l) => l.action !== "ignore") ? <p style={{ fontSize: 15, color: C.gris }}>Je n&apos;ai encore rien eu à faire. Je passe toutes les 2 minutes.</p> : null}
            </div>
          </section>

          {/* Studio de VOA */}
          <Link href="/studio" style={{ ...carte, flexDirection: "row", alignItems: "center", gap: 18, textDecoration: "none", color: C.encre, background: C.encre, borderColor: C.encre }}>
            <Voa humeur="parle" taille={78} decor />
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ ...surtitre, color: "#6E9BFF" }}>Nouveau</span>
              <span style={{ fontFamily: TITRE, fontWeight: 800, fontSize: 28, color: "#FFFFFF" }}>Le Studio de VOA</span>
              <span style={{ fontSize: 15, color: "#C7CBD6" }}>Visuels « pub » prêts à publier : photo, cartes flottantes, effet waouh. VOA écrit les textes.</span>
            </span>
            <span style={{ ...bouton(true, C.bleu, "#FFFFFF") }}>Créer un visuel</span>
          </Link>

          {/* Le pagne du jour */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
              <div>
                <h2 style={{ fontFamily: TITRE, fontWeight: 800, fontSize: 38, letterSpacing: -1 }}>Le pagne du jour</h2>
                <p style={{ marginTop: 6, fontSize: 16, color: C.gris, maxWidth: 720 }}>Chaque fil est un échange, tissé à l&apos;heure où il a eu lieu. Comme un Faso Dan Fani, chaque journée de la communauté a son propre motif.</p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, fontWeight: 600 }}>
                {LEGENDE.map((l) => <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 14, background: l.couleur, border: `1px solid ${C.encre}` }} />{l.label}</span>)}
              </div>
            </div>
            <div style={{ background: C.encre, padding: 12, overflowX: "auto" }} role="img" aria-label={`Pagne du jour : ${fils.length} échanges et actions répartis sur la journée`}>
              <div className="grin-pagne" style={{ minWidth: 720 }}>
                {pagne.map((f, i) => <div key={i} style={{ height: 10, background: f }} />)}
              </div>
              <div style={{ minWidth: 720, display: "flex", marginTop: 8, fontSize: 11, color: "#C7CBD6" }}>
                {["0h", "4h", "8h", "12h", "16h", "20h"].map((h) => <span key={h} style={{ flex: 1 }}>{h}</span>)}
              </div>
            </div>
          </section>

          {/* Radar à arnaques et alertes */}
          {alertes.map((a) => (
            <section key={a.id} style={{ background: C.terre, color: "#FFFFFF", padding: "26px 28px", display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
              <div style={{ flex: "999 1 460px", minWidth: 0 }}>
                <p style={{ ...surtitre, color: "#FFE4D5" }}>{a.canal === "alerte" ? "Radar à arnaques" : "Mode crise"} · {quand(a.created_at)}</p>
                <p style={{ fontFamily: TITRE, fontWeight: 700, fontSize: 28, lineHeight: 1.2, marginTop: 8 }}>{a.canal === "alerte" ? `${a.auteur} signalent la même arnaque : « ${a.texte} ».` : a.texte}</p>
                <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.5, color: "#FFEDE3" }}>{a.raison}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {a.lien ? <Link href={a.lien} style={bouton(true, "#FFFFFF", C.encre)}>Relire et publier l&apos;alerte</Link> : null}
                <button type="button" disabled={!!busy} onClick={() => action("t" + a.id, { traite: a.id })} style={bouton(false, "#FFFFFF")}>C&apos;est traité</button>
              </div>
            </section>
          ))}

          {/* Décisions, grin du jeudi, piliers */}
          <section className="grin-trois">
            <div style={carte}>
              <p style={surtitre}>Rien que pour toi</p>
              <h3 style={h3}>{decisions.length ? `${decisions.length} décision${decisions.length > 1 ? "s" : ""} que VOA ne prend pas seule` : "Aucune décision en attente"}</h3>
              {!decisions.length && e ? <div style={{ display: "flex", alignItems: "center", gap: 12 }}><Voa humeur="content" taille={72} decor /><p style={{ fontSize: 15, color: C.gris }}>VOA s&apos;occupe de tout. Tu peux souffler.</p></div> : null}
              {decisions.slice(0, 6).map((d) => (
                <div key={d.id} style={{ borderTop: `1px solid ${C.trait}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: d.action === "erreur" ? C.terre : "#1D4ED8" }}>{d.action === "erreur" ? "ERREUR" : (CANAL[d.canal] ?? d.canal).toUpperCase()} · {d.auteur}</span>
                  <p style={{ fontSize: 15, lineHeight: 1.45 }}>« {court(d.texte, 180)} »</p>
                  {d.reponse ? <p style={{ fontSize: 14, color: C.gris }}>VOA a répondu : {court(d.reponse, 160)}</p> : null}
                  {d.action === "erreur" && d.raison ? <p style={{ fontSize: 13, color: C.terre }}>{court(d.raison, 200)}</p> : null}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                    {d.lien ? <a href={d.lien} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, fontSize: 14, minHeight: 44, display: "inline-flex", alignItems: "center" }}>Répondre sur Facebook</a> : null}
                    <button type="button" className="btn link" style={{ minHeight: 44, color: C.encre, fontWeight: 700 }} onClick={() => action("t" + d.id, { traite: d.id })}>C&apos;est traité</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ ...carte, background: C.indigo, color: C.coton, borderColor: C.indigo }}>
              <p style={{ ...surtitre, color: "#BFD0FF" }}>Le grin du jeudi</p>
              <h3 style={{ ...h3, fontSize: 44, lineHeight: 1 }}>Jeudi, 19h GMT</h3>
              <p style={{ fontSize: 15, lineHeight: 1.55, color: "#DCE6FF" }}>VOA lance une question-débat sur l&apos;actu tech de la semaine. Vendredi à 12h, elle publie le meilleur de vos réponses. Un rendez-vous fixe qui fait revenir la communauté.</p>
              {e?.dernierGrin?.lien ? <a href={e.dernierGrin.lien} target="_blank" rel="noopener noreferrer" style={{ color: "#FFFFFF", fontWeight: 700, minHeight: 44, display: "inline-flex", alignItems: "center" }}>Voir le dernier grin ({quand(e.dernierGrin.created_at)})</a> : <p style={{ fontSize: 14, color: "#BFD0FF" }}>Premier grin : jeudi prochain.</p>}
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderTop: "1px solid #1E3F8A", paddingTop: 12 }}>
                <span style={{ fontWeight: 600 }}>{e?.reglages.grin ? "Activé" : "Désactivé"}</span>
                {e ? <Interrupteur on={e.reglages.grin} label="Le grin du jeudi" onClick={() => regler({ grin: !e.reglages.grin })} /> : null}
              </div>
            </div>

            <div style={carte}>
              <p style={surtitre}>Les piliers du grin</p>
              <h3 style={h3}>Ceux qui font vivre la Page</h3>
              {e?.piliers.length ? e.piliers.map((p, i) => (
                <div key={p.nom} style={{ display: "flex", alignItems: "center", gap: 12, borderTop: `1px solid ${C.trait}`, paddingTop: 12 }}>
                  <div style={{ width: 44, height: 44, flexShrink: 0, background: [C.bleu, C.indigo, C.encre][i], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{p.nom.split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase()}</div>
                  <div><p style={{ fontWeight: 700, fontSize: 15 }}>{p.nom}</p><p style={{ fontSize: 13, color: "#5B6170" }}>{p.n} échange{p.n > 1 ? "s" : ""} cette semaine</p></div>
                </div>
              )) : <p style={{ fontSize: 15, color: C.gris }}>Les membres les plus actifs de la semaine apparaîtront ici.</p>}
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderTop: `1px solid ${C.trait}`, paddingTop: 12 }}>
                <span style={{ fontSize: 14, color: C.gris }}>Merci public vendredi 17h GMT</span>
                {e ? <Interrupteur on={e.reglages.piliers} label="Les piliers du grin" onClick={() => regler({ piliers: !e.reglages.piliers })} /> : null}
              </div>
            </div>
          </section>

          {/* Le brief du soir */}
          <section style={{ background: C.encre, color: C.coton, display: "flex", flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 220px", minHeight: 220, display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 2, padding: 12, background: "#000000" }} aria-hidden="true">
              {couverture.map((f, i) => <div key={i} style={{ background: f }} />)}
            </div>
            <div style={{ flex: "999 1 420px", minWidth: 0, padding: 28, display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ ...surtitre, color: C.ocre }}>Le brief du soir {e?.rapport ? `· ${new Date(e.rapport.jour).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : ""}</p>
              {r ? (
                <>
                  <p style={{ fontFamily: TITRE, fontWeight: 700, fontSize: 26, lineHeight: 1.3 }}>{r.resume || "Pas de résumé pour ce jour."}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13 }}>
                    {r.abonnes != null ? <span style={{ border: "1px solid #5B6170", padding: "5px 9px" }}>{r.abonnes} abonnés{gain != null ? ` (${gain >= 0 ? "+" : ""}${gain})` : ""}</span> : null}
                    {r.meilleuresHeures.length ? <span style={{ border: "1px solid #5B6170", padding: "5px 9px" }}>Heures d&apos;or : {r.meilleuresHeures.join(", ")}</span> : null}
                  </div>
                  {([["Questions qui reviennent", r.questions], ["Idées pour demain", r.idees], ["Pour élargir la couverture", r.conseils]] as const).map(([t, l]) => l.length ? (
                    <div key={t}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: C.ocre }}>{t}</p>
                      <ul style={{ paddingLeft: 18, fontSize: 15, lineHeight: 1.55, color: "#E5E7EB" }}>{l.map((x, i) => <li key={i}>{x}</li>)}</ul>
                    </div>
                  ) : null)}
                </>
              ) : <p style={{ fontFamily: TITRE, fontWeight: 700, fontSize: 24 }}>Premier brief ce soir à {e?.reglages.heureRapport ?? 20}h GMT.</p>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                {r ? (
                  <button type="button" onClick={ecouter} aria-label={lecture ? "Arrêter la lecture" : "Écouter le brief"} style={{ width: 56, height: 56, borderRadius: "50%", border: 0, background: C.ocre, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {lecture
                      ? <svg width="22" height="22" viewBox="0 0 24 24" fill={C.encre} aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
                      : <svg width="22" height="22" viewBox="0 0 24 24" fill={C.encre} aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>}
                  </button>
                ) : null}
                <button type="button" disabled={!!busy} onClick={() => action("rapport", { rapport: true })} style={bouton(false, C.coton)}>{busy === "rapport" ? "VOA rédige…" : "Brief maintenant"}</button>
              </div>
            </div>
          </section>

          {/* Réglages */}
          {e ? (
            <section style={carte}>
              <p style={surtitre}>Réglages de VOA</p>
              {([
                ["actif", "VOA au grin", "Réponses aux commentaires, messages et mentions en 5 minutes au plus, modération et rapport, publiés sans validation."],
                ["lienArticle", "Lien de l'article en commentaire", "Sous chaque publication, le lien vers l'article du site, pour le trafic sans pénaliser la portée."],
                ["radar", "Radar à arnaques", "Trois personnes signalent la même arnaque : VOA rédige l'alerte #CyberActu, à valider dans le calendrier."],
              ] as const).map(([cle, titre, texte]) => (
                <div key={cle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, borderTop: `1px solid ${C.trait}`, paddingTop: 12 }}>
                  <div><p style={{ fontWeight: 700, fontSize: 15 }}>{titre}</p><p style={{ fontSize: 14, color: C.gris, lineHeight: 1.45 }}>{texte}</p></div>
                  <Interrupteur on={e.reglages[cle]} label={titre} onClick={() => regler({ [cle]: !e.reglages[cle] } as Partial<CmReglages>)} />
                </div>
              ))}
              <p style={{ fontSize: 14, color: C.gris, borderTop: `1px solid ${C.trait}`, paddingTop: 12 }}>Toujours actifs : réponses aux mentions de TUVOA ailleurs sur Facebook et mode crise automatique.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button type="button" disabled={!!busy} onClick={() => action("lancer", { lancer: true })} style={bouton(true)}>{busy === "lancer" ? "Passage en cours…" : "Lancer un passage maintenant"}</button>
              </div>
              {log.length ? <ul style={{ paddingLeft: 18, fontSize: 13, color: C.gris }}>{log.map((x, i) => <li key={i}>{x}</li>)}</ul> : null}
              {e.diagnostic?.some((d) => !d.ok) ? (
                <div className="notice ambre">
                  <strong>Accès à la Page incomplet</strong>
                  <ul style={{ paddingLeft: 18, marginTop: 6 }}>{e.diagnostic.filter((d) => !d.ok).map((d) => <li key={d.id}>{d.label} : {d.detail}</li>)}</ul>
                  <p style={{ marginTop: 6 }}>Le jeton de Page (FB_PAGE_TOKEN) doit avoir : pages_show_list, pages_read_engagement, pages_read_user_content, pages_manage_engagement, pages_manage_posts et pages_messaging.</p>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Journal complet */}
          {e ? (
            <details style={{ ...carte, gap: 0 }}>
              <summary style={{ cursor: "pointer", fontFamily: TITRE, fontWeight: 800, fontSize: 22, minHeight: 44, display: "flex", alignItems: "center" }}>Le journal de VOA ({e.journal.length} dernières actions)</summary>
              <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
                {e.journal.map((l) => {
                  const annulable = ANNULABLES.includes(l.action) && l.canal !== "message" && Date.now() - new Date(l.created_at).getTime() < e.delaiAnnulation;
                  return (
                    <div key={l.id} style={{ borderTop: `1px solid ${C.trait}`, padding: "12px 0", display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <span style={{ width: 10, height: 10, marginTop: 6, flexShrink: 0, background: couleurFil(l) }} aria-hidden="true" />
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                        <p style={{ fontSize: 13, color: "#5B6170" }}><strong style={{ color: C.encre }}>{ACTION[l.action] ?? l.action}</strong> · {CANAL[l.canal] ?? l.canal} · {quand(l.created_at)}</p>
                        <p style={{ fontSize: 15, lineHeight: 1.5 }}>{voix(l)}</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                          {l.lien ? <a href={l.lien} target={l.lien.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, minHeight: 44, display: "inline-flex", alignItems: "center" }}>{l.lien.startsWith("/") ? "Ouvrir dans l'éditeur" : "Voir sur Facebook"}</a> : null}
                          {annulable ? <button type="button" className="btn link" style={{ minHeight: 44, color: C.terre, fontWeight: 700 }} disabled={!!busy} onClick={() => action("a" + l.id, { annuler: l.id })}>Annuler</button> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!e.journal.length ? <p style={{ paddingTop: 12, color: C.gris }}>Aucune action pour l&apos;instant.</p> : null}
              </div>
            </details>
          ) : !error ? <p style={{ color: C.gris }}>Chargement du grin…</p> : null}
        </div>
      </div>
    </div>
  );
}
