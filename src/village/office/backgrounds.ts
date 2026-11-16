// Fondos detrás de la casa (botón Skins). "casa" usa el color de la variante de la casa, que cambia de día y de noche;
// los demás se dibujan una vez en un lienzo y quedan fijos. Sin imágenes de afuera.

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;
export type Background = { id: string; name: string; idea: string; swatch: [string, string, string]; draw?: Draw };

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const vertical = (g: CanvasRenderingContext2D, h: number, stops: [number, string][]) => {
  const grad = g.createLinearGradient(0, 0, 0, h);
  for (const [k, c] of stops) grad.addColorStop(k, c);
  return grad;
};
const stars = (g: CanvasRenderingContext2D, w: number, h: number, n: number, maxY = 1) => {
  seed = 11;
  for (let i = 0; i < n; i++) {
    const big = rnd() > 0.92;
    g.fillStyle = `rgba(255,255,240,${0.4 + rnd() * 0.6})`;
    g.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h * maxY), big ? 3 : 1.5, big ? 3 : 1.5);
  }
};

export const BACKGROUNDS: Background[] = [
  { id: "casa", name: "El de la casa", idea: "El color de la variante de la casa; se oscurece de noche.", swatch: ["#2a2f3c", "#10111c", "#3c4a5c"] },
  {
    id: "cielo",
    name: "Cielo de día",
    idea: "Celeste que se aclara hacia abajo, con nubes.",
    swatch: ["#6fb0e6", "#cfe8f6", "#ffffff"],
    draw(g, w, h) {
      g.fillStyle = vertical(g, h, [[0, "#5ea6e3"], [0.7, "#bfe0f4"], [1, "#e9f5fb"]]);
      g.fillRect(0, 0, w, h);
      seed = 3;
      g.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 9; i++) {
        const [x, y, s] = [rnd() * w, rnd() * h * 0.6, 30 + rnd() * 60];
        for (let k = 0; k < 4; k++) g.fillRect(x + k * s * 0.4, y - (k % 2) * s * 0.18, s, s * 0.32);
      }
    },
  },
  {
    id: "atardecer",
    name: "Atardecer",
    idea: "Naranja, rosa y violeta, con el sol bajando.",
    swatch: ["#ff9a5a", "#e2557a", "#4b2a6a"],
    draw(g, w, h) {
      g.fillStyle = vertical(g, h, [[0, "#3b2160"], [0.45, "#b8457a"], [0.75, "#ff8a4a"], [1, "#ffd27a"]]);
      g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(255,230,160,0.9)";
      g.beginPath();
      g.arc(w * 0.78, h * 0.8, h * 0.12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(60,30,80,0.35)";
      for (let i = 0; i < 5; i++) g.fillRect(0, h * (0.62 + i * 0.07), w, 3);
      stars(g, w, h, 40, 0.35);
    },
  },
  {
    id: "estrellas",
    name: "Noche estrellada",
    idea: "Azul profundo, cientos de estrellas y una luna.",
    swatch: ["#0b1430", "#1d2c5a", "#fff6c8"],
    draw(g, w, h) {
      g.fillStyle = vertical(g, h, [[0, "#060b1e"], [1, "#1c2b58"]]);
      g.fillRect(0, 0, w, h);
      stars(g, w, h, 600);
      g.fillStyle = "#f4efcf";
      g.beginPath();
      g.arc(w * 0.85, h * 0.18, h * 0.06, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#060b1e";
      g.beginPath();
      g.arc(w * 0.865, h * 0.17, h * 0.055, 0, Math.PI * 2);
      g.fill();
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    idea: "Cortinas verdes y violetas sobre un cielo frío.",
    swatch: ["#071a24", "#3bffb0", "#9c6bff"],
    draw(g, w, h) {
      g.fillStyle = vertical(g, h, [[0, "#04101a"], [1, "#0d2a36"]]);
      g.fillRect(0, 0, w, h);
      stars(g, w, h, 250);
      g.globalCompositeOperation = "lighter";
      for (const [col, y0, amp] of [["rgba(59,255,176,0.16)", 0.3, 0.08], ["rgba(156,107,255,0.14)", 0.42, 0.1], ["rgba(59,255,176,0.1)", 0.22, 0.06]] as const) {
        for (let x = 0; x < w; x += 3) {
          const y = h * (y0 + Math.sin(x / (w * 0.12)) * amp);
          g.fillStyle = vertical(g, h, [[Math.max(0, (y - h * 0.18) / h), "rgba(0,0,0,0)"], [y / h, col], [Math.min(1, (y + h * 0.04) / h), "rgba(0,0,0,0)"]]);
          g.fillRect(x, 0, 3, h);
        }
      }
      g.globalCompositeOperation = "source-over";
    },
  },
  {
    id: "plano",
    name: "Plano de arquitecto",
    idea: "Azul de plano con cuadrícula fina y gruesa.",
    swatch: ["#1d4f8f", "#2d6ab4", "#cfe3ff"],
    draw(g, w, h) {
      g.fillStyle = "#1d4f8f";
      g.fillRect(0, 0, w, h);
      for (const [step, a] of [[16, 0.12], [80, 0.28]] as const) {
        g.fillStyle = `rgba(207,227,255,${a})`;
        for (let x = 0; x < w; x += step) g.fillRect(x, 0, 1, h);
        for (let y = 0; y < h; y += step) g.fillRect(0, y, w, 1);
      }
    },
  },
  {
    id: "papel",
    name: "Papel punteado",
    idea: "Crema con puntitos, como una libreta.",
    swatch: ["#f4ead6", "#d9c9a8", "#b9a888"],
    draw(g, w, h) {
      g.fillStyle = "#f2e8d3";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(120,95,60,0.28)";
      for (let x = 10; x < w; x += 20) for (let y = 10; y < h; y += 20) g.fillRect(x, y, 2, 2);
    },
  },
  {
    id: "bosque",
    name: "Bosque",
    idea: "Siluetas de pinos sobre un cielo verdoso.",
    swatch: ["#c9dcb4", "#4f7a55", "#24402c"],
    draw(g, w, h) {
      g.fillStyle = vertical(g, h, [[0, "#d8e8c4"], [1, "#9cc092"]]);
      g.fillRect(0, 0, w, h);
      seed = 5;
      for (const [col, base, size] of [["#6f9a6a", 0.72, 0.16], ["#4f7a55", 0.84, 0.2], ["#24402c", 0.98, 0.26]] as const) {
        g.fillStyle = col;
        for (let x = -40; x < w + 40; x += 28 + rnd() * 30) {
          const t = h * size * (0.6 + rnd() * 0.6);
          g.beginPath();
          g.moveTo(x, h * base);
          g.lineTo(x + t * 0.35, h * base - t);
          g.lineTo(x + t * 0.7, h * base);
          g.fill();
        }
        g.fillRect(0, h * base, w, h);
      }
    },
  },
  {
    id: "oceano",
    name: "Océano",
    idea: "Agua turquesa que se oscurece hacia abajo, con brillos.",
    swatch: ["#3fc2d1", "#1a6f9a", "#0b2f4f"],
    draw(g, w, h) {
      g.fillStyle = vertical(g, h, [[0, "#47c9d6"], [0.5, "#1a7aa0"], [1, "#0a2a48"]]);
      g.fillRect(0, 0, w, h);
      seed = 9;
      g.fillStyle = "rgba(255,255,255,0.35)";
      for (let i = 0; i < 70; i++) g.fillRect(rnd() * w, rnd() * h * 0.6, 8 + rnd() * 24, 2);
    },
  },
  {
    id: "vapor",
    name: "Vaporwave",
    idea: "Sol a rayas y una grilla rosa que se pierde en el horizonte.",
    swatch: ["#2a0f4a", "#ff5fa2", "#7df0d0"],
    draw(g, w, h) {
      g.fillStyle = vertical(g, h, [[0, "#12051f"], [0.55, "#3a1060"], [0.56, "#140a24"], [1, "#0a0614"]]);
      g.fillRect(0, 0, w, h);
      const [cx, cy, r] = [w / 2, h * 0.5, h * 0.2];
      g.save();
      g.beginPath();
      g.arc(cx, cy, r, Math.PI, 0);
      g.clip();
      g.fillStyle = vertical(g, h, [[(cy - r) / h, "#ffd166"], [cy / h, "#ff5fa2"]]);
      g.fillRect(cx - r, cy - r, r * 2, r);
      g.fillStyle = "#3a1060";
      for (let i = 0; i < 5; i++) g.fillRect(cx - r, cy - r * 0.45 + i * r * 0.11, r * 2, 2 + i * 1.5);
      g.restore();
      g.strokeStyle = "rgba(255,95,162,0.7)";
      g.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) {
        const y = h * 0.56 + Math.pow(i / 12, 2) * h * 0.44;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      for (let i = -12; i <= 12; i++) {
        g.beginPath();
        g.moveTo(cx + i * 6, h * 0.56);
        g.lineTo(cx + i * w * 0.12, h);
        g.stroke();
      }
    },
  },
  { id: "negro", name: "Negro", idea: "Nada atrás: solo la casa.", swatch: ["#000000", "#111111", "#222222"], draw: (g, w, h) => ((g.fillStyle = "#050507"), g.fillRect(0, 0, w, h)) },
];

export const backgroundOf = (id: string | undefined) => BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
