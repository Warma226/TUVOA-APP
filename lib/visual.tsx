/* eslint-disable @next/next/no-img-element */
// Gabarits des visuels générés (rendus en PNG par next/og). Police : Archivo.
// Règle du moteur de rendu : tout bloc qui contient plusieurs enfants doit être en display: flex.

export type VisualFormat = "portrait" | "carre" | "paysage" | "vertical";
export const FORMATS: Record<VisualFormat, { w: number; h: number; label: string }> = {
  portrait: { w: 1080, h: 1350, label: "4:5 · 1080 × 1350" },
  carre: { w: 1080, h: 1080, label: "Carré · 1080 × 1080" },
  paysage: { w: 1200, h: 630, label: "Paysage · 1200 × 630" },
  vertical: { w: 1080, h: 1920, label: "Vertical · 1080 × 1920" },
};

export type VisualData = {
  rubrique: "actu" | "cyberbase" | "portrait";
  titre: string;
  texte: string;
  nom?: string;
  specialite?: string;
  photo?: string;
  source?: string;
};

const BLEU = "#2563EB";
const ORANGE = "#E94A06";
const NAVY = "#0B1633";

function Lambda({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size * 0.72} height={size * 0.74} viewBox="0 0 72 74">
      <path d="M4 72 L36 4 L68 72" fill="none" stroke={color} strokeWidth={14} strokeLinejoin="miter" />
    </svg>
  );
}

export function LogoMark({ size, color, dot = BLEU }: { size: number; color: string; dot?: string }) {
  const logoUrl = process.env.LOGO_URL;
  if (logoUrl) {
    return <img src={logoUrl} alt="" height={size * 1.6} style={{ height: size * 1.6, objectFit: "contain" }} />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div style={{ display: "flex", alignItems: "center", fontSize: size, fontWeight: 800, color, lineHeight: 1 }}>
        <span>TUV</span>
        <div style={{ width: size * 0.74, height: size * 0.74, borderRadius: size, background: dot, margin: `0 ${size * 0.04}px` }} />
        <Lambda size={size} color={color} />
      </div>
      <div style={{ display: "flex", fontSize: size * 0.42, fontWeight: 300, color, letterSpacing: size * 0.05, marginTop: size * 0.08, paddingLeft: size * 0.5 }}>
        TECH MEDIA
      </div>
    </div>
  );
}

function fit(text: string, max: number) {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

export function renderVisual(d: VisualData, format: VisualFormat) {
  const { w, h } = FORMATS[format];
  const s = Math.min(w, h * 0.8) / 1080; // échelle
  if (d.rubrique === "cyberbase") return cyberbase(d, w, h, s);
  if (d.rubrique === "portrait") return portrait(d, w, h, s);
  return actu(d, w, h, s);
}

function cyberbase(d: VisualData, w: number, h: number, s: number) {
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", background: "#F2EFE8", padding: 70 * s, fontFamily: "Archivo" }}>
      <div style={{ display: "flex", alignItems: "center", color: "#0A0A0A" }}>
        <span style={{ fontSize: 46 * s, fontWeight: 800 }}>#CyberBase</span>
        <div style={{ width: 4 * s, height: 64 * s, background: "#0A0A0A", margin: `0 ${18 * s}px` }} />
        <div style={{ display: "flex", flexDirection: "column", fontSize: 30 * s, fontWeight: 300, lineHeight: 1.1 }}>
          <span>Comprendre les notions</span>
          <span>basiques de la tech</span>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          marginTop: 50 * s,
          background: BLEU,
          borderTop: `${10 * s}px solid ${ORANGE}`,
          borderLeft: `${10 * s}px solid ${ORANGE}`,
          borderRadius: `${70 * s}px ${110 * s}px ${110 * s}px ${40 * s}px`,
          padding: `${70 * s}px ${80 * s}px`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", fontSize: 88 * s, fontWeight: 300, color: "#FFFFFF", textAlign: "center", lineHeight: 1.05 }}>
          {fit(d.titre || "Notion", 40)}
        </div>
        <div style={{ display: "flex", marginTop: 60 * s, fontSize: 50 * s, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.18 }}>
          {fit(d.texte, 320)}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 40 * s }}>
        <div style={{ display: "flex", background: BLEU, borderRadius: `${70 * s}px ${30 * s}px ${50 * s}px ${50 * s}px`, padding: `${28 * s}px ${30 * s}px` }}>
          <LogoMark size={52 * s} color="#FFFFFF" dot="#FFFFFF" />
        </div>
        <span style={{ fontSize: 52 * s, fontWeight: 800, color: BLEU }}>www.tuvoa.media</span>
      </div>
    </div>
  );
}

