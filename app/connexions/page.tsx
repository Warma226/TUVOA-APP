"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
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
    "Crée une application sur developer.linkedin.com reliée à ta Page entreprise.",
    "Demande l'accès à la publication pour les organisations.",
    "Dans Vercel : LINKEDIN_TOKEN et LINKEDIN_AUTHOR (urn:li:organization:…), puis redéploie. Le jeton expire : pense à le renouveler.",
  ],
  tiktok: [
    "Demande l'accès « Content Posting API » sur developers.tiktok.com.",
    "La publication sera branchée une fois l'application validée par TikTok.",
  ],
};

export default function Connexions() {
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getInfo()
      .then(setInfo)
      .catch((e: Error) => setError(e.message));
  }, []);

  const services = [
    {
      id: "ia",
      nom: "IA (rédaction)",
      ok: Boolean(info?.ai),
      detail: info?.ai ? (info.aiProvider === "gemini" ? "Active · Google Gemini (gratuit)" : "Active · Claude") : "Non configurée",
      help: [
        "Gratuit : crée une clé sur aistudio.google.com (Get API key), puis ajoute GEMINI_API_KEY dans Vercel et redéploie.",
        "Ou payant à l'usage : clé Claude sur platform.claude.com, à ajouter comme ANTHROPIC_API_KEY.",
      ],
    },
    {
      id: "db",
      nom: "Base de données",
      ok: Boolean(info && !info.demo),
      detail: info?.demo ? "Mode démo : posts gardés sur ce téléphone" : "Supabase connecté",
      help: ["Crée un projet sur supabase.com et lance supabase/schema.sql dans SQL Editor.", "Dans Vercel : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY, puis redéploie."],
    },
  ];

  return (
    <>
      <header className="topbar" style={{ paddingTop: 20 }}>
        <h1>Connexions</h1>
      </header>
      <main className="page" style={{ paddingTop: 4 }}>
        <p className="muted">Relie tes comptes pour que TUVOA publie à ta place, après ta validation.</p>
        {error ? <p className="notice rouge" role="alert">{error}</p> : null}

        {PLATFORMS.map((p) => {
          const c = info?.connections[p.id];
          const isOpen = open === p.id;
          return (
            <article key={p.id} className="card" style={{ padding: 14 }}>
              <div className="row">
                <span className="plat-icon" aria-hidden="true">{LETTRE[p.id]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 16 }}>{p.label}</p>
                  <p className="small" style={{ fontSize: 13, color: c?.configured ? "var(--vert)" : "var(--texte-2)" }}>
                    {c ? (c.configured ? `Connecté · ${c.detail}` : "Non connecté") : "…"}
                  </p>
                </div>
                <button
                  type="button"
                  className={`btn small ${c?.configured ? "" : "primary"}`}
                  style={c?.configured ? { borderColor: "var(--gris-3)" } : undefined}
                  aria-expanded={isOpen}
                  aria-controls={`aide-${p.id}`}
                  onClick={() => setOpen(isOpen ? null : p.id)}
                >
                  {c?.configured ? "Gérer" : "Connecter"}
                </button>
              </div>
              {isOpen ? (
                <ol id={`aide-${p.id}`} className="small" style={{ margin: "4px 0 0", paddingLeft: 20, lineHeight: 1.6, color: "var(--texte-3)" }}>
                  {c?.configured ? <li>Pour changer de compte, remplace les variables dans Vercel puis redéploie.</li> : HELP[p.id].map((h) => <li key={h}>{h}</li>)}
                </ol>
              ) : null}
            </article>
          );
        })}

        <p className="notice row" style={{ alignItems: "flex-start" }}>
          <Icon name="info" size={18} />
          <span>TikTok demande une validation de l'application avant toute publication automatique. Compte quelques jours.</span>
        </p>

        <h2 className="section-title" style={{ marginTop: 6 }}>Services</h2>
        {services.map((sv) => (
          <article key={sv.id} className="card" style={{ padding: 14 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 600 }}>{sv.nom}</p>
                <p className="small" style={{ fontSize: 13, color: sv.ok ? "var(--vert)" : "var(--ambre)" }}>{info ? sv.detail : "…"}</p>
              </div>
              {info && !sv.ok ? (
                <button type="button" className="btn small ghost" aria-expanded={open === sv.id} onClick={() => setOpen(open === sv.id ? null : sv.id)}>
                  Configurer
                </button>
              ) : null}
            </div>
            {open === sv.id ? (
              <ol className="small" style={{ margin: "4px 0 0", paddingLeft: 20, lineHeight: 1.6, color: "var(--texte-3)" }}>
                {sv.help.map((h) => <li key={h}>{h}</li>)}
              </ol>
            ) : null}
          </article>
        ))}
        <button
          type="button"
          className="btn ghost"
          style={{ marginTop: 8 }}
          onClick={async () => {
            await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
            window.location.href = "/acces";
          }}
        >
          <Icon name="sortie" size={18} />
          Se déconnecter
        </button>
      </main>
    </>
  );
}
