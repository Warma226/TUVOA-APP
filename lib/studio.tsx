/* eslint-disable @next/next/no-img-element */
// Studio de VOA : modèles de visuels « pub » (photo + cartes flottantes + gros titres), rendus en PNG par next/og.
// Règle du moteur de rendu : tout bloc qui contient plusieurs enfants doit être en display: flex.

export type StudioModele = "semaine" | "reflexes" | "actus" | "ecoute" | "waouh";
export type StudioCarte = { titre: string; etat?: string; texte: string; bouton?: string; icone?: StudioIcone };
export type StudioIcone = "bulle" | "bouclier" | "maj" | "cle" | "nuage" | "lien" | "antenne" | "argent" | "robot" | "coeur" | "cal" | "ia";
export type StudioAmbiance = "bleu" | "noir" | "jaune" | "clair";
export type StudioData = {
  modele: StudioModele;
  photo?: string;
  ambiance?: StudioAmbiance;
  surtitre?: string;
  titre?: string;
  petit?: string;
  fort?: string;
  pastille?: string;
  sous?: string;
  bouton?: string;
  barre?: string;
  chips?: string[];
  cartes?: StudioCarte[];
};

export const MODELES: { id: StudioModele; nom: string; description: string; cartes: number; chips: number; champs: (keyof StudioData)[] }[] = [
  { id: "semaine", nom: "Nouvelle semaine", description: "Gros titre en deux couleurs, pastille, 4 étiquettes et barre d'appel. Photo en bas.", cartes: 0, chips: 4, champs: ["surtitre", "titre", "fort", "pastille", "sous", "barre", "bouton"] },
  { id: "reflexes", nom: "Cartes autour de la tête", description: "Photo plein cadre, 5 cartes flottantes autour de la personne, titre surligné.", cartes: 5, chips: 0, champs: ["titre", "petit", "fort", "sous", "bouton"] },
  { id: "waouh", nom: "Effet waouh", description: "Rayons de lumière, halo, cartes néon et titre doré. Idéal pour les annonces.", cartes: 5, chips: 0, champs: ["titre", "petit", "fort", "sous", "bouton"] },
  { id: "actus", nom: "Cartes des deux côtés", description: "Personne au centre, 4 cartes d'articles autour. Parfait pour le récap de la semaine.", cartes: 4, chips: 0, champs: ["titre", "fort", "sous", "bouton"] },
  { id: "ecoute", nom: "Notifications", description: "Photo plein cadre, notifications qui flottent, grand titre en bas à gauche.", cartes: 3, chips: 0, champs: ["titre", "sous", "bouton"] },
];

const BLEU = "#2563EB", NUIT = "#0A2A66", CIEL = "#6E9BFF", ORANGE = "#E94A06", ENCRE = "#0A0A0A";
const COULEURS = [BLEU, NUIT, ORANGE, "#1D4ED8", ENCRE];
const ICONES: Record<StudioIcone, string[]> = {
  bulle: ["M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"],
  bouclier: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M8.5 12l2.5 2.5 4.5-5"],
  maj: ["M12 3v12m0 0l-5-5m5 5l5-5M5 21h14"],
  cle: ["M5 11h14v10H5z", "M8 11V8a4 4 0 0 1 8 0v3"],
  nuage: ["M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"],
  lien: ["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1", "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"],
  antenne: ["M12 20v-8", "M8.5 8.5a5 5 0 0 1 7 0", "M5.5 5.5a9 9 0 0 1 13 0"],
  argent: ["M3 6h18v12H3z", "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6"],
  robot: ["M5 8h14v11H5z", "M12 4v4", "M9 13h.01M15 13h.01"],
  coeur: ["M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"],
  cal: ["M4 5h16v16H4z", "M8 3v4M16 3v4M4 10h16"],
  ia: ["M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"],
};
const ICONES_DEFAUT: StudioIcone[] = ["bouclier", "maj", "cle", "nuage", "lien"];

const abs = (x: number, y: number, extra: Record<string, unknown> = {}) => ({ position: "absolute" as const, left: x, top: y, display: "flex", ...extra });
const court = (t: string | undefined, n: number) => { const s = (t ?? "").trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };

