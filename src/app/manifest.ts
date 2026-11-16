import type { MetadataRoute } from "next";

// App instalable en el celular (Modo Visita). Abre directo en la ruta del día.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Agent Village: visitas",
    short_name: "Visitas",
    description: "Ruta del día y notas de visitas, también sin internet.",
    start_url: "/visita.html",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#1c1917",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
