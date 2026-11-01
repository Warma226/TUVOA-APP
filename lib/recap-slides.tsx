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
  | { kind: "item"; index: number; total: number; categorie: string; texte: string; photo?: string; source?: string; autres?: { photo?: string; categorie: string }[] }
  | { kind: "end"; assets?: string; photo?: string; autres?: { photo?: string; categorie: string }[] };

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
  return fin(d);
}

// ─── Slide d'actu (modèle « photo plein cadre ») : photo assombrie, logo en haut, grand texte blanc,
// mentions en italique avec coup de pinceau bleu, carte flottante.
const SERIF = "Instrument Serif";

function Pinceau({ w, h }: { w: number; h: number }) {
  // Trait de pinceau en zigzag, comme un surlignage à main levée
  const pas = 26;
  let d = `M 6 ${h * 0.62}`;
  for (let x = 6, i = 0; x < w - 10; x += pas, i++) {
    d += ` L ${x + pas * 0.6} ${i % 2 ? h * 0.75 : h * 0.3} L ${x + pas} ${i % 2 ? h * 0.42 : h * 0.68}`;
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: 0, top: 0 }}>
      <path d={d} fill="none" stroke={BLEU} strokeWidth={h * 0.32} strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.95" />
    </svg>
  );
}

function Mention({ text, size, pinceau }: { text: string; size: number; pinceau: number }) {
  return (
    <div style={{ display: "flex", position: "relative", paddingLeft: 6 }}>
      <Pinceau w={pinceau} h={size * 1.1} />
      <div style={{ display: "flex", position: "relative", fontFamily: SERIF, fontStyle: "italic", fontSize: size, color: "#FFFFFF", letterSpacing: -1 }}>{text}</div>
    </div>
  );
}

function Assombri() {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex" }}>
      {/* Assombrissement : léger partout, plus fort en haut (texte) et en bas */}
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.38) 40%, rgba(0,0,0,0.22) 60%, rgba(0,0,0,0.55) 100%)" }} />
        {/* Vignettage noir : bords et coins qui tombent au noir, centre plus lumineux */}
        <div style={{ position: "absolute", left: -120, top: -80, width: W + 240, height: H + 160, display: "flex", backgroundImage: "radial-gradient(ellipse at 42% 46%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.55) 62%, rgba(0,0,0,0.92) 85%, #000000 100%)" }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex", backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 70%, rgba(0,0,0,0.75) 100%)" }} />

    </div>
  );
}

function Carte({ photo, titre, sous, w, h, opacity = 1, r = 0 }: { photo?: string; titre: string; sous?: string; w: number; h: number; opacity?: number; r?: number }) {
  const ph = Math.round(h * 0.62);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: w, height: h, padding: 10, borderRadius: 18, background: "rgba(255,255,255,0.94)", boxShadow: "0 16px 36px rgba(0,0,0,0.45)", opacity, transform: r ? `rotate(${r}deg)` : undefined }}>
      <div style={{ display: "flex", position: "relative", width: w - 20, height: ph, borderRadius: 12, overflow: "hidden", background: "#1D3A7A" }}>
        {photo ? <img src={photo} alt="" width={w - 20} height={ph} style={{ position: "absolute", left: 0, top: 0, width: w - 20, height: ph, objectFit: "cover" }} /> : null}
      </div>
      <div style={{ display: "flex", marginTop: 10, fontFamily: M, fontSize: Math.round(w / 13), fontWeight: 700, color: "#111111" }}>{fit(titre, 20)}</div>
      {sous ? (
        <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
          <div style={{ display: "flex", width: 14, height: 14, borderRadius: 14, background: BLEU, marginRight: 6 }} />
          <div style={{ display: "flex", fontFamily: M, fontSize: Math.round(w / 19), fontWeight: 600, color: "#555555" }}>{fit(sous, 24)}</div>
        </div>
      ) : null}
    </div>
  );
}