function Icone({ nom, fond, taille = 44 }: { nom: StudioIcone; fond: string; taille?: number }) {
  return (
    <div style={{ display: "flex", width: taille, height: taille, borderRadius: 12, background: fond, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={taille * 0.55} height={taille * 0.55} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {(ICONES[nom] ?? ICONES.bulle).map((d, i) => <path key={i} d={d} />)}
      </svg>
    </div>
  );
}

function Logo({ clair, centre = false }: { clair: boolean; centre?: boolean }) {
  return (
    <div style={{ ...abs(centre ? 0 : 56, 52), ...(centre ? { right: 0, justifyContent: "center" } : {}), alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", width: 58, height: 58, background: BLEU, borderRadius: centre ? 14 : 0, alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#FFFFFF" }}>TUVOA</div>
      <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: clair ? "#FFFFFF" : ENCRE }}>TUVOA</div>
    </div>
  );
}

// Carte « interface » : icône, titre, badge d'état, texte et bouton (comme une fiche d'appli).
function Carte({ c, i, x, y, w, neon = false }: { c: StudioCarte; i: number; x: number; y: number; w: number; neon?: boolean }) {
  const fond = COULEURS[i % COULEURS.length];
  return (
    <div style={{ ...abs(x, y), width: w, flexDirection: "column", background: "rgba(255,255,255,0.96)", borderRadius: 20, padding: "18px 20px", color: ENCRE,
      boxShadow: neon ? "0 0 0 7px rgba(255,255,255,0.32), 0 0 54px rgba(110,155,255,0.9), 0 30px 60px rgba(0,0,0,0.35)" : "0 0 0 7px rgba(255,255,255,0.28), 0 0 40px rgba(110,155,255,0.55)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Icone nom={c.icone ?? ICONES_DEFAUT[i % ICONES_DEFAUT.length]} fond={fond} />
        <div style={{ display: "flex", flex: 1, fontSize: 20, fontWeight: 800 }}>{court(c.titre, 22)}</div>
        {c.etat ? <div style={{ display: "flex", fontSize: 14, fontWeight: 700, color: "#1D4ED8", background: "#DCE6FF", padding: "4px 9px", borderRadius: 7 }}>{court(c.etat, 14)}</div> : null}
      </div>
      <div style={{ display: "flex", marginTop: 10, fontSize: 18, lineHeight: 1.35, fontWeight: 600, color: "#374151", background: "#F3F4F6", borderRadius: 10, padding: "10px 12px" }}>{court(c.texte, 80)}</div>
      {c.bouton ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <div style={{ display: "flex", fontSize: 16, fontWeight: 600, color: "#6B7280" }}>Modifier</div>
          <div style={{ display: "flex", fontSize: 17, fontWeight: 700, color: "#FFFFFF", background: BLEU, padding: "7px 18px", borderRadius: 10 }}>{court(c.bouton, 14)}</div>
        </div>
      ) : null}
    </div>
  );
}

function Photo({ src, x = 0, y = 0, w = 1080, h = 1350, fit = "cover", pos = "50% 30%" }: { src?: string; x?: number; y?: number; w?: number; h?: number; fit?: "cover" | "contain"; pos?: string }) {
  if (!src) return <div style={{ ...abs(x, y), width: w, height: h, background: "linear-gradient(180deg, #1D3A7A, #0B1633)", alignItems: "center", justifyContent: "center", color: "#BFD0FF", fontSize: 34, fontWeight: 700 }}>Ajoute une photo</div>;
  return <img src={src} alt="" width={w} height={h} style={{ position: "absolute", left: x, top: y, width: w, height: h, objectFit: fit, objectPosition: pos }} />;
}

function Bouton({ texte, contour = false, clair = true, taille = 30 }: { texte?: string; contour?: boolean; clair?: boolean; taille?: number }) {
  if (!texte) return null;
  return contour
    ? <div style={{ display: "flex", border: `2px solid ${clair ? "#FFFFFF" : NUIT}`, color: clair ? "#FFFFFF" : NUIT, borderRadius: 12, fontSize: taille, fontWeight: 700, padding: "10px 24px" }}>{court(texte, 30)}</div>
    : <div style={{ display: "flex", background: BLEU, color: "#FFFFFF", borderRadius: 12, fontSize: taille, fontWeight: 700, padding: "12px 30px", boxShadow: "0 0 34px rgba(37,99,235,0.75)" }}>{court(texte, 30)}</div>;
}

const POSITIONS_5: [number, number, number][] = [[380, 40, 320], [40, 190, 310], [730, 190, 310], [30, 470, 300], [750, 470, 300]];

// ─── Modèle 1 : Nouvelle semaine ──────────────────────────────────────
function semaine(d: StudioData) {
  const chips = (d.chips ?? []).slice(0, 4);
  const styles = [{ bg: "#DCE6FF", c: NUIT }, { bg: BLEU, c: "#FFFFFF" }, { bg: NUIT, c: "#FFFFFF" }, { bg: ENCRE, c: "#FFFFFF" }];
  const pos: [number, number][] = [[50, 640], [50, 722], [730, 640], [730, 722]];
  const titre = `${d.titre ?? ""} ${d.fort ?? ""}`.trim();
  const taille = titre.length > 18 ? 78 : titre.length > 14 ? 92 : 110;
  return (
    <div style={{ display: "flex", width: 1080, height: 1350, position: "relative", background: "#F5F8FF", fontFamily: "Montserrat", color: ENCRE }}>
      <Photo src={d.photo} y={600} h={750} />
      <div style={{ ...abs(0, 600), width: 1080, height: 260, background: "linear-gradient(180deg, #F5F8FF 0%, rgba(245,248,255,0) 100%)" }} />
      <Logo clair={false} />
      <div style={{ ...abs(0, 175), width: 1080, flexDirection: "column", alignItems: "center" }}>
        {d.surtitre ? <div style={{ display: "flex", fontSize: 48, fontWeight: 600 }}>{court(d.surtitre, 40)}</div> : null}
        <div style={{ display: "flex", fontSize: taille, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05, marginTop: 4 }}>
          <span>{court(d.titre, 14)}</span>
          {d.fort ? <span style={{ color: BLEU, marginLeft: 22 }}>{court(d.fort, 14)}</span> : null}
        </div>
        {d.pastille ? <div style={{ display: "flex", marginTop: 20, background: BLEU, color: "#FFFFFF", fontWeight: 700, fontSize: 46, padding: "14px 46px", borderRadius: 16 }}>{court(d.pastille, 30)}</div> : null}
        {d.sous ? <div style={{ display: "flex", marginTop: 24, fontSize: 33, fontWeight: 600, maxWidth: 960, textAlign: "center" }}>{court(d.sous, 70)}</div> : null}
      </div>
      {chips.map((c, i) => (
        <div key={i} style={{ ...abs(pos[i][0], pos[i][1]), width: 300, height: 62, borderRadius: 16, background: styles[i].bg, color: styles[i].c, alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, boxShadow: "0 10px 30px rgba(10,42,102,0.25)" }}>{court(c, 18)}</div>
      ))}
      <div style={{ ...abs(0, 1150), width: 1080, height: 200, background: ENCRE, borderRadius: "44px 44px 0 0", alignItems: "center", justifyContent: "center", gap: 24 }}>
        {d.barre ? <div style={{ display: "flex", color: "#FFFFFF", fontSize: 36, fontWeight: 600 }}>{court(d.barre, 30)}</div> : null}
        {d.bouton ? <div style={{ display: "flex", background: BLEU, color: "#FFFFFF", fontSize: 36, fontWeight: 700, padding: "18px 36px", borderRadius: 44 }}>{court(d.bouton, 26)}</div> : null}
      </div>
    </div>
  );
}

// ─── Modèles 2 et 3 : cartes autour de la tête (normal ou waouh) ──────
const AMBIANCES: Record<StudioAmbiance, { fond: string; rayon: string; halo: string; bord: string }> = {
  jaune: { fond: "radial-gradient(circle at 50% 36%, #FFD45A 0%, #F2B21B 30%, #C27210 62%, #4A2204 100%)", rayon: "rgba(255,240,190,0.38)", halo: "rgba(255,248,215,0.95)", bord: "232,160,26" },
  bleu: { fond: "radial-gradient(circle at 50% 36%, #7FA6FF 0%, #2563EB 32%, #0B1F5C 68%, #060B1A 100%)", rayon: "rgba(200,220,255,0.30)", halo: "rgba(220,232,255,0.9)", bord: "29,78,216" },
  noir: { fond: "radial-gradient(circle at 50% 36%, #3A3F4E 0%, #15171D 50%, #000000 100%)", rayon: "rgba(255,255,255,0.18)", halo: "rgba(255,255,255,0.55)", bord: "30,32,38" },
  clair: { fond: "radial-gradient(circle at 50% 36%, #FFFFFF 0%, #E4ECFF 55%, #BFD0FF 100%)", rayon: "rgba(37,99,235,0.10)", halo: "rgba(255,255,255,0.95)", bord: "228,236,255" },
};

function Rayons({ couleur }: { couleur: string }) {
  const n = 24, cx = 950, cy = 950, R = 1400;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / n / 2.6;
    parts.push(`M${cx} ${cy} L${(cx + R * Math.cos(a0)).toFixed(0)} ${(cy + R * Math.sin(a0)).toFixed(0)} L${(cx + R * Math.cos(a1)).toFixed(0)} ${(cy + R * Math.sin(a1)).toFixed(0)} Z`);
  }
  return (
    <svg width={1900} height={1900} viewBox="0 0 1900 1900" style={{ position: "absolute", left: 540 - 950, top: 470 - 950 }}>
      <defs>
        <radialGradient id="fondu" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={couleur} />
          <stop offset="55%" stopColor={couleur} stopOpacity={0.5} />
          <stop offset="100%" stopColor={couleur} stopOpacity={0} />
        </radialGradient>
      </defs>
      <path d={parts.join(" ")} fill="url(#fondu)" />
    </svg>
  );
}

