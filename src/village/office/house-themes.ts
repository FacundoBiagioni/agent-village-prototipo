// Variantes enteras de la casa (botón Skins): materiales de pisos y paredes, terreno, vegetación, clima y fondo.
// Los muebles y los agentes son los mismos; cambia el "lugar". Datos puros: también los usa el servidor para validar.
import type { Surface } from "./kit";

type Paint = { color: string; surface: Surface };
export type HouseTheme = {
  id: string;
  name: string;
  idea: string;
  swatch: [string, string, string];
  floor: Paint;
  kitchen: string;
  mezz: string;
  ground: Paint;
  edge: Paint;
  /** Pared del fondo abajo (ladrillo en la de siempre), revoque de arriba, pared izquierda y paredes del frente. */
  backLow: Paint;
  upper: Paint;
  left: Paint;
  side: Paint;
  trim: string;
  wood: string;
  darkWood: string;
  frame: string;
  path: string;
  /** Fondo detrás de la maqueta, de día y de noche. */
  bg: [string, string];
  tree: "apple" | "pine" | "palm" | "sakura" | "planter";
  /** Lo que cae del cielo. */
  weather?: "snow" | "petals" | "leaves";
};

export const HOUSE_THEMES: HouseTheme[] = [
  {
    id: "campo",
    name: "Casa de campo",
    idea: "La de siempre: madera, ladrillo, pasto y un manzano.",
    swatch: ["#c99f72", "#a95a43", "#7cb45a"],
    floor: { color: "#c99f72", surface: "wood" },
    kitchen: "#e8e0d0",
    mezz: "#b98a5c",
    ground: { color: "#7cb45a", surface: "grass" },
    edge: { color: "#8d8478", surface: "stone" },
    backLow: { color: "#a95a43", surface: "brick" },
    upper: { color: "#efe5d1", surface: "plaster" },
    left: { color: "#b7c9b4", surface: "plaster" },
    side: { color: "#efe5d1", surface: "plaster" },
    trim: "#2b2730",
    wood: "#b98a5c",
    darkWood: "#6b4a32",
    frame: "#efe5d1",
    path: "#b9b2a4",
    bg: ["#2a2f3c", "#10111c"],
    tree: "apple",
    weather: "leaves",
  },
  {
    id: "nieve",
    name: "Cabaña en la nieve",
    idea: "Troncos, piso de pino oscuro, todo nevado alrededor y copos que caen.",
    swatch: ["#7a5236", "#eef3f7", "#2f5a4a"],
    floor: { color: "#8a5a3b", surface: "wood" },
    kitchen: "#d9cdb8",
    mezz: "#7a5236",
    ground: { color: "#eef3f7", surface: "concrete" },
    edge: { color: "#9aa4ad", surface: "stone" },
    backLow: { color: "#7a5236", surface: "wood" },
    upper: { color: "#e8e0d0", surface: "plaster" },
    left: { color: "#8a6040", surface: "wood" },
    side: { color: "#efe6d6", surface: "plaster" },
    trim: "#3a2a22",
    wood: "#a0703f",
    darkWood: "#5a3b26",
    frame: "#f4efe6",
    path: "#c9d3dc",
    bg: ["#33435a", "#0b1222"],
    tree: "pine",
    weather: "snow",
  },
  {
    id: "playa",
    name: "Casa de playa",
    idea: "Madera blanqueada, tablas celestes, arena y palmeras.",
    swatch: ["#7bbfd1", "#e9d39a", "#fbf7ef"],
    floor: { color: "#e3d2b0", surface: "wood" },
    kitchen: "#f2f2ee",
    mezz: "#d8c4a0",
    ground: { color: "#e9d39a", surface: "earth" },
    edge: { color: "#c9b48a", surface: "stone" },
    backLow: { color: "#7bbfd1", surface: "wood" },
    upper: { color: "#fbf7ef", surface: "plaster" },
    left: { color: "#f4e3c3", surface: "plaster" },
    side: { color: "#fbf7ef", surface: "plaster" },
    trim: "#2f5d7a",
    wood: "#c9a877",
    darkWood: "#8a6a44",
    frame: "#ffffff",
    path: "#f2e6c8",
    bg: ["#24485a", "#0a1822"],
    tree: "palm",
  },
  {
    id: "loft",
    name: "Loft industrial",
    idea: "Cemento alisado, ladrillo a la vista, hierro negro y patio de baldosas.",
    swatch: ["#9a9a96", "#8f4a36", "#2b2b30"],
    floor: { color: "#9a9a96", surface: "concrete" },
    kitchen: "#5a5a62",
    mezz: "#5a5a60",
    ground: { color: "#6a6d72", surface: "tile" },
    edge: { color: "#3d3f44", surface: "stone" },
    backLow: { color: "#8f4a36", surface: "brick" },
    upper: { color: "#b9b6b0", surface: "concrete" },
    left: { color: "#a95a43", surface: "brick" },
    side: { color: "#c8c4bc", surface: "concrete" },
    trim: "#1d1d22",
    wood: "#7a6a5a",
    darkWood: "#2b2b30",
    frame: "#2b2b30",
    path: "#8a8c90",
    bg: ["#22242b", "#0b0c10"],
    tree: "planter",
  },
  {
    id: "japonesa",
    name: "Casa japonesa",
    idea: "Tatami, paneles de papel, musgo, piedras y un cerezo que suelta pétalos.",
    swatch: ["#c9b98a", "#f3ecdc", "#f2a6c0"],
    floor: { color: "#c9b98a", surface: "felt" },
    kitchen: "#d8cdb4",
    mezz: "#8a6a44",
    ground: { color: "#7fa35a", surface: "grass" },
    edge: { color: "#a8a49a", surface: "stone" },
    backLow: { color: "#f3ecdc", surface: "plaster" },
    upper: { color: "#f3ecdc", surface: "plaster" },
    left: { color: "#e9e0cc", surface: "plaster" },
    side: { color: "#f3ecdc", surface: "plaster" },
    trim: "#3b2a22",
    wood: "#8a5a3b",
    darkWood: "#4a2f22",
    frame: "#4a2f22",
    path: "#d6d2c6",
    bg: ["#2e2a33", "#110e17"],
    tree: "sakura",
    weather: "petals",
  },
  {
    id: "neon",
    name: "Noche neón",
    idea: "Pisos de baldosa violeta, paredes oscuras con bordes que brillan y un patio de grilla.",
    swatch: ["#2a2440", "#ff5fa2", "#7df0d0"],
    floor: { color: "#3a3256", surface: "tile" },
    kitchen: "#2a2440",
    mezz: "#4a3f70",
    ground: { color: "#1f2a44", surface: "tile" },
    edge: { color: "#3a2f5a", surface: "stone" },
    backLow: { color: "#3a2f5a", surface: "brick" },
    upper: { color: "#2c2645", surface: "plaster" },
    left: { color: "#322a50", surface: "plaster" },
    side: { color: "#2c2645", surface: "plaster" },
    trim: "#ff5fa2",
    wood: "#5a4a7a",
    darkWood: "#241d38",
    frame: "#7df0d0",
    path: "#4a3f70",
    bg: ["#140f26", "#06040e"],
    tree: "palm",
  },
];

export const houseTheme = (id: string | undefined) => HOUSE_THEMES.find((t) => t.id === id) ?? HOUSE_THEMES[0];
