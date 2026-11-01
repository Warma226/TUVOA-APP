/* eslint-disable @next/next/no-img-element */
// Slides du « Récap tech de la semaine » (carrousel 4:5, 1080 × 1350), même identité que le visuel #ActuTech.
// Règle du moteur de rendu : tout bloc qui contient plusieurs enfants doit être en display: flex.
import { LogoMark } from "./visual";

const BLEU = "#2563EB";
const M = "Montserrat";
const W = 1080;
const H = 1350;

export type SlideData =
  | { kind: "cover"; periode: string; count: number; photos?: string[]; categories?: string[]; titres?: string[]; assets?: string }
  | { kind: "item"; index: number; total: number; categorie: string; texte: string; photo?: string; source?: string }
  | { kind: "end"; assets?: string };

function fit(text: string, max: number) {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}
function autoSize(text: string, steps: [number, number][]): number {
  for (const [maxLen, size] of steps) if (text.length <= maxLen) return size;
  return steps[steps.length - 1][1];
}
export function renderSlide(d: SlideData) {
  if (d.kind === "cover") return cover(d);
  if (d.kind === "item") return item(d);
  return fin(d.assets ?? "");
}

// Fond bleu nuit avec quadrillage blanc à 5 % (même ambiance que la photo de couverture).
function FondBleu() {
  const lignes: string[] = [];
  for (let x = -40; x <= W + 40; x += 112) lignes.push(`M ${x} 0 L ${x + 60} ${H}`);
  for (let y = 20; y <= H; y += 112) lignes.push(`M 0 ${y} L ${W} ${y - 50}`);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex", backgroundImage: "radial-gradient(ellipse at 50% 35%, #1747C9 0%, #0C2C8E 45%, #061648 100%)" }} />
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
        <path d={lignes.join(" ")} fill="none" stroke="#FFFFFF" strokeOpacity="0.05" strokeWidth="5" />
      </svg>
    </div>
  );
}

// ─── Slide d'actu : la feuille posée de travers sur le fond bleu, photo de l'article + l'info ───
function item(d: { index: number; total: number; categorie: string; texte: string; photo?: string; source?: string }) {
  const info = fit(d.texte, 240);
  const size = autoSize(info, [[110, 46], [160, 42], [210, 38], [999, 35]]);
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", fontFamily: M }}>
      <FondBleu />
      {/* En-tête : logo + numéro */}
      <div style={{ position: "absolute", left: 70, top: 58, display: "flex" }}>
        <LogoMark size={36} color="#FFFFFF" dot="#FFFFFF" />
      </div>
      <div style={{ position: "absolute", right: 70, top: 60, display: "flex", alignItems: "center", padding: "10px 22px", borderRadius: 40, border: "2px solid rgba(255,255,255,0.8)", fontFamily: M, fontSize: 30, fontWeight: 700, color: "#FFFFFF" }}>
        {`${d.index} / ${d.total}`}
      </div>

      {/* La feuille */}
      <div style={{ position: "absolute", left: 72, top: 200, width: 936, height: 1000, display: "flex", flexDirection: "column", padding: 34, background: "#F5F5F2", borderRadius: 6, transform: "rotate(-2.2deg)", boxShadow: "0 28px 50px rgba(0,0,0,0.45)" }}>
        <div style={{ display: "flex", position: "relative", width: 868, height: 520, overflow: "hidden", borderRadius: 4, backgroundImage: "linear-gradient(160deg, #1D3A7A 0%, #0B1633 100%)" }}>
          {d.photo ? <img src={d.photo} alt="" width={868} height={520} style={{ position: "absolute", left: 0, top: 0, width: 868, height: 520, objectFit: "cover" }} /> : null}
          <div style={{ position: "absolute", left: 0, bottom: 28, display: "flex", padding: "10px 26px 10px 24px", background: BLEU, fontFamily: M, fontSize: 34, fontWeight: 800, color: "#FFFFFF" }}>
            {fit(d.categorie || "Actu tech", 24)}
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 36, fontFamily: M, fontSize: size, fontWeight: 700, color: "#111111", lineHeight: 1.3 }}>{info}</div>
        <div style={{ display: "flex", position: "absolute", left: 34, bottom: 30, fontFamily: M, fontSize: 24, fontWeight: 600, color: "#6B6B6B" }}>
          {d.source ? `Source : ${fit(d.source, 40)}` : ""}
        </div>
      </div>

      {/* Pied */}
      <div style={{ position: "absolute", left: 70, top: 1258, display: "flex", fontFamily: M, fontSize: 26, fontWeight: 600, color: "#9DB8F5" }}>Le récap de la semaine</div>
      <div style={{ position: "absolute", right: 70, top: 1252, display: "flex", fontFamily: M, fontSize: 34, fontWeight: 800, color: "#FFFFFF" }}>www.tuvoa.media</div>
    </div>
  );
}