function autourDeLaTete(d: StudioData, waouh: boolean) {
  const cartes = (d.cartes ?? []).slice(0, 5);
  const amb = AMBIANCES[d.ambiance ?? (waouh ? "jaune" : "bleu")];
  const basNoir = waouh || d.ambiance === "noir" ? "0,0,0" : "6,11,26";
  return (
    <div style={{ display: "flex", width: 1080, height: 1350, position: "relative", background: waouh ? amb.fond : "#0B1633", fontFamily: "Montserrat", color: "#FFFFFF", overflow: "hidden" }}>
      {waouh ? <Rayons couleur={amb.rayon} /> : null}
      {waouh ? <div style={{ ...abs(250, 150), width: 580, height: 580, borderRadius: 290, background: `radial-gradient(circle, ${amb.halo} 0%, rgba(255,255,255,0) 70%)` }} /> : null}
      {waouh ? <Photo src={d.photo} y={320} h={1030} pos="50% 0%" /> : <Photo src={d.photo} pos="50% 0%" />}
      {waouh ? <div style={{ ...abs(0, 320), width: 1080, height: 90, background: `linear-gradient(180deg, rgba(${amb.bord},1) 0%, rgba(${amb.bord},0) 100%)` }} /> : <div style={{ ...abs(0, 0), width: 1080, height: 420, background: "linear-gradient(180deg, rgba(11,22,51,0.75) 0%, rgba(11,22,51,0) 100%)" }} />}
      <div style={{ ...abs(0, 750), width: 1080, height: 600, background: `linear-gradient(0deg, rgba(${basNoir},0.97) 0%, rgba(${basNoir},0.82) 50%, rgba(${basNoir},0) 100%)` }} />
      {waouh ? <div style={{ ...abs(0, 0), width: 1080, height: 1350, background: "radial-gradient(circle at 50% 40%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)" }} /> : null}
      <Logo clair />
      {cartes.map((c, i) => <Carte key={i} c={c} i={i} x={POSITIONS_5[i][0]} y={POSITIONS_5[i][1]} w={POSITIONS_5[i][2]} neon={waouh} />)}
      <div style={{ ...abs(0, 900), width: 1080, flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 92, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05, color: waouh ? "#FFF3D1" : "#FFFFFF", textShadow: waouh ? "0 6px 24px rgba(0,0,0,0.5)" : "none" }}>
          <span>{court(d.titre, 18)}</span>
          {d.petit ? <span style={{ fontSize: 60, fontWeight: 600, letterSpacing: -1, marginLeft: 18, color: "#FFFFFF" }}>{court(d.petit, 14)}</span> : null}
        </div>
        {d.fort ? <div style={{ display: "flex", marginTop: 8, fontSize: 92, fontWeight: 800, letterSpacing: -3, lineHeight: 1.1, background: `linear-gradient(90deg, ${BLEU}, ${CIEL})`, padding: "0 18px", borderRadius: 12, boxShadow: waouh ? "0 0 40px rgba(37,99,235,0.9)" : "none" }}>{court(d.fort, 20)}</div> : null}
        {d.sous ? <div style={{ display: "flex", marginTop: 18, fontSize: 32, fontWeight: 600, maxWidth: 980, textAlign: "center" }}>{court(d.sous, 70)}</div> : null}
        <div style={{ display: "flex", marginTop: 22 }}><Bouton texte={d.bouton} /></div>
      </div>
    </div>
  );
}

