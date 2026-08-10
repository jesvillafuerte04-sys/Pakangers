import type { Metadata, Viewport } from "next";
import { Inter, Roboto_Slab } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const robotoSlab = Roboto_Slab({
  variable: "--font-roboto-slab",
  subsets: ["latin"],
  weight: ["700", "900"],
});

export const metadata: Metadata = {
  title: "Pakangers Tournament",
  description: "Configuration-driven pickleball tournament management.",
  appleWebApp: {
    capable: true,
    title: "Pakangers",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#1B294B",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoSlab.variable}`}>
      <body className="min-h-full">
        {children}
        <footer className="py-6 text-center text-xs text-[var(--color-text-muted)] opacity-60">
          Built by Jes Villafuerte
        </footer>
      </body>
    </html>
  );
}
