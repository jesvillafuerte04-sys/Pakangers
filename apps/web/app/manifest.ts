import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pakangers Tournament",
    short_name: "Pakangers",
    description: "Live pickleball tournament results.",
    start_url: "/",
    display: "standalone",
    background_color: "#F5EEDC",
    theme_color: "#1B294B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
