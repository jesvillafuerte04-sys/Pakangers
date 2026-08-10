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
      {/* The credit lives in each layout (see components/BuiltByCredit) rather
          than here, so the public pages' fixed bottom nav can't cover it. */}
      <body className="min-h-full">{children}</body>
    </html>
  );
}
