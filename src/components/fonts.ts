import { Pixelify_Sans, Rubik } from "next/font/google";

// Estilo "juego de oficina" (rediseño 2026-11-07): títulos pixelados y texto redondeado. Panel y pantalla de entrada; las demos tienen sus fuentes.
const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-pixel", display: "swap" });
const body = Rubik({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });

export const panelFonts = `${pixel.variable} ${body.variable}`;
