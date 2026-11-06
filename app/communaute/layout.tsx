import { Bricolage_Grotesque } from "next/font/google";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-grin", display: "swap" });

// Écran Le Grin : police de titre propre à cet écran.
export default function GrinLayout({ children }: { children: React.ReactNode }) {
  return <div className={bricolage.variable} style={{ display: "contents" }}>{children}</div>;
}