function item(d: { index: number; total: number; categorie: string; texte: string; photo?: string; source?: string; autres?: { photo?: string; categorie: string }[] }) {
  const info = fit(d.texte, 220);
  const size = autoSize(info, [[90, 62], [130, 56], [170, 50], [999, 46]]);
  const cat = fit(d.categorie || "Actu tech", 20);
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", fontFamily: M, background: "#0A0F1F" }}>
      {d.photo ? <img src={d.photo} alt="" width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover" }} /> : null}
      {!d.photo ? <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex", backgroundImage: "radial-gradient(ellipse at 60% 40%, #1D3A7A 0%, #0B1633 60%, #050812 100%)" }} /> : null}
      <Assombri />
      {/* Logo */}
      <div style={{ position: "absolute", left: 0, top: 66, width: W, display: "flex", justifyContent: "center" }}>
        <LogoMark size={40} color="#FFFFFF" dot={BLEU} />
      </div>

      {/* Grand texte */}
      <div style={{ position: "absolute", left: 78, top: 290, width: 880, display: "flex", fontFamily: M, fontSize: size, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.06, letterSpacing: -3 }}>
        {info}
      </div>

      {/* Rangée de cartes flottantes : l'actu au centre, d'autres actus de la semaine autour */}
      {(() => {
        const o = d.autres ?? [];
        const side = (i: number) => o[i] ?? { photo: undefined, categorie: "Actu tech" };
        return (
          <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex" }}>
            <div style={{ position: "absolute", left: 120, top: 830, display: "flex" }}><Carte photo={side(1).photo} titre={side(1).categorie} w={150} h={170} opacity={0.55} r={-3} /></div>
            <div style={{ position: "absolute", left: 250, top: 800, display: "flex" }}><Carte photo={side(0).photo} titre={side(0).categorie} w={190} h={220} opacity={0.85} r={-2} /></div>
            <div style={{ position: "absolute", left: 690, top: 790, display: "flex" }}><Carte photo={side(2).photo} titre={side(2).categorie} w={190} h={220} opacity={0.85} r={2} /></div>
            <div style={{ position: "absolute", left: 860, top: 815, display: "flex" }}><Carte photo={side(3).photo} titre={side(3).categorie} w={150} h={180} opacity={0.55} r={3} /></div>
            <div style={{ position: "absolute", left: 425, top: 720, display: "flex" }}>
              <Carte photo={d.photo} titre={cat} sous={d.source ?? "TUVOA Tech Media"} w={250} h={340} />
            </div>
          </div>
        );
      })()}

      {/* Mentions en italique */}
      <div style={{ position: "absolute", right: 40, top: 712, display: "flex" }}>
        <Mention text={`« ${cat} »`} size={46} pinceau={Math.min(320, cat.length * 20 + 60)} />
      </div>
      <div style={{ position: "absolute", right: 110, top: 1075, display: "flex", fontFamily: SERIF, fontStyle: "italic", fontSize: 100, color: "#FFFFFF" }}>{`${d.index}/${d.total}`}</div>
      <div style={{ position: "absolute", left: 210, top: 1150, display: "flex" }}>
        <Mention text={d.source ? `« Source : ${fit(d.source, 26)} »` : "« TUVOA Tech Media »"} size={40} pinceau={180} />
      </div>
    </div>
  );
}

// ─── Slide de fin : même format que les slides d'actu (photo plein cadre, vignettage, cartes, mentions) ───
function fin(d: { photo?: string; autres?: { photo?: string; categorie: string }[] }) {
  const o = d.autres ?? [];
  const side = (i: number) => o[i] ?? { photo: undefined, categorie: "Actu tech" };
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", fontFamily: M, background: "#0A0F1F" }}>
      {d.photo ? <img src={d.photo} alt="" width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover" }} /> : null}
      {!d.photo ? <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex", backgroundImage: "radial-gradient(ellipse at 60% 40%, #1D3A7A 0%, #0B1633 60%, #050812 100%)" }} /> : null}
      <Assombri />
      <div style={{ position: "absolute", left: 0, top: 66, width: W, display: "flex", justifyContent: "center" }}>
        <LogoMark size={40} color="#FFFFFF" dot={BLEU} />
      </div>
      <div style={{ position: "absolute", left: 78, top: 290, width: 880, display: "flex", flexDirection: "column", fontFamily: M, fontSize: 64, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.06, letterSpacing: -3 }}>
        <div style={{ display: "flex" }}>Toute l'actu tech qui compte,</div>
        <div style={{ display: "flex" }}>chaque jour.</div>
        <div style={{ display: "flex", color: "#9DB8F5" }}>À la semaine prochaine.</div>
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex" }}>
        <div style={{ position: "absolute", left: 120, top: 830, display: "flex" }}><Carte photo={side(3).photo} titre={side(3).categorie} w={150} h={170} opacity={0.55} r={-3} /></div>
        <div style={{ position: "absolute", left: 250, top: 800, display: "flex" }}><Carte photo={side(1).photo} titre={side(1).categorie} w={190} h={220} opacity={0.85} r={-2} /></div>
        <div style={{ position: "absolute", left: 690, top: 790, display: "flex" }}><Carte photo={side(2).photo} titre={side(2).categorie} w={190} h={220} opacity={0.85} r={2} /></div>
        <div style={{ position: "absolute", left: 860, top: 815, display: "flex" }}><Carte photo={side(4).photo} titre={side(4).categorie} w={150} h={180} opacity={0.55} r={3} /></div>
        <div style={{ position: "absolute", left: 425, top: 720, display: "flex" }}>
          <Carte photo={side(0).photo} titre="TUVOA Tech Media" sous="www.tuvoa.media" w={250} h={340} />
        </div>
      </div>
      <div style={{ position: "absolute", right: 40, top: 712, display: "flex" }}>
        <Mention text="« Abonnez-vous »" size={46} pinceau={300} />
      </div>
      <div style={{ position: "absolute", right: 110, top: 1075, display: "flex", fontFamily: SERIF, fontStyle: "italic", fontSize: 100, color: "#FFFFFF" }}>fin</div>
      <div style={{ position: "absolute", left: 210, top: 1150, display: "flex" }}>
        <Mention text="« www.tuvoa.media »" size={40} pinceau={180} />
      </div>
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
