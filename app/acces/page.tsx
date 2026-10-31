"use client";
// Écran de connexion : le mot de passe administrateur (APP_PASSWORD) ouvre l'app pour 30 jours sur cet appareil.
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Icon, type IconName } from "@/components/Icon";
import { safeNext } from "@/lib/session";

const ATOUTS: { icon: IconName; titre: string; texte: string }[] = [
  { icon: "veille", titre: "Veille tech", texte: "Les actus de tes sources, triées par thème." },
  { icon: "creer", titre: "Rédaction assistée", texte: "Un brouillon par plateforme, dans le ton TUVOA." },
  { icon: "calendrier", titre: "Publication planifiée", texte: "WordPress, Facebook et LinkedIn, à l'heure choisie." },
];

export default function AccesPage() {
  return (
    <Suspense fallback={null}>
      <Acces />
    </Suspense>
  );
}

function Acces() {
  const q = useSearchParams();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return setError("Entre le mot de passe.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || `Connexion impossible (${res.status}).`);
      window.location.href = safeNext(q.get("next"));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <aside className="login-brand" aria-hidden="true">
        <Logo size={30} color="#ffffff" dot="#2563eb" />
        <div className="login-brand-body">
          <p className="login-kicker" style={{ color: "#9db8ff" }}>TUVOA STUDIO</p>
          <p className="login-headline">Veille, rédaction et publication. Au même endroit.</p>
          <ul>
            {ATOUTS.map((a) => (
              <li key={a.titre}>
                <span className="login-ico"><Icon name={a.icon} size={20} /></span>
                <span>
                  <strong>{a.titre}</strong>
                  <span>{a.texte}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="login-site">www.tuvoa.media</p>
      </aside>

      <main className="login-main">
        <div className="login-card">
          <div className="login-logo-mobile">
            <Logo size={30} />
          </div>
          <div>
            <p className="login-kicker">ESPACE ADMINISTRATEUR</p>
            <h1 style={{ marginTop: 6 }}>Ton studio de posts tech</h1>
            <p className="muted" style={{ marginTop: 8 }}>Entre le mot de passe pour ouvrir TUVOA Studio.</p>
          </div>

          <form onSubmit={submit} className="stack" style={{ gap: 14 }} noValidate>
            <input type="text" name="username" autoComplete="username" value="tuvoa" readOnly hidden />
            <label className="field" htmlFor="password">
              Mot de passe
              <span className="login-pass">
                <input
                  id="password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "login-error" : undefined}
                />
                <button type="button" className="login-eye" onClick={() => setShow(!show)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={show}>
                  <Icon name={show ? "oeilBarre" : "oeil"} size={20} />
                </button>
              </span>
            </label>
            {error ? (
              <p id="login-error" className="notice rouge" role="alert">{error}</p>
            ) : null}
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <p className="muted small" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="cadenas" size={16} /></span>
            <span>Accès réservé à l'équipe TUVOA Tech Media. Tu restes connecté 30 jours sur cet appareil.</span>
          </p>
        </div>
      </main>
    </div>
  );
}
