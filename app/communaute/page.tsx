"use client";
// Écran de l'agent community manager : activation, cas à traiter, rapport du jour, journal des actions.
import { useEffect, useState } from "react";
import { TopBar } from "@/components/BottomNav";
import type { CmLigne, CmRapport, CmReglages } from "@/lib/cm";

type Diag = { id: string; label: string; ok: boolean; detail: string };
type Etat = { reglages: CmReglages; journal: CmLigne[]; aTraiter: CmLigne[]; rapport: CmRapport | null; delaiAnnulation: number; diagnostic?: Diag[] };

const ACTION: Record<string, { label: string; cls: string }> = {
  repondu: { label: "Répondu", cls: "vert" },
  aime: { label: "Aimé", cls: "bleu" },
  masque: { label: "Masqué", cls: "rouge" },
  signale: { label: "Transmis", cls: "ambre" },
  ignore: { label: "Ignoré", cls: "" },
  lien: { label: "Lien article", cls: "bleu" },
  publie: { label: "Publié", cls: "vert" },
  annule: { label: "Annulé", cls: "" },
  erreur: { label: "Erreur", cls: "rouge" },
};
const CANAL: Record<string, string> = {
  commentaire: "Commentaire", message: "Message privé", mention: "Mention de TUVOA", lien: "Publication",
  grin: "Grin du jeudi", piliers: "Piliers du grin", alerte: "Radar à arnaques", crise: "Mode crise",
};
const ANNULABLES = ["repondu", "signale", "masque", "aime", "lien", "publie"];

function quand(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " GMT";
}

async function api(body?: unknown, diag = false) {
  const res = await fetch(`/api/cm${diag ? "?diag=1" : ""}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Erreur ${res.status}`);
  return d;
}

function Switch({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={onClick}>
      <span />
    </button>
  );
}

