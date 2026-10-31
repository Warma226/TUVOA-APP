/* eslint-disable @next/next/no-img-element */
// Gabarit du visuel #ActuTech (rendu en PNG par next/og). Police : Archivo.
// Règle du moteur de rendu : tout bloc qui contient plusieurs enfants doit être en display: flex.

export { FORMATS, type VisualFormat } from "./formats";
import { FORMATS, type VisualFormat } from "./formats";

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

// Taille de texte qui diminue quand le texte s'allonge.
function autoSize(text: string, steps: [number, number][]): number {
  for (const [maxLen, size] of steps) if (text.length <= maxLen) return size;
  return steps[steps.length - 1][1];
}

// Les gabarits sont dessinés pour du 4:5 (1080 × 1350, comme les maquettes TUVOA).
// Pour les autres formats, le fond remplit tout et la composition 4:5 est centrée.
type Stage = { s: number; ox: number; oy: number };
function stage(w: number, h: number): Stage {
  const s = Math.min(w / 1080, h / 1350);
  return { s, ox: (w - 1080 * s) / 2, oy: (h - 1350 * s) / 2 };
}
function at(st: Stage, x: number, y: number, extra: Record<string, unknown> = {}) {
  return { position: "absolute" as const, left: st.ox + x * st.s, top: st.oy + y * st.s, display: "flex", ...extra };
}

// Seule l'Actualité a un gabarit : #CyberBase et #Portrait utilisent tes propres visuels.
export function renderVisual(d: VisualData, format: VisualFormat) {
  const { w, h } = FORMATS[format];
  return actu(d, w, h);
}

// ─── #ActuTech : photo plein cadre, bandeau catégorie bleu, texte blanc ───
function actu(d: VisualData, w: number, h: number) {
  const st = stage(w, h);
  const s = st.s;
  // titre court = catégorie du bandeau (« Cybersécurité ») ; texte = l'info.
  const court = (d.titre || "").length <= 26;
  const categorie = d.texte && court ? d.titre : "Actu tech";
  const info = fit(d.texte || d.titre || "Titre de l'actu", 230);
  const size = autoSize(info, [[90, 54], [150, 48], [200, 44], [999, 40]]);
  return (
    <div style={{ width: w, height: h, display: "flex", position: "relative", backgroundImage: "linear-gradient(160deg, #1D3A7A 0%, #0B1633 55%, #000000 100%)", fontFamily: "Archivo" }}>
      {d.photo ? <img src={d.photo} alt="" width={w} height={h} style={{ position: "absolute", left: 0, top: 0, width: w, height: h, objectFit: "cover" }} /> : null}
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 46%, rgba(0,0,0,0.82) 66%, #000000 84%)" }} />
      <div style={at(st, 838, 30, { width: 194 * s, height: 194 * s, alignItems: "center", justifyContent: "center", background: "#FFFFFF", borderRadius: `0 0 0 ${100 * s}px` })}>
        <LogoMark size={42 * s} color="#333333" />
      </div>
      <div style={at(st, 100, 793, { minWidth: 480 * s, height: 72 * s, alignItems: "center", padding: `0 ${40 * s}px 0 ${36 * s}px`, background: BLEU, fontSize: 42 * s, fontWeight: 800, color: "#FFFFFF" })}>
        {fit(categorie, 26)}
      </div>
      <div style={at(st, 102, 900, { width: 930 * s, fontSize: size * s, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.3 })}>{info}</div>
      <div style={at(st, 600, 1238, { width: 415 * s, justifyContent: "flex-end", fontSize: 46 * s, fontWeight: 800, color: "#FFFFFF" })}>www.tuvoa.media</div>
    </div>
  );
}