function portrait(d: VisualData, w: number, h: number, s: number) {
  const frameW = 620 * s;
  const frameH = 760 * s;
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", background: NAVY, position: "relative", fontFamily: "Archivo" }}>
      <div style={{ position: "absolute", left: w / 2 - 520 * s, top: h / 2 - 560 * s, width: 1040 * s, height: 1040 * s, borderRadius: 1040 * s, background: "#132A66", display: "flex" }} />
      <div
        style={{
          position: "absolute",
          left: (w - frameW) / 2,
          top: h * 0.2,
          width: frameW,
          height: frameH,
          display: "flex",
          borderTop: `${14 * s}px solid ${BLEU}`,
          borderRight: `${14 * s}px solid ${BLEU}`,
          borderRadius: `${120 * s}px ${220 * s}px ${36 * s}px ${36 * s}px`,
          overflow: "hidden",
          background: "#1E2C55",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {d.photo ? (
          <img src={d.photo} alt="" width={frameW} height={frameH} style={{ width: frameW, height: frameH, objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 34 * s, color: "#8FA8E8" }}>Photo fournie par l'expert</span>
        )}
      </div>
      <div style={{ position: "absolute", right: 130 * s, top: h * 0.17, display: "flex", flexDirection: "column", alignItems: "center", background: "#FFFFFF", borderRadius: `${40 * s}px ${70 * s}px ${70 * s}px ${70 * s}px`, padding: `${36 * s}px ${30 * s}px` }}>
        <span style={{ fontSize: 58 * s, fontWeight: 800, color: BLEU, lineHeight: 1 }}>PORTRAIT</span>
        <span style={{ fontSize: 32 * s, fontWeight: 800, color: BLEU, marginTop: 6 * s }}>EXPERTS TECH</span>
      </div>
      <div style={{ position: "absolute", left: 150 * s, top: h * 0.2 + frameH - 150 * s, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div style={{ display: "flex", background: "#FFFFFF", padding: `${10 * s}px ${24 * s}px`, fontSize: 66 * s, fontWeight: 800, color: BLEU }}>
          {fit(d.nom || d.titre || "Nom de l'expert", 26)}
        </div>
        <div style={{ display: "flex", maxWidth: 760 * s, background: "rgba(11,22,51,0.85)", padding: `${10 * s}px ${14 * s}px`, marginTop: 14 * s, fontSize: 40 * s, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.2 }}>
          {fit(d.specialite || d.texte || "", 90)}
        </div>
      </div>
      <div style={{ position: "absolute", left: 70 * s, bottom: 70 * s, display: "flex" }}>
        <LogoMark size={44 * s} color="#FFFFFF" />
      </div>
      <span style={{ position: "absolute", right: 110 * s, bottom: 80 * s, fontSize: 54 * s, fontWeight: 800, color: "#FFFFFF" }}>www.tuvoa.media</span>
    </div>
  );
}

function actu(d: VisualData, w: number, h: number, s: number) {
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0A0A0A", padding: 80 * s, fontFamily: "Archivo" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 44 * s, fontWeight: 800, color: "#FFFFFF" }}>#ActuTech</span>
        <LogoMark size={46 * s} color="#FFFFFF" />
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 92 * s, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.05 }}>{fit(d.titre || "Titre", 90)}</div>
        <div style={{ display: "flex", width: 140 * s, height: 14 * s, borderRadius: 8 * s, background: BLEU, marginTop: 40 * s }} />
        {d.texte ? (
          <div style={{ display: "flex", marginTop: 40 * s, fontSize: 42 * s, fontWeight: 300, color: "#E5E7EB", lineHeight: 1.3 }}>{fit(d.texte, 220)}</div>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 32 * s, fontWeight: 300, color: "#C9CCD3" }}>{d.source ? `Source : ${fit(d.source, 40)}` : " "}</span>
        <span style={{ fontSize: 44 * s, fontWeight: 800, color: "#FFFFFF" }}>www.tuvoa.media</span>
      </div>
    </div>
  );
}
