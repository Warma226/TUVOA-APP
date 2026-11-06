// VOA « Glitch », la mascotte de l'agent community manager : une boule bleue TUVOA à lunettes noires
// qui « bugue » quand elle s'énerve. Taquine, jamais méchante. Son humeur suit ce qui se passe sur la Page.
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
@keyframes voaRespire{0%,100%{transform:rotate(6deg) scale(1,1)}50%{transform:rotate(6deg) scale(1.02,.97)}}
@keyframes voaSaute{0%,100%{transform:translateY(0) scale(1,1)}15%{transform:translateY(0) scale(1.06,.92)}45%{transform:translateY(-22px) scale(.97,1.04)}75%{transform:translateY(0) scale(1.04,.95)}}
@keyframes voaTremble{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
@keyframes voaGA{0%,86%,100%{transform:translate(0,0)}88%{transform:translate(-7px,2px)}92%{transform:translate(5px,-3px)}96%{transform:translate(-3px,0)}}
@keyframes voaGB{0%,86%,100%{transform:translate(0,0)}88%{transform:translate(7px,-2px)}92%{transform:translate(-5px,3px)}96%{transform:translate(3px,0)}}
@keyframes voaGAf{0%,100%{transform:translate(-6px,2px)}33%{transform:translate(5px,-3px)}66%{transform:translate(-2px,4px)}}
@keyframes voaGBf{0%,100%{transform:translate(6px,-2px)}33%{transform:translate(-5px,3px)}66%{transform:translate(2px,-4px)}}
@keyframes voaSourcil{0%,70%,100%{transform:translateY(0)}78%,90%{transform:translateY(-6px)}}
@keyframes voaBouche{0%{transform:scaleY(.3)}100%{transform:scaleY(1.1)}}
@keyframes voaCligne{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}
@keyframes voaOnde{0%{opacity:0}30%{opacity:1}100%{opacity:0}}
@keyframes voaZ{0%{opacity:0;transform:translate(0,8px)}30%{opacity:1}100%{opacity:0;transform:translate(14px,-26px)}}
@keyframes voaPulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes voaEclat{0%,60%,100%{opacity:0;transform:scale(.4)}75%{opacity:1;transform:scale(1)}}
@keyframes voaConfetti{0%{opacity:0;transform:translateY(-6px)}20%{opacity:1}100%{opacity:0;transform:translateY(30px) rotate(160deg)}}
.voa-flotte{animation:voaFlotte 2.6s ease-in-out infinite}
.voa-respire{animation:voaRespire 3.8s ease-in-out infinite;transform-origin:100px 200px}
.voa-saute{animation:voaSaute .95s ease-in-out infinite;transform-origin:100px 200px}
.voa-tremble{animation:voaTremble .28s linear infinite}
.voa-ga{animation:voaGA 2.6s steps(1) infinite}
.voa-gb{animation:voaGB 2.6s steps(1) infinite}
.voa-gaf{animation:voaGAf .45s steps(1) infinite}
.voa-gbf{animation:voaGBf .45s steps(1) infinite}
.voa-sourcil{animation:voaSourcil 3s ease-in-out infinite}
.voa-bouche{animation:voaBouche .32s ease-in-out infinite alternate;transform-origin:104px 146px}
.voa-cligne{animation:voaCligne 4.6s infinite;transform-origin:100px 114px}
.voa-onde{animation:voaOnde 1.4s ease-out infinite}
.voa-onde2{animation:voaOnde 1.4s ease-out .35s infinite}
.voa-z{animation:voaZ 2.6s ease-in infinite}
.voa-z2{animation:voaZ 2.6s ease-in 1.3s infinite}
.voa-pulse{animation:voaPulse 1s ease-in-out infinite}
.voa-eclat{animation:voaEclat 1.8s ease-in-out infinite;transform-origin:134px 104px}
.voa-confetti{animation:voaConfetti 1.4s ease-in infinite}
.voa-confetti2{animation:voaConfetti 1.4s ease-in .5s infinite}
.voa-confetti3{animation:voaConfetti 1.4s ease-in .9s infinite}
@media (prefers-reduced-motion: reduce){.voa svg *{animation:none !important}}
`;

const ENCRE = "#000000", NUIT = "#0A2A66", BLEU = "#2563EB", CIEL = "#6E9BFF", CYAN = "#00D1FF", ORANGE = "#E94A06";
const CORPS = { x: 34, y: 44, width: 132, height: 150, rx: 58 };

export default function Voa({ humeur = "veille", taille = 120, decor = false }: { humeur?: Humeur; taille?: number; decor?: boolean }) {
  const is = (...l: Humeur[]) => l.includes(humeur);
  const mouvement = is("content", "fete") ? "voa-saute" : is("alerte") ? "voa-tremble" : is("dort") ? "voa-respire" : is("crise") ? "voa-tremble" : "voa-flotte";
  const bug = is("alerte", "crise") ? ["voa-gaf", "voa-gbf"] : is("dort") ? [undefined, undefined] : ["voa-ga", "voa-gb"];
  const lunettesSurLeFront = is("alerte", "crise", "ecoute");
  const trait = { stroke: ENCRE, strokeWidth: 6, fill: "none", strokeLinecap: "round" as const };
  return (
    <span className="voa" style={{ display: "inline-flex", width: taille, flexShrink: 0 }}>
      <style>{CSS}</style>
      <svg viewBox="0 0 200 230" width="100%" role={decor ? undefined : "img"} aria-hidden={decor || undefined} aria-label={decor ? undefined : HUMEURS[humeur]}>
        <ellipse cx="100" cy="220" rx="52" ry="7" fill={ENCRE} opacity="0.18" />
        <g className={mouvement}>
          {/* les doubles qui « buguent » */}
          <g className={bug[0]} opacity={is("dort") ? 0 : 0.85}><rect {...CORPS} fill={CYAN} /></g>
          <g className={bug[1]} opacity={is("dort") ? 0 : 0.85}><rect {...CORPS} fill={ORANGE} /></g>
          <rect {...CORPS} fill={BLEU} />
          <path d="M60 70 Q72 54 96 50" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.3" />
          <clipPath id="voa-corps"><rect {...CORPS} /></clipPath>
          <g clipPath="url(#voa-corps)">
            <rect x="34" y="160" width="132" height="6" fill={NUIT} />
            <rect x="34" y="168" width="132" height="4" fill={ORANGE} />
          </g>
          <rect x="62" y="194" width="20" height="14" rx="6" fill={NUIT} />
          <rect x="118" y="194" width="20" height="14" rx="6" fill={NUIT} />

          {/* yeux, visibles quand les lunettes remontent sur le front */}
          {lunettesSurLeFront ? (
            <g className="voa-cligne">
              <ellipse cx="76" cy="114" rx="15" ry={is("alerte") ? 20 : 17} fill="#FFFFFF" />
              <ellipse cx="124" cy="114" rx="15" ry={is("alerte") ? 20 : 17} fill="#FFFFFF" />
              <circle cx={is("ecoute") ? 80 : 78} cy={is("ecoute") ? 110 : 116} r="7.5" fill={ENCRE} />
              <circle cx={is("ecoute") ? 128 : 122} cy={is("ecoute") ? 110 : 116} r="7.5" fill={ENCRE} />
              <circle cx="81" cy="111" r="2.5" fill="#FFFFFF" />
              <circle cx="125" cy="111" r="2.5" fill="#FFFFFF" />
            </g>
          ) : null}
          {is("crise") ? (<><path d="M60 92 L90 84" {...trait} stroke={NUIT} /><path d="M140 92 L110 84" {...trait} stroke={NUIT} /></>) : null}
          {is("alerte") ? (<><path d="M60 88 Q75 78 90 88" {...trait} stroke={NUIT} /><path d="M110 88 Q125 78 140 88" {...trait} stroke={NUIT} /></>) : null}

          {/* le sourcil insolent, au-dessus des lunettes */}
          {!lunettesSurLeFront && !is("dort") ? <g className="voa-sourcil"><path d="M118 86 L150 80" stroke={NUIT} strokeWidth="7" strokeLinecap="round" /></g> : null}

          {/* les lunettes : sur le nez, ou relevées sur le front */}
          <g transform={lunettesSurLeFront ? "translate(0 -42) scale(1 .9)" : undefined}>
            <path d="M44 98 L156 98 L152 108 L136 124 L112 124 L104 108 L96 108 L88 124 L64 124 L48 108 Z" fill={ENCRE} />
            <rect x="56" y="102" width="12" height="6" fill="#FFFFFF" opacity="0.8" />
            <rect x="116" y="102" width="12" height="6" fill="#FFFFFF" opacity="0.8" />
          </g>
          {is("content", "fete") ? <path className="voa-eclat" d="M134 96 L137 102 L143 104 L137 106 L134 112 L131 106 L125 104 L131 102 Z" fill="#FFFFFF" /> : null}

          {/* bouches */}
          {is("veille", "ecoute") ? <path d="M84 146 Q104 152 122 138" {...trait} /> : null}
          {is("parle") ? <ellipse className="voa-bouche" cx="104" cy="146" rx="12" ry="9" fill={ENCRE} /> : null}
          {is("content", "fete") ? (<><path d="M78 138 Q102 172 126 136 Z" fill={ENCRE} /><path d="M90 154 Q102 162 113 152 Q102 148 90 154 Z" fill="#FF6B81" /></>) : null}
          {is("alerte") ? <circle cx="100" cy="150" r="7" fill={ENCRE} /> : null}
          {is("crise") ? <><path d="M82 152 Q91 144 100 152 Q109 160 118 152" {...trait} /><path d="M154 70 Q161 84 154 91 Q147 84 154 70 Z" fill={CIEL} /></> : null}
          {is("dort") ? <ellipse cx="100" cy="148" rx="6" ry="5" fill={ENCRE} /> : null}

          {/* il parle : petites ondes à côté de la bouche */}
          {is("parle") ? (<><path className="voa-onde" d="M136 138 Q142 146 136 154" stroke={CIEL} strokeWidth="4" fill="none" strokeLinecap="round" /><path className="voa-onde2" d="M144 132 Q153 146 144 160" stroke={CIEL} strokeWidth="4" fill="none" strokeLinecap="round" /></>) : null}
        </g>
        {is("ecoute") ? (<><path className="voa-onde" d="M174 96 Q182 112 174 128" stroke={CIEL} strokeWidth="4" fill="none" strokeLinecap="round" /><path className="voa-onde2" d="M184 88 Q196 112 184 136" stroke={CIEL} strokeWidth="4" fill="none" strokeLinecap="round" /></>) : null}
        {is("alerte") ? <g className="voa-pulse"><rect x="172" y="20" width="10" height="28" rx="5" fill={ORANGE} /><circle cx="177" cy="58" r="6" fill={ORANGE} /></g> : null}
        {is("dort") ? (<><text className="voa-z" x="150" y="44" fontSize="26" fontWeight="800" fill={CIEL}>z</text><text className="voa-z2" x="166" y="28" fontSize="19" fontWeight="800" fill={CIEL}>z</text></>) : null}
        {is("fete") ? (
          <>
            <rect className="voa-confetti" x="22" y="20" width="10" height="5" fill={ORANGE} />
            <rect className="voa-confetti2" x="168" y="26" width="10" height="5" fill={CYAN} />
            <rect className="voa-confetti3" x="58" y="4" width="8" height="8" fill={CIEL} />
            <rect className="voa-confetti2" x="138" y="2" width="9" height="5" fill={ORANGE} />
            <rect className="voa-confetti" x="182" y="62" width="8" height="8" fill="#FFFFFF" />
            <rect className="voa-confetti3" x="10" y="70" width="8" height="5" fill={CYAN} />
          </>
        ) : null}
      </svg>
    </span>
  );
}