function Ligne({ l, onTraite, onAnnuler }: { l: CmLigne; onTraite?: () => void; onAnnuler?: () => void }) {
  const a = ACTION[l.action] ?? { label: l.action, cls: "" };
  const vraiFaux = l.raison?.startsWith("Vrai ou faux :") && l.action === "repondu";
  return (
    <div className="card" style={{ gap: 6 }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="wrap" style={{ alignItems: "center" }}>
          <span className={`badge ${a.cls}`}>{a.label}</span>
          <span className="badge">{CANAL[l.canal] ?? l.canal}</span>
          {vraiFaux ? <span className="badge bleu">Vrai ou faux</span> : null}
          {l.ton === "negatif" ? <span className="badge ambre">Mécontent</span> : null}
          <strong style={{ fontSize: 14 }}>{l.auteur}</strong>
        </div>
        <span className="muted" style={{ fontSize: 12 }}>{quand(l.created_at)}</span>
      </div>
      {l.texte ? <p style={{ fontSize: 14, lineHeight: 1.5 }}>« {l.texte} »</p> : null}
      {l.reponse ? <p className="muted" style={{ borderLeft: "3px solid var(--bleu)", paddingLeft: 10 }}>{l.reponse}</p> : null}
      {l.raison ? <p className="muted" style={{ fontSize: 12 }}>{l.raison}</p> : null}
      <div className="row" style={{ gap: 14 }}>
        {l.lien ? <a href={l.lien} target={l.lien.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" className="btn link">{l.lien.startsWith("/") ? "Ouvrir dans l'éditeur" : "Ouvrir sur Facebook"}</a> : null}
        {onAnnuler ? <button type="button" className="btn link" style={{ color: "var(--rouge)" }} onClick={onAnnuler}>Annuler</button> : null}
        {onTraite ? <button type="button" className="btn link" onClick={onTraite}>Marquer comme traité</button> : null}
      </div>
    </div>
  );
}

export default function Communaute() {
  const [e, setE] = useState<Etat | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const charger = (diag = false) => api(undefined, diag).then((d: Etat) => setE((old) => ({ ...d, diagnostic: d.diagnostic ?? old?.diagnostic }))).catch((x: Error) => setError(x.message));
  useEffect(() => { void charger(true); }, []);

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

  const r = e?.rapport?.contenu;
  const gain = r?.abonnes != null && r?.abonnesVeille != null ? r.abonnes - r.abonnesVeille : null;

  return (
    <>
      <TopBar title="VOA · Community manager" back="/" wide />
      <main className="page sub wide" style={{ paddingTop: 4 }}>
        <p className="muted">VOA lit toutes les 15 minutes les commentaires, les messages privés et les mentions de TUVOA ailleurs sur Facebook. Elle répond, vérifie les infos tech douteuses (« Vrai ou faux ? » avec source), aime, masque le spam et les insultes, et te garde les cas sensibles. Chaque soir, elle rédige un rapport.</p>
        {error ? <p className="notice rouge" role="alert">{error}</p> : null}

        {e ? (
          <>
            {e.reglages.crise?.active ? (
              <section className="notice rouge" role="alert" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <strong>Mode crise depuis le {quand(e.reglages.crise.depuis)}</strong>
                <span>{e.reglages.crise.motif}. Les publications automatiques sont suspendues et VOA ne répond plus seule : tout arrive dans « À traiter ».</span>
                <button type="button" className="btn small dark" disabled={!!busy} onClick={() => action("crise", { finCrise: true })}>Lever le mode crise</button>
              </section>
            ) : null}
            <section className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <p className="section-title">Agent actif</p>
                  <p className="muted">Réponses publiées automatiquement, sans validation.</p>
                </div>
                <Switch on={e.reglages.actif} label="Activer l'agent" onClick={() => regler({ actif: !e.reglages.actif })} />
              </div>
              <div className="row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--gris-2)", paddingTop: 10 }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15 }}>Lien de l'article en commentaire</p>
                  <p className="muted">Sous chaque publication, la Page ajoute le lien vers l'article du site, pour attirer du trafic sans pénaliser la portée.</p>
                </div>
                <Switch on={e.reglages.lienArticle} label="Lien de l'article en commentaire" onClick={() => regler({ lienArticle: !e.reglages.lienArticle })} />
              </div>
              {([
                ["radar", "Radar à arnaques", "Quand 3 personnes signalent la même arnaque, VOA rédige une alerte #CyberActu, à valider dans le calendrier."],
                ["grin", "Le grin du jeudi", "Jeudi 19h GMT : une question-débat sur l'actu de la semaine. Vendredi 12h : le meilleur de vos réponses."],
                ["piliers", "Les piliers du grin", "Vendredi 17h GMT : merci public aux membres les plus actifs de la semaine."],
              ] as const).map(([cle, titre, texte]) => (
                <div key={cle} className="row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--gris-2)", paddingTop: 10 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15 }}>{titre}</p>
                    <p className="muted">{texte}</p>
                  </div>
                  <Switch on={e.reglages[cle]} label={titre} onClick={() => regler({ [cle]: !e.reglages[cle] } as Partial<CmReglages>)} />
                </div>
              ))}
              <p className="muted" style={{ borderTop: "1px solid var(--gris-2)", paddingTop: 10 }}>Toujours actifs : réponses aux mentions de TUVOA ailleurs sur Facebook, « Vrai ou faux ? » sourcé sur les infos tech douteuses, et mode crise automatique.</p>
              <div className="btn-row">
                <button type="button" className="btn small primary" disabled={!!busy} onClick={() => action("lancer", { lancer: true })}>{busy === "lancer" ? "Passage en cours…" : "Lancer un passage"}</button>
                <button type="button" className="btn small ghost" disabled={!!busy} onClick={() => action("rapport", { rapport: true })}>{busy === "rapport" ? "Rédaction…" : "Rapport maintenant"}</button>
              </div>
              {log.length ? <ul className="muted" style={{ paddingLeft: 18, fontSize: 13 }}>{log.map((x, i) => <li key={i}>{x}</li>)}</ul> : null}
            </section>

            {e.diagnostic ? (
              <section className="stack">
                <p className="section-title">Accès à la Page</p>
                <div className="card" style={{ gap: 6 }}>
                  {e.diagnostic.map((d) => (
                    <div key={d.id} className="row" style={{ alignItems: "flex-start" }}>
                      <span className={`badge ${d.ok ? "vert" : "rouge"}`}>{d.ok ? "OK" : "Bloqué"}</span>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600 }}>{d.label}</p>
                        {!d.ok ? <p className="muted" style={{ fontSize: 12 }}>{d.detail}</p> : null}
                      </div>
                    </div>
                  ))}
                  {e.diagnostic.some((d) => !d.ok) ? (
                    <p className="notice ambre">Pour tout faire, le jeton de Page (FB_PAGE_TOKEN) doit avoir : pages_show_list, pages_read_engagement, pages_read_user_content, pages_manage_engagement, pages_manage_posts et pages_messaging.</p>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="stack">
              <p className="section-title">À traiter par toi {e.aTraiter.length ? `(${e.aTraiter.length})` : ""}</p>
              {e.aTraiter.length ? e.aTraiter.map((l) => <Ligne key={l.id} l={l} onTraite={() => action("t" + l.id, { traite: l.id })} />) : <p className="muted">Rien à traiter.</p>}
            </section>

            <section className="stack">
              <p className="section-title">Rapport {e.rapport ? `du ${new Date(e.rapport.jour).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : ""}</p>
              {r ? (
                <div className="card">
                  <div className="wrap">
                    {r.abonnes != null ? <span className="badge bleu">{r.abonnes} abonnés{gain != null ? ` (${gain >= 0 ? "+" : ""}${gain})` : ""}</span> : null}
                    {Object.entries(r.activite).map(([k, v]) => <span key={k} className={`badge ${ACTION[k]?.cls ?? ""}`}>{ACTION[k]?.label ?? k} : {v}</span>)}
                  </div>
                  {r.resume ? <p style={{ fontSize: 14, lineHeight: 1.55 }}>{r.resume}</p> : null}
                  {r.meilleuresHeures.length ? <p className="muted"><strong>Meilleures heures de publication :</strong> {r.meilleuresHeures.join(", ")}</p> : null}
                  {[["Questions qui reviennent", r.questions], ["Idées de sujets", r.idees], ["Pour élargir la couverture", r.conseils]].map(([t, l]) =>
                    (l as string[]).length ? (
                      <div key={t as string}>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>{t as string}</p>
                        <ul className="muted" style={{ paddingLeft: 18 }}>{(l as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul>
                      </div>
                    ) : null,
                  )}
                  {r.posts.length ? (
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 14 }}>Publications les plus engageantes</p>
                      <ul className="muted" style={{ paddingLeft: 18 }}>
                        {r.posts.map((p, i) => (
                          <li key={i}>
                            {p.lien ? <a href={p.lien} target="_blank" rel="noopener noreferrer">{p.texte || "Publication"}</a> : p.texte} — {p.reactions} réactions, {p.commentaires} commentaires, {p.partages} partages
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : <p className="muted">Premier rapport ce soir à {e.reglages.heureRapport}h GMT.</p>}
            </section>

            <section className="stack">
              <p className="section-title">Journal</p>
              {e.journal.length ? e.journal.map((l) => (
                <Ligne key={l.id} l={l} onAnnuler={ANNULABLES.includes(l.action) && l.canal !== "message" && Date.now() - new Date(l.created_at).getTime() < e.delaiAnnulation ? () => action("a" + l.id, { annuler: l.id }) : undefined} />
              )) : <p className="muted">Aucune action pour l'instant.</p>}
            </section>
          </>
        ) : !error ? <p className="muted">Chargement…</p> : null}
      </main>
    </>
  );
}
