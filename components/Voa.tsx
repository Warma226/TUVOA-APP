// VOA, la mascotte de l'agent community manager : le point bleu du logo TUVOA qui a pris vie.
// Antenne qui capte les conversations, écharpe rayée inspirée du Faso Dan Fani. Son humeur suit ce qui se passe sur la Page.
export type Humeur = "veille" | "ecoute" | "parle" | "content" | "alerte" | "crise" | "dort" | "fete";

export const HUMEURS: Record<Humeur, string> = {
  veille: "VOA est au grin",
  ecoute: "VOA écoute un nouveau message",
  parle: "VOA répond à un abonné",
  content: "VOA est ravie : tout est traité",
  alerte: "VOA a repéré une arnaque",
  crise: "VOA est inquiète : mode crise",
  dort: "VOA est en pause",
  fete: "VOA fait la fête",
};

const CSS = `
.voa svg *{transform-box:view-box}
@keyframes voaFlotte{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes voaRespire{0%,100%{transform:scale(1,1)}50%{transform:scale(1.02,.97)}}
@keyframes voaSaute{0%,100%{transform:translateY(0) scale(1,1)}15%{transform:translateY(0) scale(1.06,.92)}45%{transform:translateY(-22px) scale(.97,1.04)}75%{transform:translateY(0) scale(1.04,.95)}}
@keyframes voaTremble{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
@keyframes voaCligne{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}
@keyframes voaOnde{0%{opacity:0}30%{opacity:1}100%{opacity:0}}
@keyframes voaBouche{0%{transform:scaleY(.35)}100%{transform:scaleY(1.1)}}
@keyframes voaZ{0%{opacity:0;transform:translate(0,8px)}30%{opacity:1}100%{opacity:0;transform:translate(14px,-26px)}}
@keyframes voaCoucou{0%,100%{transform:rotate(0)}50%{transform:rotate(-28deg)}}
@keyframes voaPulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes voaConfetti{0%{opacity:0;transform:translateY(-6px)}20%{opacity:1}100%{opacity:0;transform:translateY(30px) rotate(160deg)}}
.voa-flotte{animation:voaFlotte 2.6s ease-in-out infinite}
.voa-respire{animation:voaRespire 3.8s ease-in-out infinite;transform-origin:100px 198px}
.voa-saute{animation:voaSaute .95s ease-in-out infinite;transform-origin:100px 198px}
.voa-tremble{animation:voaTremble .28s linear infinite}
.voa-cligne{animation:voaCligne 4.6s infinite;transform-origin:100px 106px}
.voa-onde{animation:voaOnde 1.6s ease-out infinite}
.voa-onde2{animation:voaOnde 1.6s ease-out .4s infinite}
.voa-bouche{animation:voaBouche .32s ease-in-out infinite alternate;transform-origin:100px 143px}
.voa-z{animation:voaZ 2.6s ease-in infinite}
.voa-z2{animation:voaZ 2.6s ease-in 1.3s infinite}
.voa-coucou{animation:voaCoucou .7s ease-in-out infinite;transform-origin:160px 120px}
.voa-pulse{animation:voaPulse 1s ease-in-out infinite}
.voa-confetti{animation:voaConfetti 1.4s ease-in infinite}
.voa-confetti2{animation:voaConfetti 1.4s ease-in .5s infinite}
.voa-confetti3{animation:voaConfetti 1.4s ease-in .9s infinite}
@media (prefers-reduced-motion: reduce){.voa svg *{animation:none !important}}
`;

const ENCRE = "#0A0A0A", NUIT = "#0A2A66", BLEU = "#2563EB", CIEL = "#6E9BFF", ORANGE = "#E94A06";