// ─── Modèle 4 : cartes des deux côtés (récap d'articles) ──────────────
function actus(d: StudioData) {
  const cartes = (d.cartes ?? []).slice(0, 4);
  const pos: [number, number][] = [[40, 520], [40, 800], [720, 470], [720, 760]];
  const icones: StudioIcone[] = ["antenne", "argent", "bouclier", "robot"];
  return (
    <div style={{ display: "flex", width: 1080, height: 1350, position: "relative", background: "radial-gradient(circle at 50% 62%, #FFFFFF 0%, #FFFFFF 30%, #E4ECFF 62%, #BFD0FF 100%)", fontFamily: "Montserrat", color: NUIT, overflow: "hidden" }}>
      <Photo src={d.photo} x={-10} y={430} w={1100} h={920} fit="contain" pos="50% 100%" />
      <Logo clair={false} centre />
      <div style={{ ...abs(0, 140), width: 1080, flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02, color: ENCRE }}>{court(d.titre, 20)}</div>
        {d.fort ? <div style={{ display: "flex", fontSize: 92, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05, color: BLEU }}>{court(d.fort, 24)}</div> : null}
        {d.sous ? <div style={{ display: "flex", marginTop: 14, fontSize: 34, fontWeight: 600, color: "#374151" }}>{court(d.sous, 56)}</div> : null}
      </div>
      {cartes.map((c, i) => (
        <div key={i} style={{ ...abs(pos[i][0], pos[i][1]), width: 330, flexDirection: "column", background: "rgba(255,255,255,0.96)", borderRadius: 20, padding: "18px 20px", boxShadow: "0 0 0 7px rgba(255,255,255,0.28), 0 0 40px rgba(110,155,255,0.55)", color: ENCRE }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Icone nom={c.icone ?? icones[i]} fond={COULEURS[i]} />
            <div style={{ display: "flex", fontSize: 19, fontWeight: 800 }}>{court(c.titre, 20)}</div>
          </div>
          <div style={{ display: "flex", marginTop: 10, fontSize: 19, lineHeight: 1.35, fontWeight: 700, background: BLEU, color: "#FFFFFF", borderRadius: "14px 14px 4px 14px", padding: "12px 14px" }}>{court(c.texte, 70)}</div>
          {c.etat ? <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 14, color: "#6B7280", fontWeight: 600, marginTop: 6 }}>{court(c.etat, 16)}</div> : null}
        </div>
      ))}
      {d.bouton ? <div style={{ ...abs(640, 1250), width: 390, justifyContent: "flex-end" }}><Bouton texte={d.bouton} contour clair={false} taille={28} /></div> : null}
    </div>
  );
}

