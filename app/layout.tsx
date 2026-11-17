import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";

// Polices intégrées à l'app (sous-ensemble latin des polices variables Google Fonts, licence OFL : app/fonts/LICENCE-OFL.txt).
// Plus de téléchargement depuis Google pendant la compilation : c'était la cause des échecs de mise en ligne.
const inter = localFont({ src: "./fonts/inter.woff", weight: "100 900", variable: "--font-inter", display: "swap" });
const mont = localFont({ src: "./fonts/montserrat.woff", weight: "100 900", variable: "--font-mont", display: "swap" });
const archivo = localFont({ src: "./fonts/archivo.woff", weight: "100 900", variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: "TUVOA Studio",
  description: "Veille, création et publication des posts de TUVOA Tech Media",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a2a66",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${archivo.variable} ${mont.variable}`}>
      <body>
        <div className="app">
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
