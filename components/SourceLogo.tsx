"use client";
// Logo officiel d'un média source (récupéré sur son site par /api/logo), avec les initiales en secours.
import { useState } from "react";

export function domaineDe(domain?: string | null, url?: string | null): string {
  const brut = domain || (() => {
    try { return url ? new URL(url).hostname : ""; } catch { return ""; }
  })();
  return brut.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
}

export const initiales = (s: string) =>
  s.split(/[\s’'·.-]+/).filter((w) => /^[A-Za-zÀ-ÿ0-9]/.test(w)).slice(0, 3).map((w) => w[0].toUpperCase()).join("") || "?";

export function SourceLogo({ name, domain, url, size = 40, radius, couleur = "#2563EB", label = false }: {
  name: string; domain?: string | null; url?: string | null; size?: number; radius?: number; couleur?: string; label?: boolean;
}) {
  const d = domaineDe(domain, url);
  const [rate, setRate] = useState(!d);
  const r = radius ?? Math.round(size * 0.28);
  const commun: React.CSSProperties = { width: size, height: size, borderRadius: r, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden" };
  const a11y = label ? { role: "img" as const, "aria-label": name, title: name } : { "aria-hidden": true as const, title: name };
  if (rate) {
    return (
      <span {...a11y} style={{ ...commun, background: `linear-gradient(145deg, ${couleur}, #0A2A66)`, color: "#fff", fontFamily: "var(--font-mont), sans-serif", fontWeight: 800, fontSize: Math.max(9, Math.round(size * 0.28)) }}>
        {initiales(name)}
      </span>
    );
  }
  return (
    <span {...a11y} style={{ ...commun, background: "#fff", border: "1px solid #E3E9F3", boxSizing: "border-box" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/logo?d=${encodeURIComponent(d)}`} alt="" width={size} height={size} loading="lazy" onError={() => setRate(true)}
        style={{ width: "78%", height: "78%", objectFit: "contain", display: "block" }} />
    </span>
  );
}
