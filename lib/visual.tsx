/* eslint-disable @next/next/no-img-element */
// Gabarits des visuels générés (rendus en PNG par next/og). Police : Archivo.
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

export function renderVisual(d: VisualData, format: VisualFormat) {
  const { w, h } = FORMATS[format];
  if (d.rubrique === "cyberbase") return cyberbase(d, w, h);
  if (d.rubrique === "portrait") return portrait(d, w, h);
  return actu(d, w, h);
}

// Fond facultatif (texture de carte, tunnel…) : une image en ligne indiquée dans Vercel.
function fond(url: string | undefined, w: number, h: number, opacity = 1) {
  if (!url) return null;
  return <img src={url} alt="" width={w} height={h} style={{ position: "absolute", left: 0, top: 0, width: w, height: h, objectFit: "cover", opacity }} />;
}

// ─── #CyberBase : carte bleue à liseré orange sur fond clair ─────────────
function cyberbase(d: VisualData, w: number, h: number) {
  const st = stage(w, h);
  const s = st.s;
  const texte = fit(d.texte || "", 340);
  const paras = texte.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const size = autoSize(texte, [[160, 54], [240, 50], [300, 46], [999, 42]]);
  return (
    <div style={{ width: w, height: h, display: "flex", position: "relative", background: "#F3F1EC", fontFamily: "Archivo" }}>
      {fond(process.env.VISUEL_FOND_CYBERBASE, w, h, 0.35)}
      <div style={at(st, 50, 62, { alignItems: "center", color: "#0A0A0A" })}>
        <span style={{ fontSize: 40 * s, fontWeight: 800 }}>#CyberBase</span>
        <div style={{ width: 3 * s, height: 44 * s, background: "#0A0A0A", margin: `0 ${12 * s}px` }} />
        <div style={{ display: "flex", flexDirection: "column", fontSize: 25 * s, fontWeight: 300, lineHeight: 1.05 }}>
          <span>Comprendre les notions</span>
          <span>basiques de la tech</span>
        </div>
      </div>
      {/* liseré orange, visible en haut et à gauche */}
      <div style={at(st, 72, 178, { width: 940 * s, height: 990 * s, borderRadius: `${150 * s}px ${150 * s}px ${110 * s}px ${260 * s}px`, backgroundImage: "linear-gradient(180deg, #F04A0C 0%, #D9230F 45%, #5A0C0C 100%)" })} />
      <div
        style={at(st, 82, 188, {
          width: 940 * s,
          height: 990 * s,
          flexDirection: "column",
          borderRadius: `${150 * s}px ${150 * s}px ${110 * s}px ${260 * s}px`,
          backgroundImage: "linear-gradient(180deg, #4163CC 0%, #3C6FD9 62%, #2A58D4 100%)",
          padding: `${62 * s}px ${70 * s}px 0 ${110 * s}px`,
        })}
      >
        <div style={{ display: "flex", justifyContent: "center", fontSize: autoSize(d.titre || "", [[18, 82], [26, 66], [999, 54]]) * s, fontWeight: 300, color: "#FFFFFF", textAlign: "center", lineHeight: 1.1 }}>
          {fit(d.titre || "Notion", 40)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 48 * s }}>
          {(paras.length ? paras : [""]).map((p, i) => (
            <div key={i} style={{ display: "flex", marginTop: i ? 34 * s : 0, fontSize: size * s, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.32 }}>
              {p}
            </div>
          ))}
        </div>
      </div>
      <div style={at(st, 36, 1008, { width: 196 * s, height: 200 * s, alignItems: "flex-end", justifyContent: "center", paddingBottom: 40 * s, background: "#2563EB", borderRadius: `${110 * s}px ${80 * s}px ${60 * s}px ${60 * s}px` })}>
        <LogoMark size={46 * s} color="#FFFFFF" dot="#FFFFFF" />
      </div>
      <div style={at(st, 600, 1222, { width: 410 * s, justifyContent: "flex-end", fontSize: 46 * s, fontWeight: 800, color: BLEU })}>www.tuvoa.media</div>
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

// ─── #Portrait : photo dans un cadre arrondi, étiquette PORTRAIT, nom et spécialité ───
function portrait(d: VisualData, w: number, h: number) {
  const st = stage(w, h);
  const s = st.s;
  const radius = `${80 * s}px ${270 * s}px ${40 * s}px 0`;
  const spec = fit(d.specialite || d.texte || "Spécialité de l'expert", 90);
  return (
    <div style={{ width: w, height: h, display: "flex", position: "relative", backgroundImage: "radial-gradient(circle at 50% 48%, #3E66CF 0%, #1D3880 32%, #0B1633 68%)", fontFamily: "Archivo" }}>
      {fond(process.env.VISUEL_FOND_PORTRAIT, w, h, 0.6)}
      <div style={at(st, 234, 312, { width: 616 * s, height: 690 * s, background: "#FFFFFF", borderRadius: radius })} />
      <div style={at(st, 238, 322, { width: 606 * s, height: 680 * s, background: "#3B6FE0", borderRadius: radius })} />
      <div style={at(st, 238, 338, { width: 592 * s, height: 664 * s, overflow: "hidden", alignItems: "center", justifyContent: "center", background: "#1E2C55", borderRadius: `${80 * s}px ${250 * s}px ${40 * s}px 0` })}>
        {d.photo ? (
          <img src={d.photo} alt="" width={592 * s} height={664 * s} style={{ width: 592 * s, height: 664 * s, objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 30 * s, color: "#8FA8E8" }}>Photo fournie par l'expert</span>
        )}
      </div>
      <div style={at(st, 694, 262, { width: 226 * s, height: 200 * s, flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#FFFFFF", borderRadius: `${50 * s}px ${60 * s}px ${130 * s}px ${50 * s}px` })}>
        <span style={{ fontSize: 38 * s, fontWeight: 800, color: "#3B6FE0", lineHeight: 1 }}>PORTRAIT</span>
        <span style={{ fontSize: 22 * s, fontWeight: 800, color: "#3B6FE0", marginTop: 6 * s }}>EXPERTS TECH</span>
      </div>
      <div style={at(st, 102, 870, { height: 64 * s, alignItems: "center", padding: `0 ${36 * s}px 0 ${16 * s}px`, background: "#FFFFFF", fontSize: autoSize(d.nom || d.titre || "", [[18, 50], [26, 42], [999, 36]]) * s, fontWeight: 800, color: "#3B63D0" })}>
        {fit(d.nom || d.titre || "Nom de l'expert", 30)}
      </div>
      <div style={at(st, 102, 946, { maxWidth: 520 * s, padding: `${6 * s}px ${12 * s}px`, background: "rgba(30,45,90,0.85)", fontSize: 29 * s, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.3 })}>
        {spec}
      </div>
      <div style={at(st, 600, 1190, { width: 405 * s, justifyContent: "flex-end", fontSize: 46 * s, fontWeight: 800, color: "#FFFFFF" })}>www.tuvoa.media</div>
    </div>
  );
}