export default function Voa({ humeur = "veille", taille = 120, decor = false }: { humeur?: Humeur; taille?: number; decor?: boolean }) {
  const is = (...l: Humeur[]) => l.includes(humeur);
  const mouvement = is("content", "fete") ? "voa-saute" : is("alerte") ? "voa-tremble" : is("dort", "crise") ? "voa-respire" : "voa-flotte";
  const antenne = is("alerte", "crise") ? ORANGE : is("dort") ? "#94A3B8" : CIEL;
  const oeil = is("alerte") ? 23 : 20;
  const pupille = is("ecoute") ? 103 : 109;
  const trait = { stroke: ENCRE, strokeWidth: 5, fill: "none", strokeLinecap: "round" as const };
  return (
    <span className="voa" style={{ display: "inline-flex", width: taille, flexShrink: 0 }}>
      <style>{CSS}</style>
      <svg viewBox="0 0 200 220" width="100%" role={decor ? undefined : "img"} aria-hidden={decor || undefined} aria-label={decor ? undefined : HUMEURS[humeur]}>
        <ellipse cx="100" cy="208" rx="46" ry="7" fill={ENCRE} opacity="0.14" />
        <g className={mouvement}>
          <line x1="100" y1="52" x2="100" y2="26" stroke={NUIT} strokeWidth="5" strokeLinecap="round" />
          <circle className={is("alerte", "crise", "ecoute", "parle") ? "voa-pulse" : undefined} cx="100" cy="20" r="9" fill={antenne} />
          {is("ecoute", "parle") ? (
            <>
              <path className="voa-onde" d="M116 9 Q124 20 116 31" stroke={CIEL} strokeWidth="4" fill="none" strokeLinecap="round" />
              <path className="voa-onde" d="M84 9 Q76 20 84 31" stroke={CIEL} strokeWidth="4" fill="none" strokeLinecap="round" />
              <path className="voa-onde2" d="M125 2 Q138 20 125 38" stroke={CIEL} strokeWidth="4" fill="none" strokeLinecap="round" />
              <path className="voa-onde2" d="M75 2 Q62 20 75 38" stroke={CIEL} strokeWidth="4" fill="none" strokeLinecap="round" />
            </>
          ) : null}
          <g transform={is("fete") ? "rotate(35 34 128) translate(-10 -40)" : undefined}><ellipse cx="34" cy="128" rx="11" ry="18" fill="#1D4ED8" /></g>
          <g transform={is("fete") ? "rotate(-35 166 128) translate(10 -40)" : undefined}>
            <g className={is("parle") ? "voa-coucou" : undefined}><ellipse cx="166" cy="128" rx="11" ry="18" fill="#1D4ED8" /></g>
          </g>
          <ellipse cx="78" cy="192" rx="17" ry="8" fill={NUIT} />
          <ellipse cx="122" cy="192" rx="17" ry="8" fill={NUIT} />
          <circle cx="100" cy="118" r="70" fill={BLEU} />
          <path d="M56 90 Q68 64 96 56" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.35" />
          <clipPath id="voa-corps"><circle cx="100" cy="118" r="70" /></clipPath>
          <g clipPath="url(#voa-corps)">
            <rect x="20" y="152" width="160" height="22" fill={NUIT} />
            <rect x="20" y="155" width="160" height="3" fill="#FFFFFF" />
            <rect x="20" y="161" width="160" height="5" fill={ORANGE} />
            <rect x="20" y="169" width="160" height="2" fill={CIEL} />
          </g>
          <path d="M128 166 L152 194 L133 199 Z" fill={NUIT} />
          <path d="M134 177 L145 194" stroke={ORANGE} strokeWidth="3" />
          {!is("dort", "content", "fete") ? (
            <g className="voa-cligne">
              <ellipse cx="76" cy="106" rx="17" ry={oeil} fill="#FFFFFF" />
              <ellipse cx="124" cy="106" rx="17" ry={oeil} fill="#FFFFFF" />
              <circle cx="80" cy={pupille} r="8.5" fill={ENCRE} />
              <circle cx="120" cy={pupille} r="8.5" fill={ENCRE} />
              <circle cx="83" cy="105" r="3" fill="#FFFFFF" />
              <circle cx="123" cy="105" r="3" fill="#FFFFFF" />
            </g>
          ) : null}
          {is("dort") ? (<><path d="M62 108 Q76 118 90 108" {...trait} /><path d="M110 108 Q124 118 138 108" {...trait} /></>) : null}
          {is("content", "fete") ? (<><path d="M62 112 Q76 96 90 112" {...trait} strokeWidth={6} /><path d="M110 112 Q124 96 138 112" {...trait} strokeWidth={6} /></>) : null}
          {is("alerte") ? (<><path d="M60 80 Q76 70 92 80" {...trait} stroke={NUIT} /><path d="M108 80 Q124 70 140 80" {...trait} stroke={NUIT} /></>) : null}
          {is("crise") ? (<><path d="M60 88 L90 79" {...trait} stroke={NUIT} /><path d="M140 88 L110 79" {...trait} stroke={NUIT} /></>) : null}
          {is("content", "fete", "parle") ? (<><ellipse cx="58" cy="132" rx="10" ry="6" fill="#FF8FA3" opacity="0.5" /><ellipse cx="142" cy="132" rx="10" ry="6" fill="#FF8FA3" opacity="0.5" /></>) : null}
          {is("veille", "ecoute", "dort") ? <path d="M86 138 Q100 151 114 138" {...trait} /> : null}
          {is("content", "fete") ? (<><path d="M80 133 Q100 170 120 133 Z" fill={ENCRE} /><path d="M89 152 Q100 162 111 152 Q100 145 89 152 Z" fill="#FF6B81" /></>) : null}
          {is("parle") ? <ellipse className="voa-bouche" cx="100" cy="143" rx="11" ry="9" fill={ENCRE} /> : null}
          {is("alerte") ? <circle cx="100" cy="145" r="7" fill={ENCRE} /> : null}
          {is("crise") ? (<><path d="M84 146 Q92 138 100 146 Q108 154 116 146" {...trait} /><path d="M152 74 Q159 88 152 95 Q145 88 152 74 Z" fill={CIEL} /></>) : null}
        </g>
        {is("alerte") ? <g className="voa-pulse"><rect x="160" y="14" width="10" height="28" rx="5" fill={ORANGE} /><circle cx="165" cy="52" r="6" fill={ORANGE} /></g> : null}
        {is("dort") ? (<><text className="voa-z" x="142" y="46" fontSize="24" fontWeight="800" fill={NUIT}>z</text><text className="voa-z2" x="156" y="30" fontSize="18" fontWeight="800" fill={NUIT}>z</text></>) : null}
        {is("fete") ? (
          <>
            <rect className="voa-confetti" x="30" y="20" width="9" height="5" fill={ORANGE} />
            <rect className="voa-confetti2" x="160" y="26" width="9" height="5" fill={CIEL} />
            <rect className="voa-confetti3" x="58" y="6" width="7" height="7" fill={NUIT} />
            <rect className="voa-confetti2" x="138" y="4" width="8" height="5" fill={ORANGE} />
            <rect className="voa-confetti" x="178" y="58" width="7" height="7" fill={BLEU} />
          </>
        ) : null}
      </svg>
    </span>
  );
}