// ─── Modèle 5 : notifications ─────────────────────────────────────────
function ecoute(d: StudioData) {
  const cartes = (d.cartes ?? []).slice(0, 3);
  const pos: [number, number][] = [[40, 330], [760, 250], [740, 520]];
  return (
    <div style={{ display: "flex", width: 1080, height: 1350, position: "relative", background: NUIT, fontFamily: "Montserrat", color: "#FFFFFF", overflow: "hidden" }}>
      <Photo src={d.photo} pos="50% 20%" />
      <div style={{ ...abs(0, 630), width: 1080, height: 720, background: d.ambiance === "noir" ? "linear-gradient(0deg, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0) 100%)" : "linear-gradient(0deg, rgba(10,42,102,0.97) 0%, rgba(10,42,102,0.85) 45%, rgba(10,42,102,0) 100%)" }} />
      <Logo clair />
      {cartes.map((c, i) => (
        <div key={i} style={{ ...abs(pos[i][0], pos[i][1]), width: 290, padding: "15px 18px", gap: 14, alignItems: "center", background: "rgba(255,255,255,0.96)", borderRadius: 20, color: ENCRE, boxShadow: "0 0 0 7px rgba(255,255,255,0.28), 0 0 40px rgba(110,155,255,0.55)" }}>
          <Icone nom={c.icone ?? "bulle"} fond={BLEU} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontWeight: 800, fontSize: 20 }}>{court(c.titre, 22)}</div>
            <div style={{ display: "flex", fontSize: 17, color: "#6B7280", fontWeight: 600 }}>{court(c.texte, 26)}</div>
          </div>
          {i === 1 ? <div style={{ ...abs(262, -10), width: 30, height: 30, borderRadius: 15, background: ORANGE, color: "#FFFFFF", fontWeight: 800, fontSize: 17, alignItems: "center", justifyContent: "center" }}>1</div> : null}
        </div>
      ))}
      <div style={{ ...abs(64, 900), width: 952, flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 600, letterSpacing: -3, lineHeight: 1.04, maxWidth: 900 }}>{court(d.titre, 48)}</div>
        {d.sous ? <div style={{ display: "flex", marginTop: 20, fontSize: 34, fontWeight: 600, color: "#E4ECFF" }}>{court(d.sous, 80)}</div> : null}
        <div style={{ display: "flex", marginTop: 24 }}><Bouton texte={d.bouton} contour /></div>
      </div>
    </div>
  );
}

