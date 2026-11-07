import type { Metadata, Viewport } from "next";
import { Inter, Archivo, Montserrat } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mont = Montserrat({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-mont", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], weight: ["300", "800"], variable: "--font-archivo", display: "swap" });

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
