/* eslint-disable @next/next/no-img-element */
// Gabarit du visuel #ActuTech (rendu en PNG par next/og). Police : Archivo.
// Règle du moteur de rendu : tout bloc qui contient plusieurs enfants doit être en display: flex.

export { FORMATS, type VisualFormat } from "./formats";
import { FORMATS, type VisualFormat } from "./formats";

export type VisualData = {
  rubrique: "actu" | "cyberbase" | "portrait" | "citation";
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

// L'Actualité et la Citation ont un gabarit : #CyberBase et #Portrait utilisent tes propres visuels.
export function renderVisual(d: VisualData, format: VisualFormat) {
  const { w, h } = FORMATS[format];
  return d.rubrique === "citation" ? citation(d, w, h) : actu(d, w, h);
}

// Découpe « texte **mis en avant** texte » en mots, chacun marqué s'il est entre ** (affiché en bleu).
function motsCitation(texte: string): { mot: string; fort: boolean }[] {
  const out: { mot: string; fort: boolean }[] = [];
  texte
    .replace(/^[\s«“"]+|[\s»”"]+$/g, "")
    .split("**")
    .forEach((part, i) => {
      for (const mot of part.split(/\s+/)) if (mot) out.push({ mot, fort: i % 2 === 1 });
    });
  return out;
}

// ─── #Citation : logo carré en haut à gauche, photo en haut fondue dans le noir, citation blanche
// entre guillemets, filet, carré bleu devant l'auteur, bande bleue en pied ───
function citation(d: VisualData, w: number, h: number) {
  const st = stage(w, h);
  const s = st.s;
  const texte = fit(d.texte || "La citation", 300);
  const mots = motsCitation(texte);
  const size = autoSize(texte.replace(/\*\*/g, ""), [[90, 54], [150, 50], [210, 46], [260, 42], [999, 38]]);
  return (
    <div style={{ width: w, height: h, display: "flex", position: "relative", background: "#000000", fontFamily: "Montserrat" }}>
      {d.photo ? <img src={d.photo} alt="" width={w} height={h * 0.72} style={{ position: "absolute", left: 0, top: 0, width: w, height: h * 0.72, objectFit: "cover" }} /> : null}
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.75) 50%, #000000 62%)" }} />
      <div style={at(st, 50, 50, { width: 100 * s, height: 100 * s, alignItems: "center", justifyContent: "center", background: BLEU })}>
        <LogoMark size={20 * s} color="#FFFFFF" dot="#FFFFFF" />
      </div>
      <div style={at(st, 50, 480, { width: 980 * s, height: 690 * s, flexDirection: "column", justifyContent: "flex-end" })}>
        <div style={{ display: "flex", height: 92 * s, fontSize: 190 * s, fontWeight: 800, color: "#FFFFFF", lineHeight: 1 }}>“</div>
        <div style={{ display: "flex", flexWrap: "wrap", width: 960 * s, fontSize: size * s, fontWeight: 500, color: "#FFFFFF", lineHeight: 1.2 }}>
          {mots.map((m, i) => (
            <span key={i} style={{ marginRight: size * 0.26 * s, color: m.fort ? "#6E9BFF" : "#FFFFFF" }}>{m.mot}</span>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", marginTop: 34 * s }}>
          <div style={{ display: "flex", width: 700 * s, height: 3 * s, background: "#FFFFFF", marginTop: 14 * s }} />
          <div style={{ display: "flex", height: 60 * s, fontSize: 130 * s, fontWeight: 800, color: "#FFFFFF", lineHeight: 0.8, marginLeft: 34 * s }}>”</div>
        </div>
      </div>
      <div style={at(st, 50, 1198, { width: 540 * s, alignItems: "flex-start" })}>
        <div style={{ display: "flex", width: 24 * s, height: 24 * s, background: BLEU, marginTop: 8 * s, marginRight: 30 * s }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 30 * s, fontWeight: 800, color: "#FFFFFF" }}>{`${fit(d.nom || d.titre || "Auteur", 28)},`}</div>
          {d.specialite ? <div style={{ display: "flex", fontSize: 30 * s, fontWeight: 800, color: "#FFFFFF", marginTop: 2 * s }}>{fit(d.specialite, 34)}</div> : null}
        </div>
      </div>
      <div style={at(st, 600, 1200, { width: 430 * s, flexDirection: "column", alignItems: "flex-end" })}>
        {d.source ? <div style={{ display: "flex", fontSize: 22 * s, fontWeight: 600, color: "#8C96AA" }}>{`Source : ${fit(d.source, 30)}`}</div> : null}
        <div style={{ display: "flex", fontSize: 30 * s, fontWeight: 800, color: "#6E9BFF", marginTop: 8 * s }}>www.tuvoa.media</div>
      </div>
      <div style={{ position: "absolute", left: 0, top: h - 18 * s, width: w, height: 18 * s, display: "flex", background: BLEU }} />
    </div>
  );
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
