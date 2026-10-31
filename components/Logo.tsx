// Logotype TUVOA : TUV + point bleu + Λ, avec « TECH MEDIA » dessous.
// Le logo officiel est en Coolvetica ; ici on le reproduit en Archivo pour l'interface.
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <div role="img" aria-label="TUVOA Tech Media" style={{ display: "flex", flexDirection: "column", gap: 3, lineHeight: 1 }}>
      <div aria-hidden="true" style={{ display: "flex", alignItems: "center", fontFamily: "var(--font-archivo), sans-serif", fontWeight: 800, fontSize: size, color: "#333333" }}>
        <span>TUV</span>
        <span style={{ display: "inline-block", width: size * 0.78, height: size * 0.78, borderRadius: "50%", background: "#2563eb", margin: "0 1px" }} />
        <span>Λ</span>
      </div>
      <span aria-hidden="true" style={{ fontFamily: "var(--font-archivo), sans-serif", fontWeight: 300, fontSize: size * 0.42, letterSpacing: "0.12em", color: "#333333", paddingLeft: size * 0.55 }}>
        TECH MEDIA
      </span>
    </div>
  );
}