// ─── Slide de fin : la même photo, la feuille porte l'appel à s'abonner ───
function fin(base: string) {
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", fontFamily: M, background: "#0B2A8A" }}>
      <img src={`${base}/recap/base.jpg`} alt="" width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />
      <div style={{ position: "absolute", left: FEUILLE.left, top: FEUILLE.top, width: FEUILLE.w, height: FEUILLE.h, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 70, transform: `rotate(${FEUILLE.angle}deg)` }}>
        <div style={{ display: "flex", padding: "26px 40px", background: "#FFFFFF", borderRadius: 18, boxShadow: "0 6px 16px rgba(0,0,0,0.12)" }}>
          <LogoMark size={70} color="#1A1A1A" />
        </div>
        <div style={{ display: "flex", marginTop: 50, fontFamily: M, fontSize: 56, fontWeight: 800, color: "#111111" }}>Toute l'actu tech,</div>
        <div style={{ display: "flex", fontFamily: M, fontSize: 56, fontWeight: 800, color: BLEU }}>chaque jour.</div>
        <div style={{ display: "flex", marginTop: 30, padding: "14px 30px", borderRadius: 40, background: BLEU, fontFamily: M, fontSize: 30, fontWeight: 700, color: "#FFFFFF" }}>Abonnez-vous à TUVOA Tech Media</div>
      </div>
      <img src={`${base}/recap/front.png`} alt="" width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />
      <div style={{ position: "absolute", left: 120, top: 1030, width: 940, display: "flex", flexDirection: "column", alignItems: "center", opacity: 0.9 }}>
        <div style={{ display: "flex", fontFamily: M, fontSize: 96, fontWeight: 800, letterSpacing: -3, lineHeight: 1, color: "#1B3FA8", textShadow: "1px 1px 0 rgba(255,255,255,0.35), -1px -1px 1px rgba(0,0,0,0.30)" }}>À la semaine</div>
        <div style={{ display: "flex", fontFamily: M, fontSize: 96, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05, color: "#0F2463", textShadow: "1px 1px 0 rgba(255,255,255,0.35), -1px -1px 1px rgba(0,0,0,0.30)" }}>prochaine</div>
      </div>
      <div style={{ position: "absolute", left: 0, top: 46, width: W, display: "flex", justifyContent: "center", fontFamily: M, fontSize: 34, fontWeight: 800, color: "#FFFFFF" }}>www.tuvoa.media</div>
    </div>
  );
}

// ─── Couverture « dossier de la semaine » : fond bleu quadrillé, feuille de vignettes qui sort d'une enveloppe kraft ───

function Vignette({ photo, categorie, w, h }: { photo?: string; categorie?: string; w: number; h: number }) {
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, overflow: "hidden", borderRadius: 6, background: "#1E3A8A", boxShadow: "0 4px 10px rgba(0,0,0,0.25)" }}>
      {photo ? (
        <img src={photo} alt="" width={w} height={h} style={{ position: "absolute", left: 0, top: 0, width: w, height: h, objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(160deg, #1D3A7A 0%, #0B1633 100%)" }}>
          <LogoMark size={24} color="#FFFFFF" />
        </div>
      )}
      <div style={{ position: "absolute", left: 0, top: h * 0.55, width: w, height: h * 0.45, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 100%)" }} />
      {categorie ? (
        <div style={{ position: "absolute", left: 10, bottom: 34, display: "flex", padding: "3px 8px", background: BLEU, fontFamily: M, fontSize: 13, fontWeight: 800, color: "#FFFFFF" }}>{fit(categorie, 16)}</div>
      ) : null}
      <div style={{ position: "absolute", left: 10, bottom: 12, width: w - 20, height: 6, display: "flex", borderRadius: 3, background: "rgba(255,255,255,0.75)" }} />
    </div>
  );
}

// Géométrie de la feuille sur la photo (1080 × 1350) : coin haut gauche (34, 231), inclinaison −4,16°.
const FEUILLE = { left: 54.5, top: 196.7, w: 924, h: 600, angle: -4.16 };

function cover(d: { periode: string; count: number; photos?: string[]; categories?: string[]; titres?: string[]; assets?: string }) {
  const photos = d.photos ?? [];
  const cats = d.categories ?? [];
  const base = d.assets ?? "";
  const tw = 192;
  const th = 240;
  const gap = 14;
  const gridW = 4 * tw + 3 * gap;
  const relief = "1px 1px 0 rgba(255,255,255,0.35), -1px -1px 1px rgba(0,0,0,0.30)";
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", fontFamily: M, background: "#0B2A8A" }}>
      {/* 1. La photo (fond quadrillé, feuille blanche, enveloppe, mains) */}
      <img src={`${base}/recap/base.jpg`} alt="" width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />

      {/* 2. Les vignettes, posées sur la feuille avec la même inclinaison */}
      <div style={{ position: "absolute", left: FEUILLE.left, top: FEUILLE.top, width: FEUILLE.w, height: FEUILLE.h, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 26, transform: `rotate(${FEUILLE.angle}deg)` }}>
        <div style={{ display: "flex", flexWrap: "wrap", width: gridW, gap }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Vignette key={i} photo={photos[i]} categorie={cats[i]} w={tw} h={th} />
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 16, fontFamily: M, fontSize: 26, fontWeight: 700, color: "#151515" }}>{`TUVOA:\\Récap\\${fit(d.periode, 26)}`}</div>
      </div>

      {/* 3. Premier plan détouré : poche de l'enveloppe et mains (le bas de la feuille passe dedans) */}
      <img src={`${base}/recap/front.png`} alt="" width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />

      {/* 4. Titre imprimé sur le kraft */}
      <div style={{ position: "absolute", left: 120, top: 1010, width: 940, display: "flex", flexDirection: "column", alignItems: "center", opacity: 0.9 }}>
        <div style={{ display: "flex", fontFamily: M, fontSize: 112, fontWeight: 800, letterSpacing: -3, lineHeight: 1, color: "#1B3FA8", textShadow: relief }}>Le récap</div>
        <div style={{ display: "flex", fontFamily: M, fontSize: 104, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05, color: "#0F2463", textShadow: relief }}>de la semaine</div>
      </div>

      {/* 5. Logo en haut */}
      <div style={{ position: "absolute", left: 0, top: 46, width: W, display: "flex", justifyContent: "center" }}>
        <LogoMark size={44} color="#FFFFFF" dot="#FFFFFF" />
      </div>
    </div>
  );
}