export function renderStudio(d: StudioData) {
  switch (d.modele) {
    case "semaine": return semaine(d);
    case "waouh": return autourDeLaTete(d, true);
    case "actus": return actus(d);
    case "ecoute": return ecoute(d);
    default: return autourDeLaTete(d, false);
  }
}

// Exemples de départ, repris des visuels validés.
export const EXEMPLES: Record<StudioModele, Omit<StudioData, "modele" | "photo">> = {
  semaine: { surtitre: "Bienvenue dans une", titre: "NOUVELLE", fort: "SEMAINE", pastille: "Passionnés de tech.", sous: "Restez informés, vite et bien, avec TUVOA.", chips: ["IA", "Cybersécurité", "Mobile money", "Startups"], barre: "Toute l'actu tech sur :", bouton: "warmachinertech.com" },
  reflexes: { titre: "Nouvelle semaine", petit: "Mêmes", fort: "bons réflexes", sous: "Activez la vérification en deux étapes sur WhatsApp", bouton: "Voir l'astuce du lundi", cartes: [
    { titre: "Deux étapes", etat: "Activée", texte: "Votre WhatsApp est protégé par un code PIN.", bouton: "Activer", icone: "bouclier" },
    { titre: "Mise à jour", etat: "Installée", texte: "Téléphone à jour : les failles connues sont corrigées.", bouton: "Vérifier", icone: "maj" },
    { titre: "Mot de passe", etat: "Fort", texte: "Long, unique, jamais partagé.", bouton: "Changer", icone: "cle" },
    { titre: "Sauvegarde", etat: "Faite", texte: "Photos et discussions à l'abri.", bouton: "Lancer", icone: "nuage" },
    { titre: "Lien suspect", etat: "Évité", texte: "« Vous avez gagné » ? On ne clique pas.", bouton: "Signaler", icone: "lien" },
  ] },
  waouh: { ambiance: "jaune", titre: "Bon week-end", petit: "et restez", fort: "prudents en ligne", sous: "Déconnectez-vous, mais gardez les bons réflexes", bouton: "Voir nos conseils", cartes: [
    { titre: "Samedi", etat: "Repos", texte: "Le téléphone peut souffler, vous aussi.", bouton: "Profiter", icone: "bulle" },
    { titre: "À lire", etat: "4 actus", texte: "La semaine tech, au calme, sur le site.", bouton: "Lire", icone: "antenne" },
    { titre: "Lien suspect", etat: "Évité", texte: "« Vous avez gagné » ? On ne clique pas.", bouton: "Signaler", icone: "lien" },
    { titre: "Messenger", etat: "Ouvert", texte: "Une question ? On vous répond.", bouton: "Écrire", icone: "bouclier" },
    { titre: "Lundi 7h", etat: "À suivre", texte: "Une nouvelle semaine d'actu tech.", bouton: "Rappel", icone: "cal" },
  ] },
  actus: { titre: "Bon week-end !", fort: "La semaine en 4 actus", sous: "À lire au calme sur warmachinertech.com", bouton: "Lire les articles", cartes: [] },
  ecoute: { titre: "Le week-end, on reste à l'écoute.", sous: "Écrivez-nous sur Messenger : on vous répond, même le samedi.", bouton: "Écrire à TUVOA", cartes: [
    { titre: "Nouveau message", texte: "Samedi · 23:58", icone: "bulle" },
    { titre: "Nouvelle question", texte: "Dimanche · 00:12", icone: "bulle" },
    { titre: "Nouveau commentaire", texte: "Dimanche · 09:05", icone: "bulle" },
  ] },
};
