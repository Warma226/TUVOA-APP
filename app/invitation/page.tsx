"use client";
// Invitation d'un membre : il choisit son mot de passe, puis entre directement dans l'application.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trait } from "@/components/BottomNav";
import Voa from "@/components/Voa";
import { DROITS, ZONE_NOM, type Role, type Zone } from "@/lib/roles";

type Invit = { nom: string; contact: string; role: Role; roleNom: string; expire: string };

export default function InvitationPage() {
  return <Suspense fallback={null}><Invitation /></Suspense>;
}

function force(m: string): number {
  let n = 0;
  if (m.length >= 10) n++;
  if (m.length >= 14) n++;
  if (/[a-zA-Z]/.test(m) && /\d/.test(m)) n++;
  if (/[^a-zA-Z0-9]/.test(m) || (/[a-z]/.test(m) && /[A-Z]/.test(m))) n++;
  return n;
}

function Invitation() {
  const t = useSearchParams().get("t") ?? "";
  const [inv, setInv] = useState<Invit | null>(null);
  const [erreurLien, setErreurLien] = useState("");
  const [mdp, setMdp] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/invitation?t=${encodeURIComponent(t)}`).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErreurLien(d.error || "Lien invalide."); else setInv(d as Invit);
    }).catch(() => setErreurLien("Connexion impossible. Réessayez."));
  }, [t]);
  const f = force(mdp);
  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (mdp !== mdp2) return setError("Les deux mots de passe ne sont pas identiques.");
    setBusy(true); setError("");
    const r = await fetch("/api/invitation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t, password: mdp }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || "Impossible d'activer le compte."); setBusy(false); return; }
    window.location.href = "/";
  }
  const prenom = inv?.nom.split(/\s+/)[0] ?? "";
  const zones = inv ? (Object.keys(DROITS[inv.role]) as Zone[]).filter((z) => DROITS[inv.role][z] !== "-") : [];

  return (
    <div className="login tv-acces">
      <span className="fond" aria-hidden="true" />
      <span className="voile" aria-hidden="true" />
      <div className="scene" style={{ justifyContent: "center" }}>
        <section className="gauche">
          {inv ? (
            <>
              <span className="badge" style={{ alignSelf: "flex-start" }}><Trait d="M22 2L11 13M22 2l-7 20-4-9-9-4z" size={14} stroke={2.2} />Invitation personnelle · valable jusqu&apos;au {new Date(inv.expire).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</span>
              <h1>Bienvenue dans l&apos;équipe, <span>{prenom}.</span></h1>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "#D6E0FF" }}>L&apos;administration de TUVOA vous a ajouté(e) comme <strong style={{ color: "#fff" }}>{inv.roleNom.toLowerCase()}</strong>. Choisissez votre mot de passe : vous publiez directement, selon votre rôle.</p>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>{zones.map((z) => <span key={z} className="badge" style={{ color: "#fff" }}><Trait d="M20 6L9 17l-5-5" size={13} stroke={2.6} />{ZONE_NOM[z]}{DROITS[inv.role][z] === "l" ? " (lecture)" : ""}</span>)}</div>
            </>
          ) : <h1>{erreurLien ? "Ce lien ne fonctionne plus." : "Un instant…"}</h1>}
          {erreurLien ? <p style={{ margin: 0, color: "#D6E0FF" }}>{erreurLien}</p> : null}
        </section>
        {inv ? (
          <main className="droite">
            <div className="carte-wrap">
              <span style={{ position: "absolute", right: -28, top: -54, width: 80, zIndex: 2 }} aria-hidden="true"><Voa humeur="fete" taille={80} decor /></span>
              <form className="carte" onSubmit={valider} noValidate>
                <div className="row" style={{ gap: 12 }}>
                  <span style={{ width: 48, height: 48, borderRadius: 24, background: "#2563EB", color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{inv.nom.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase()}</span>
                  <span style={{ display: "flex", flexDirection: "column" }}><strong>{inv.nom}</strong><small style={{ color: "#5B6B86" }}>{inv.contact} · {inv.roleNom}</small></span>
                </div>
                <label className="field">Choisissez un mot de passe
                  <input type="password" autoComplete="new-password" value={mdp} onChange={(e) => setMdp(e.target.value)} style={{ height: 52, borderRadius: 14 }} />
                </label>
                <div className="row" style={{ gap: 4 }}>{[0, 1, 2, 3].map((i) => <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < f ? (f >= 3 ? "#16A34A" : "#F59E0B") : "#E3E9F3" }} />)}</div>
                <small style={{ marginTop: -10, color: f >= 3 ? "#05603A" : "#5B6B86", fontWeight: 700 }}>{mdp ? (f >= 3 ? "Solide" : "10 caractères au moins, lettres et chiffres") : "10 caractères au moins, lettres et chiffres"}</small>
                <label className="field">Confirmez-le
                  <input type="password" autoComplete="new-password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} style={{ height: 52, borderRadius: 14 }} />
                </label>
                {error ? <p className="notice rouge" role="alert">{error}</p> : null}
                <button type="submit" className="go" disabled={busy}>{busy ? "Activation…" : <>Rejoindre l&apos;équipe <Trait d="M5 12h14M13 6l6 6-6 6" size={18} stroke={2.4} /></>}</button>
                <p className="note"><span>Ce lien ne sert qu&apos;une fois. Ensuite, connectez-vous avec <strong>{inv.contact}</strong> et ce mot de passe, onglet « Membre de l&apos;équipe ».</span></p>
              </form>
            </div>
          </main>
        ) : null}
      </div>
    </div>
  );
}
