"use client";
import { useEffect, useState } from "react";
import { BottomNav, TopBar } from "@/components/BottomNav";
import { PLATFORMS, type Platform } from "@/lib/config";

type Conn = Record<Platform, { configured: boolean; detail: string }>;
type Info = { connections: Conn; demo: boolean; ai: boolean };

const HELP: Record<Platform, string> = {
  wordpress: "Dans WordPress : Profil › Mots de passe d'application › créer « TUVOA ». Puis renseigne WP_URL, WP_USER et WP_APP_PASSWORD dans Vercel.",
  facebook: "Crée une application sur developers.facebook.com, relie ta Page, puis renseigne FB_PAGE_ID et FB_PAGE_TOKEN dans Vercel.",
  linkedin: "Crée une application sur developer.linkedin.com reliée à ta Page entreprise, puis renseigne LINKEDIN_TOKEN et LINKEDIN_AUTHOR.",
  tiktok: "Demande l'accès « Content Posting » sur developers.tiktok.com. La publication sera branchée après la validation par TikTok.",
};

export default function Connexions() {
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setInfo);
  }, []);

  return (
    <>
      <TopBar title="Connexions" />
      <main className="page" style={{ paddingTop: 4 }}>
        <p className="muted">Les comptes se relient avec des clés à ajouter dans Vercel (Settings › Environment Variables). Le guide complet est dans le README du dépôt GitHub.</p>

        <article className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <p style={{ fontWeight: 600 }}>IA (rédaction)</p>
            <span className={`badge ${info?.ai ? "vert" : "ambre"}`}>{info ? (info.ai ? "Active" : "À configurer") : "…"}</span>
          </div>
          <p className="small" style={{ color: "var(--texte-3)", lineHeight: 1.5 }}>Clé ANTHROPIC_API_KEY, créée sur console.anthropic.com.</p>
        </article>

        <article className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <p style={{ fontWeight: 600 }}>Base de données</p>
            <span className={`badge ${info && !info.demo ? "vert" : "ambre"}`}>{info ? (info.demo ? "Mode démo" : "Supabase connecté") : "…"}</span>
          </div>
          <p className="small" style={{ color: "var(--texte-3)", lineHeight: 1.5 }}>SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY. Sans elles, les posts ne sont pas conservés.</p>
        </article>

        {PLATFORMS.map((p) => {
          const c = info?.connections[p.id];
          return (
            <article key={p.id} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 600 }}>{p.label}</p>
                  <p className="muted small">{c ? (c.configured ? `Connecté · ${c.detail}` : "Non connecté") : "…"}</p>
                </div>
                <span className={`badge ${c?.configured ? "vert" : ""}`}>{c?.configured ? "Prêt" : "À relier"}</span>
              </div>
              {!c?.configured ? <p className="small" style={{ color: "var(--texte-3)", lineHeight: 1.5 }}>{HELP[p.id]}</p> : null}
            </article>
          );
        })}
      </main>
      <BottomNav />
    </>
  );
}
