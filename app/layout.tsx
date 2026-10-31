import type { Metadata, Viewport } from "next";
import { Inter, Archivo } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], weight: ["300", "800"], variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: "TUVOA Studio",
  description: "Veille, création et publication des posts de TUVOA Tech Media",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${archivo.variable}`}>
      <body>
        <div className="app">{children}</div>
      </body>
    </html>
  );
}
