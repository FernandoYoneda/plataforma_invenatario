import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Inventário TI Casabella",
    short_name: "Inventário TI",
    description: "Controle de inventário de ativos de TI da Casabella.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f3ed",
    theme_color: "#2c6470",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/branding/LOGO-CASABELLA-CIRCULO.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/branding/LOGO-CASABELLA-CIRCULO.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/branding/LOGO-CASABELLA-CIRCULO.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
