import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NutriFit",
    short_name: "NutriFit",
    description: "Tu diario de comida y entreno, con un profe que te banca.",
    lang: "es-AR",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0d0c",
    theme_color: "#0b0d0c",
    categories: ["health", "fitness", "sports"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Cargar comida", url: "/diario?add=food", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Sumar agua", url: "/diario?add=water", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Entrenar", url: "/entreno", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
