// Personajes de la oficina.
// Un agente = RAZA (cuerpo y cabeza: la "raza base" que elige el usuario) + SKIN (ropa, colores y accesorios de su rubro).
// Sumar una raza, un rubro o una mascota es sumar una entrada a estos registros. A futuro se reemplazan por los dibujos del usuario.
import * as THREE from "three";
import type { VillageState } from "../state";
import { at, bake, canvasTexture, group, live, type Kit } from "./kit";

export type Rig = {
  root: THREE.Group;
  head: THREE.Object3D;
  armL?: THREE.Object3D;
  armR?: THREE.Object3D;
  legs: THREE.Object3D[];
  tail?: THREE.Object3D;
  /** Ojos: parpadean y se cierran al dormir. */
  eyes: THREE.Object3D[];
  /** Lo que lleva en la mano al caminar (carpeta), oculto el resto del tiempo. */
  carry?: THREE.Object3D;
  battery?: { fill: THREE.Mesh; mat: THREE.MeshBasicMaterial };
  /** Cara según el estado (el robot cambia su pantalla). */
  setMood?: (s: VillageState) => void;
  /** Animación propia (antena que titila, alas, etc.). */
  tick?: (t: number) => void;
};

/** Dónde quedan los ojos y orejas de cada raza: los accesorios del skin se ubican con esto. */
type Anchors = { eyeY: number; eyeZ: number; spread: number; earX: number; earY: number; topY: number };

// ---------- Ojos ----------

type EyeKind = "dot" | "iris" | "light" | "big";
function eyes(kit: Kit, g: THREE.Object3D, a: Anchors, kind: EyeKind, r: number, irisColor: string | [string, string] = "#c9d65a"): THREE.Object3D[] {
  return [-1, 1].map((s) => {
    const iris = typeof irisColor === "string" ? irisColor : irisColor[s < 0 ? 0 : 1];
    const e = at(group(), s * a.spread, a.eyeY, a.eyeZ);
    if (kind === "iris") {
      e.add(at(kit.sphere(r, iris, { shadow: false }), 0, 0, 0, undefined, [1, 1.1, 0.5]));
      e.add(at(kit.box(r * 0.45, r * 1.5, 0.02, "#15121a", { shadow: false }), 0, 0, r * 0.45));
    } else if (kind === "light") {
      e.add(at(kit.sphere(r, "#f4ead8", { shadow: false }), 0, 0, 0, undefined, [1, 1.1, 0.5]));
      e.add(at(kit.sphere(r * 0.55, "#15121a", { shadow: false }), 0, -r * 0.1, r * 0.3, undefined, [1, 1.1, 0.6]));
    } else {
      e.add(at(kit.sphere(r, "#15121a", { shadow: false, seg: kind === "big" ? 10 : 8 }), 0, 0, 0, undefined, [1, 1.15, 0.55]));
    }
    e.add(at(kit.box(r * 0.4, r * 0.4, 0.02, kit.glow("#ffffff"), { shadow: false }), r * 0.35, r * 0.4, r * 0.5));
    g.add(e);
    return e;
  });
}

// ---------- Razas ----------

type HeadOut = { anchors: Anchors; eyes: THREE.Object3D[]; setMood?: Rig["setMood"]; tick?: Rig["tick"] };
export type Species = {
  id: string;
  name: string;
  idea: string;
  hands: string;
  head: (kit: Kit, g: THREE.Group) => HeadOut;
  /** Cola, alas, lana: lo que la raza suma al cuerpo. */
  body?: (kit: Kit, torso: THREE.Group, rig: Rig) => void;
};

const HUMAN: Species = {
  id: "humano",
  name: "Humana",
  idea: "Chica de pelo corto con un mechón rebelde parado. Simple y expresiva.",
  hands: "#f0c29b",
  head(kit, g) {
    const skin = "#f0c29b";
    const hair = "#3d2a24";
    g.add(at(kit.sphere(0.33, skin, { surface: "skin" }), 0, 0.31, 0, undefined, [1, 0.95, 0.95]));
    for (const s of [-1, 1]) g.add(at(kit.sphere(0.07, skin, { surface: "skin" }), s * 0.32, 0.29, 0));
    g.add(at(kit.dome(0.355, hair, { surface: "fur" }), 0, 0.33, -0.03, [-0.35, 0, 0], [1, 0.95, 1]));
    g.add(at(kit.sphere(0.2, hair, { surface: "fur" }), 0.05, 0.5, 0.17, [0, 0, 0.2], [1.5, 0.5, 0.6]));
    for (const s of [-1, 1]) g.add(at(kit.box(0.08, 0.26, 0.14, hair, { surface: "fur" }), s * 0.31, 0.25, -0.02));
    g.add(at(kit.cone(0.05, 0.2, hair), 0.04, 0.72, 0, [0.3, 0, -0.5])); // el mechón
    const a: Anchors = { eyeY: 0.29, eyeZ: 0.3, spread: 0.12, earX: 0.32, earY: 0.29, topY: 0.64 };
    for (const s of [-1, 1]) g.add(at(kit.box(0.07, 0.035, 0.02, "#e8907e", { shadow: false }), s * 0.2, 0.2, 0.29));
    g.add(at(kit.box(0.06, 0.018, 0.02, "#8a3f3a", { shadow: false }), 0, 0.16, 0.31));
    return { anchors: a, eyes: eyes(kit, g, a, "dot", 0.048) };
  },
};

/** Pelaje de un gato: cada agente tiene su raza (usuario, 2026-11-10: "de diferentes razas y colores, les da más personalidad"). */
export type Coat = {
  id: string;
  name: string;
  fur: string;
  /** Dibujo del pelo: liso, atigrado o con manchitas. */
  pattern?: "tabby" | "spots";
  muzzle: string;
  /** Uno o dos colores (ojos dispares). */
  eyes: string | [string, string];
  /** Puntas oscuras (siamés): orejas, máscara, manos y cola. */
  points?: string;
  /** Manchones grandes en la cabeza y la cola (calicó, carey). */
  patches?: string[];
  /** Manos de otro color (medias blancas). */
  socks?: string;
  /** Pelo largo: cachetes, melena y cola de plumero. */
  fluffy?: boolean;
  /** Orejas dobladas hacia adelante. */
  fold?: boolean;
  /** Pincelitos en la punta de las orejas. */
  tufts?: boolean;
};

export const COATS: Coat[] = [
  { id: "esmoquin", name: "Esmoquin", fur: "#2e2a33", muzzle: "#f6f2ea", eyes: "#ffd84a", socks: "#f6f2ea" },
  { id: "siames", name: "Siamés", fur: "#efe3cf", muzzle: "#efe3cf", eyes: "#5fb4f0", points: "#4a372e" },
  { id: "calico", name: "Calicó", fur: "#f6f1e8", muzzle: "#ffffff", eyes: "#e3b23c", patches: ["#e8923a", "#2f2a2e"] },
  { id: "naranja", name: "Naranja atigrado", fur: "#e8923a", pattern: "tabby", muzzle: "#fbe9d0", eyes: "#7ec850", socks: "#fbe9d0" },
  { id: "gris", name: "Azul ruso", fur: "#8f98a8", muzzle: "#aab2c0", eyes: "#f2b43c" },
  { id: "mainecoon", name: "Maine coon", fur: "#8a6a4a", pattern: "tabby", muzzle: "#f1e6d6", eyes: "#c9d65a", fluffy: true, tufts: true },
  { id: "persa", name: "Persa blanco", fur: "#f4f1ea", muzzle: "#ffffff", eyes: ["#5fb4f0", "#f2b43c"], fluffy: true },
  { id: "bengali", name: "Bengalí", fur: "#d9a04a", pattern: "spots", muzzle: "#f6e7c8", eyes: "#7ec850" },
  { id: "fold", name: "Scottish fold", fur: "#b9a6c9", muzzle: "#d4c6e0", eyes: "#f2b43c", fold: true },
  { id: "carey", name: "Carey", fur: "#3a2d2a", muzzle: "#e8923a", eyes: "#c9d65a", patches: ["#e8923a", "#c9793a"] },
  { id: "atigrado", name: "Atigrado gris", fur: "#9aa0ad", pattern: "tabby", muzzle: "#f1ece4", eyes: "#a9d65a" },
];

const COAT_OF: Record<string, string> = { encargado: "esmoquin", analista: "siames", disenador: "calico", comunicador: "naranja", probador: "gris", librero: "mainecoon" };

/** Raza de cada agente: la que eligió el usuario (botón Skins); si no, la de siempre; para los nuevos, una fija según su nombre. */
export function coatFor(agentId: string, chosen?: string): Coat {
  const known = COATS.find((c) => c.id === (chosen ?? COAT_OF[agentId])) ?? COATS.find((c) => c.id === COAT_OF[agentId]);
  if (known) return known;
  let h = 0;
  for (const ch of agentId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rest = COATS.filter((c) => !Object.values(COAT_OF).includes(c.id));
  return rest[h % rest.length];
}

/** Un gato con el pelaje dado. */
export function catSpecies(coat: Coat): Species {
  const dark = coat.points ?? coat.fur;
  const surf = coat.pattern ?? "fur";
  return {
    id: "gato",
    name: "Gato",
    idea: "Cada agente es un gato de una raza distinta.",
    hands: coat.points ?? coat.socks ?? coat.fur,
    head(kit, g) {
      const fur = coat.fur;
      g.add(at(kit.sphere(0.34, fur, { surface: surf }), 0, 0.3, 0, undefined, [1.08, 0.92, 0.95]));
      for (const s of [-1, 1]) {
        const ear = at(group(), s * 0.21, 0.56, -0.03, coat.fold ? [0.9, 0, s * -0.5] : [0, 0, s * -0.35]);
        const k = coat.fold ? 0.7 : 1;
        ear.add(at(kit.cone(0.11, 0.22 * k, dark, { surface: "fur" }), 0, 0.02, 0), at(kit.cone(0.06, 0.13 * k, "#e8a2ad", { shadow: false }), -s * 0.005, 0.005, 0.03));
        if (coat.tufts) ear.add(at(kit.cone(0.02, 0.1, "#3a2d2a", { seg: 4 }), 0, 0.17, 0));
        g.add(ear);
        // cachetes: redondos, o de pelo largo en punta
        if (coat.fluffy) for (let i = 0; i < 3; i++) g.add(at(kit.cone(0.07, 0.2, fur, { surface: "fur", seg: 5 }), s * (0.3 + i * 0.03), 0.2 - i * 0.07, 0.08, [0, 0, s * (-1.9 - i * 0.25)]));
        else g.add(at(kit.sphere(0.12, fur, { surface: surf, seg: 6 }), s * 0.24, 0.2, 0.1));
      }
      if (coat.points) g.add(at(kit.sphere(0.2, coat.points, { surface: "fur" }), 0, 0.24, 0.17, undefined, [1.15, 1, 0.75])); // máscara
      coat.patches?.forEach((col, i) => g.add(at(kit.sphere(0.2, col, { surface: "fur", seg: 6 }), (i ? 1 : -1) * 0.17, 0.44, 0.02 + i * 0.05, undefined, [1, 0.6, 1.05])));
      g.add(at(kit.sphere(0.13, coat.points ? "#5a463c" : coat.muzzle, { surface: "fur" }), 0, 0.18, 0.25, undefined, [1.35, 0.8, 0.7]));
      g.add(at(kit.box(0.06, 0.04, 0.03, "#e58fa0", { shadow: false }), 0, 0.22, 0.34), at(kit.box(0.012, 0.05, 0.02, "#7a4a52", { shadow: false }), 0, 0.185, 0.345));
      for (const s of [-1, 1]) for (const dy of [0, 0.04]) g.add(at(kit.box(0.18, 0.01, 0.01, "#f6f2ea", { shadow: false }), s * 0.22, 0.17 + dy, 0.27, [0, 0, s * (dy ? 0.12 : -0.05)]));
      if (coat.pattern === "tabby") for (const dx of [-0.08, 0, 0.08]) g.add(at(kit.box(0.035, 0.12, 0.02, "#5a4636", { shadow: false }), dx, 0.52, 0.22, [-0.6, 0, 0]));
      const a: Anchors = { eyeY: 0.33, eyeZ: 0.28, spread: 0.13, earX: 0.34, earY: 0.36, topY: 0.6 };
      return { anchors: a, eyes: eyes(kit, g, a, "iris", 0.07, coat.eyes) };
    },
    body(kit, torso) {
      const tail = at(group(), 0, 0.1, -0.18, [-1.1, 0, 0]);
      let link: THREE.Object3D = tail;
      const r = coat.fluffy ? 0.085 : 0.045;
      for (let i = 0; i < 3; i++) {
        const seg = at(group(), 0, i ? 0.15 : 0, 0, [i ? 0.45 : 0, 0, 0]);
        const col = coat.points ?? (coat.patches ? [coat.fur, ...coat.patches][i % 3] : i === 2 && coat.socks ? coat.socks : coat.fur);
        seg.add(at(kit.cyl(r * (i === 2 ? 0.8 : 1), r * 1.1, 0.17, col, { surface: coat.pattern ?? "fur" }), 0, 0.08, 0));
        if (i === 2) seg.add(at(kit.sphere(r * 0.85, col, { surface: "fur", seg: 6 }), 0, 0.17, 0));
        link.add(seg);
        link = seg;
      }
      torso.add(tail);
      if (coat.fluffy) for (let i = 0; i < 7; i++) torso.add(at(kit.sphere(0.085, coat.muzzle, { surface: "fur", seg: 6 }), Math.sin((i / 7) * Math.PI * 2) * 0.19, 0.47, Math.cos((i / 7) * Math.PI * 2) * 0.15)); // melena
      if (coat.id === "esmoquin") torso.add(at(kit.box(0.2, 0.2, 0.02, coat.muzzle, { shadow: false }), 0, 0.34, 0.185)); // pechera blanca
    },
  };
}

const CAT: Species = catSpecies(COATS[COATS.length - 1]);

const SHEEP: Species = {
  id: "oveja",
  name: "Oveja",
  idea: "Oveja de cara oscura, rulos de lana, cuernitos enrulados y collar de lana.",
  hands: "#3b3236",
  head(kit, g) {
    const face = "#3b3236";
    const wool = "#f3efe6";
    g.add(at(kit.sphere(0.27, face, { surface: "skin" }), 0, 0.26, 0.05, undefined, [0.92, 1.08, 0.92]));
    for (const [x, y, z, r] of [[0, 0.48, -0.03, 0.21], [0.18, 0.42, -0.06, 0.17], [-0.18, 0.42, -0.06, 0.17], [0, 0.4, -0.2, 0.2], [0.14, 0.3, -0.2, 0.15], [-0.14, 0.3, -0.2, 0.15], [0.03, 0.55, 0.12, 0.13], [-0.1, 0.52, 0.1, 0.11]])
      g.add(at(kit.sphere(r, wool, { surface: "fur", seg: 7 }), x, y, z));
    for (const s of [-1, 1]) {
      g.add(at(kit.sphere(0.1, face, { surface: "skin" }), s * 0.3, 0.3, 0, [0, 0, s * 0.4], [1.5, 0.5, 0.75]));
      g.add(at(kit.torus(0.075, 0.032, "#e3cfa6", { arc: Math.PI * 1.6 }), s * 0.23, 0.44, -0.02, [0, Math.PI / 2, s > 0 ? 0 : Math.PI]));
    }
    g.add(at(kit.box(0.07, 0.04, 0.02, "#e58fa0", { shadow: false }), 0, 0.17, 0.3));
    const a: Anchors = { eyeY: 0.29, eyeZ: 0.29, spread: 0.11, earX: 0.27, earY: 0.33, topY: 0.66 };
    return { anchors: a, eyes: eyes(kit, g, a, "light", 0.055) };
  },
  body(kit, torso) {
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2;
      torso.add(at(kit.sphere(0.09, "#f3efe6", { surface: "fur", seg: 6 }), Math.sin(ang) * 0.2, 0.46, Math.cos(ang) * 0.16));
    }
    torso.add(at(kit.sphere(0.1, "#f3efe6", { surface: "fur", seg: 6 }), 0, 0.05, -0.2));
  },
};

/** Caras del robot: grilla de 12x6; cada "#" es un pixel grueso de la pantalla. */
const ROBOT_FACES: Record<string, string[]> = {
  idle: ["", "  ##    ##", "  ##    ##", "", "    ####", ""],
  blink: ["", "", "  ##    ##", "", "    ####", ""],
  working: ["", "  #      #", " # #    # #", "", "   ######", "    ####"],
  sleeping: ["", "", " ###    ###", "", "     ##", ""],
  blocked: [" #  #  #  #", "  ##    ##", " #  #  #  #", "", "  ########", ""],
  waiting_approval: ["  ##    ##", "  ##    ##", "", "     ##", "    #  #", "     ##"],
};

const ROBOT: Species = {
  id: "robot",
  name: "Robot",
  idea: "Robot de lata con pantalla por cara: cambia de expresión según lo que está haciendo.",
  hands: "#8e96a3",
  head(kit, g) {
    const metal = "#c3c9d2";
    g.add(at(kit.box(0.62, 0.5, 0.5, metal, { surface: "metal" }), 0, 0.3, 0));
    g.add(at(kit.box(0.64, 0.05, 0.52, "#8e96a3", { surface: "metal" }), 0, 0.07, 0));
    g.add(at(kit.box(0.52, 0.34, 0.02, "#1b2030"), 0, 0.31, 0.255));
    const faces = new Map<string, THREE.Texture>();
    const faceTex = (key: string) => {
      let t = faces.get(key);
      if (!t) {
        t = canvasTexture(24, 14, (c) => {
          c.fillStyle = "#14192a";
          c.fillRect(0, 0, 24, 14);
          c.fillStyle = key === "blocked" ? "#ff6b6b" : key === "waiting_approval" ? "#ffd166" : "#7df0d0";
          ROBOT_FACES[key].forEach((row, y) => [...row].forEach((ch, x) => ch === "#" && c.fillRect(x * 2, y * 2 + 1, 2, 2)));
        });
        faces.set(key, t);
      }
      return t;
    };
    const screen = kit.glow("#ffffff");
    screen.map = faceTex("idle");
    g.add(at(kit.plane(0.48, 0.3, screen), 0, 0.31, 0.267));
    for (const s of [-1, 1]) {
      g.add(at(kit.cyl(0.08, 0.08, 0.06, "#8e96a3", { surface: "metal" }), s * 0.33, 0.3, 0, [0, 0, Math.PI / 2]));
      g.add(at(kit.cyl(0.05, 0.05, 0.065, kit.glow("#7df0d0")), s * 0.335, 0.3, 0, [0, 0, Math.PI / 2]));
    }
    g.add(at(kit.cyl(0.015, 0.015, 0.22, "#8e96a3"), 0.12, 0.64, 0));
    const tip = kit.glow("#ff6b6b");
    g.add(at(kit.sphere(0.045, tip), 0.12, 0.76, 0));
    let mood: VillageState = "idle";
    let shown = "";
    const a: Anchors = { eyeY: 0.33, eyeZ: 0.27, spread: 0.13, earX: 0.33, earY: 0.36, topY: 0.56 };
    return {
      anchors: a,
      eyes: [],
      setMood: (s) => (mood = s),
      tick(t) {
        tip.color.set(Math.sin(t * 4) > 0 ? "#ff6b6b" : "#5b2330");
        const blink = (mood === "idle" || mood === "moving") && t % 4 < 0.15;
        const key = blink ? "blink" : (ROBOT_FACES[mood] ? mood : "idle");
        if (key !== shown) {
          screen.map = faceTex(key);
          shown = key;
        }
      },
    };
  },
  body(kit, torso) {
    ["#ff6b6b", "#ffd166", "#7df0d0"].forEach((c, i) => torso.add(at(kit.box(0.05, 0.05, 0.02, kit.glow(c)), 0.12 + i * 0.07, 0.36, 0.19)));
  },
};

const MOTH: Species = {
  id: "polilla",
  name: "Lumen (polilla)",
  idea: "La polilla que te gustó, más peluda: cachetes de pelusa, antenas de pluma y alas con ocelos.",
  hands: "#efe2c4",
  head(kit, g) {
    const fluff = "#efe2c4";
    g.add(at(kit.sphere(0.34, fluff, { surface: "fur" }), 0, 0.3, 0));
    for (const s of [-1, 1]) g.add(at(kit.sphere(0.14, "#f7eedb", { surface: "fur", seg: 7 }), s * 0.22, 0.17, 0.12));
    for (const s of [-1, 1]) {
      const ant = at(group(), s * 0.12, 0.58, 0.02, [-0.25, 0, s * -0.4]);
      ant.add(at(kit.cyl(0.014, 0.018, 0.2, "#5a4632"), 0, 0.1, 0));
      for (let i = 0; i < 5; i++) for (const side of [-1, 1]) ant.add(at(kit.box(0.09 - i * 0.012, 0.02, 0.015, "#9b7a4e", { shadow: false }), side * (0.05 - i * 0.006), 0.2 + i * 0.045, 0, [0, 0, side * 0.5]));
      g.add(ant);
    }
    const a: Anchors = { eyeY: 0.31, eyeZ: 0.3, spread: 0.13, earX: 0.33, earY: 0.36, topY: 0.64 };
    return { anchors: a, eyes: eyes(kit, g, a, "big", 0.07) };
  },
  body(kit, torso, rig) {
    const wings = [-1, 1].map((s) => {
      const w = live(at(group(), s * 0.15, 0.32, -0.2, [0.2, s * 0.5, 0])); // aletean
      w.add(at(kit.sphere(0.25, "#c9ac7c", { surface: "fur" }), s * 0.12, 0.05, 0, [0, 0, s * 0.4], [1, 1.35, 0.12]));
      w.add(at(kit.sphere(0.085, "#f3e6c8", { shadow: false }), s * 0.14, 0.12, -0.03, undefined, [1, 1, 0.3]));
      w.add(at(kit.sphere(0.05, "#5a3f2a", { shadow: false }), s * 0.14, 0.12, -0.05, undefined, [1, 1, 0.3]));
      torso.add(w);
      return w;
    });
    for (let i = 0; i < 8; i++) torso.add(at(kit.sphere(0.08, "#f6ecd6", { surface: "fur", seg: 6 }), Math.sin((i / 8) * Math.PI * 2) * 0.19, 0.47, Math.cos((i / 8) * Math.PI * 2) * 0.15));
    const prev = rig.tick;
    rig.tick = (t) => {
      prev?.(t);
      wings.forEach((w, i) => (w.rotation.y = (i ? 1 : -1) * (0.5 + Math.sin(t * 2.2) * 0.12)));
    };
  },
};

export const SPECIES: Species[] = [HUMAN, CAT, SHEEP, ROBOT, MOTH];

// ---------- Skins por rubro ----------

export type Skin = {
  id: string;
  label: string;
  shirt: string;
  pants: string;
  shoes: string;
  /** Delantal o chaleco encima de la remera. */
  apron?: string;
  splatter?: string[];
  /** Franjas reflectivas sobre el chaleco. */
  stripes?: string;
  scarf?: string;
  glasses?: string;
  pencil?: boolean;
  hat?: { kind: "cap" | "hardhat"; color: string };
  headset?: string;
  tie?: string;
  /** Lo que tiene en la mano izquierda. */
  prop?: "magnifier" | "clipboard";
};

/** Skins por rubro (cada agente elige uno en su configuración: world.skin). Sumar un rubro es sumar una entrada. */
export const SKINS: Record<string, Skin> = {
  disenador: {
    id: "disenador",
    label: "Diseñador",
    shirt: "#efe5d1",
    apron: "#3f5a6b",
    pants: "#2f3442",
    shoes: "#e2553f",
    scarf: "#e2553f",
    glasses: "#2b2730",
    pencil: true,
    splatter: ["#e2553f", "#f2b43c", "#5fd38a", "#4d8fe0", "#c17ee0"],
  },
  analista: { id: "analista", label: "Analista", shirt: "#e8e2d4", apron: "#6b7a4f", pants: "#4a3f38", shoes: "#6b4a32", glasses: "#2b2730", hat: { kind: "cap", color: "#8a6a44" }, prop: "magnifier" },
  comunicador: { id: "comunicador", label: "Comunicador", shirt: "#4d8fe0", pants: "#2f3442", shoes: "#f4f1ea", scarf: "#f2b43c", headset: "#2b2730" },
  encargado: { id: "encargado", label: "Encargado", shirt: "#f4f1ea", apron: "#3a3f52", pants: "#2f3442", shoes: "#2b2833", tie: "#c8423a", glasses: "#2b2730", prop: "clipboard" },
  librero: { id: "librero", label: "Librero", shirt: "#efe5d1", apron: "#7a4a6b", pants: "#4a3f38", shoes: "#6b4a32", glasses: "#c9a24a", scarf: "#3f7f76" },
  // Fase 7: el Cobrador (chaleco verde, lentes, planilla) y el de Hosting (casco de obra, como quien mantiene la casa).
  cobrador: { id: "cobrador", label: "Cobrador", shirt: "#f4f1ea", apron: "#3f7f5a", pants: "#2f3442", shoes: "#6b4a32", tie: "#2f6b4a", glasses: "#2b2730", prop: "clipboard" },
  hosting: { id: "hosting", label: "Hosting", shirt: "#3a4a6b", stripes: "#7df0d0", pants: "#2b2833", shoes: "#f4f1ea", headset: "#2b2730", hat: { kind: "hardhat", color: "#4d8fe0" } },
  probador: { id: "probador", label: "Probador", shirt: "#d9d4cc", apron: "#f28a2c", stripes: "#f4f1ea", pants: "#3d4a6b", shoes: "#2b2833", hat: { kind: "hardhat", color: "#f2c94c" }, prop: "clipboard" },
};
export const DESIGNER_SKIN = SKINS.disenador;

function battery(kit: Kit, parent: THREE.Object3D, x: number, y: number, z: number) {
  const shell = at(kit.box(0.15, 0.085, 0.03, "#2a2630"), x, y, z);
  shell.add(at(kit.box(0.02, 0.04, 0.03, "#2a2630"), 0.085, 0, 0));
  const mat = kit.glow("#5fd38a");
  const fill = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.01), mat);
  fill.geometry.translate(0.06, 0, 0); // crece desde la izquierda
  fill.position.set(-0.06, 0, 0.017);
  shell.add(fill);
  parent.add(shell);
  return { fill, mat };
}

export function setBattery(rig: Rig, pct: number) {
  if (!rig.battery) return;
  rig.battery.fill.scale.x = Math.max(0.05, pct / 100);
  rig.battery.mat.color.set(pct > 40 ? "#5fd38a" : pct > 15 ? "#f2b43c" : "#e5534b");
}

/** Arma un agente: raza + skin. Mira hacia +z, con los pies en y = 0. */
export function buildAgent(kit: Kit, sp: Species, skin: Skin): Rig {
  const root = group();
  const legs = [-1, 1].map((side) => {
    const hip = at(group(), side * 0.12, 0.34, 0);
    hip.add(at(kit.cyl(0.08, 0.075, 0.3, skin.pants, { surface: "cloth" }), 0, -0.15, 0));
    hip.add(at(kit.box(0.15, 0.08, 0.23, skin.shoes, { surface: "cloth" }), 0, -0.3, 0.03), at(kit.box(0.155, 0.025, 0.235, "#f4f1ea"), 0, -0.33, 0.03));
    root.add(hip);
    return hip;
  });
  const torso = at(group(), 0, 0.34, 0);
  torso.add(at(kit.box(0.48, 0.46, 0.36, skin.shirt, { surface: "cloth" }), 0, 0.22, 0));
  root.add(torso);
  const [armL, armR] = [-1, 1].map((side) => {
    const sh = at(group(), side * 0.29, 0.74, 0);
    sh.add(at(kit.cyl(0.065, 0.06, 0.3, skin.shirt, { surface: "cloth" }), 0, -0.14, 0));
    sh.add(at(kit.sphere(0.075, sp.hands, { surface: "skin" }), 0, -0.31, 0));
    root.add(sh);
    return sh;
  });
  const head = at(group(), 0, 0.8, 0);
  const h = sp.head(kit, head);
  root.add(head);
  const carry = at(kit.box(0.3, 0.04, 0.24, "#e9d7a4"), 0, -0.3, 0.12);
  carry.visible = false;
  armR.add(carry);
  const rig: Rig = { root, head, armL, armR, legs, eyes: h.eyes, carry, setMood: h.setMood, tick: h.tick };

  // Skin del rubro: delantal o chaleco, pañuelo, lentes, lápiz, gorro, auriculares y lo que lleva en la mano.
  const a = h.anchors;
  if (skin.apron) {
    torso.add(at(kit.box(0.4, 0.38, 0.03, skin.apron, { surface: "cloth" }), 0, 0.18, 0.19));
    for (const s of [-1, 1]) torso.add(at(kit.box(0.05, 0.14, 0.03, skin.apron), s * 0.15, 0.4, 0.19));
    torso.add(at(kit.box(0.16, 0.08, 0.035, "#33495a"), 0.08, 0.08, 0.2), at(kit.cyl(0.012, 0.012, 0.12, "#f2b43c"), 0.04, 0.14, 0.2), at(kit.cyl(0.012, 0.012, 0.1, "#4d8fe0"), 0.1, 0.13, 0.2));
    skin.splatter?.forEach((c, i) => torso.add(at(kit.box(0.035, 0.035, 0.01, c, { shadow: false }), -0.14 + ((i * 0.067) % 0.26), 0.05 + ((i * 0.13) % 0.3), 0.207)));
  }
  if (skin.scarf) torso.add(at(kit.cone(0.15, 0.16, skin.scarf, { surface: "cloth", seg: 4 }), 0, 0.4, 0.16, [Math.PI, Math.PI / 4, 0], [1, 1, 0.45]));
  if (skin.glasses) {
    for (const s of [-1, 1]) head.add(at(kit.torus(0.085, 0.016, skin.glasses), s * a.spread, a.eyeY, a.eyeZ + 0.04));
    head.add(at(kit.box(0.07, 0.02, 0.02, skin.glasses), 0, a.eyeY + 0.01, a.eyeZ + 0.04));
    for (const s of [-1, 1]) head.add(at(kit.box(0.015, 0.015, a.eyeZ, skin.glasses), s * (a.spread + 0.085), a.eyeY, a.eyeZ / 2));
  }
  if (skin.pencil) {
    const pencil = at(group(), a.earX, a.earY + 0.08, -0.03, [0.3, 0, -0.5]);
    pencil.add(kit.cyl(0.022, 0.022, 0.26, "#f2c94c"), at(kit.cone(0.022, 0.06, "#e8c79d"), 0, -0.16, 0, [Math.PI, 0, 0]), at(kit.cyl(0.023, 0.023, 0.04, "#e58fb0"), 0, 0.15, 0));
    head.add(pencil);
  }
  if (skin.tie) torso.add(at(kit.box(0.06, 0.22, 0.02, skin.tie), 0, 0.3, 0.21), at(kit.box(0.08, 0.05, 0.025, skin.tie), 0, 0.42, 0.21));
  if (skin.stripes) for (const y of [0.1, 0.24]) torso.add(at(kit.box(0.41, 0.03, 0.035, skin.stripes, { shadow: false }), 0, y, 0.2));
  if (skin.hat?.kind === "cap") {
    // Boina de vendedor de diarios con visera.
    head.add(at(kit.cyl(0.27, 0.3, 0.1, skin.hat.color, { surface: "cloth", seg: 10 }), 0, a.topY - 0.06, -0.02, [-0.15, 0, 0]), at(kit.box(0.3, 0.025, 0.16, skin.hat.color, { surface: "cloth" }), 0, a.topY - 0.1, 0.26, [0.15, 0, 0]));
  }
  if (skin.hat?.kind === "hardhat") {
    head.add(at(kit.dome(0.3, skin.hat.color), 0, a.topY - 0.12, 0), at(kit.cyl(0.36, 0.36, 0.03, skin.hat.color, { seg: 10 }), 0, a.topY - 0.12, 0.03), at(kit.box(0.05, 0.12, 0.5, skin.hat.color), 0, a.topY + 0.1, 0));
  }
  if (skin.headset) {
    // Vincha sobre la cabeza, auriculares en las orejas y micrófono hacia la boca.
    head.add(at(kit.torus(a.earX + 0.03, 0.022, skin.headset, { arc: Math.PI }), 0, a.earY, 0));
    for (const s of [-1, 1]) head.add(at(kit.cyl(0.09, 0.09, 0.07, skin.headset, { seg: 8 }), s * (a.earX + 0.03), a.earY, 0, [0, 0, Math.PI / 2]), at(kit.cyl(0.06, 0.06, 0.075, kit.glow("#7df0d0"), { seg: 8 }), s * (a.earX + 0.035), a.earY, 0, [0, 0, Math.PI / 2]));
    head.add(at(kit.box(0.02, 0.02, 0.3, skin.headset), -(a.earX - 0.02), a.earY - 0.12, 0.14, [0.3, 0.45, 0]), at(kit.sphere(0.035, "#2b2730", { seg: 6 }), -0.14, a.earY - 0.17, a.eyeZ));
  }
  if (skin.prop === "magnifier") {
    const m = at(group(), 0, -0.33, 0.06, [Math.PI / 2.5, 0, 0]);
    m.add(at(kit.cyl(0.018, 0.018, 0.16, "#6b4a32"), 0, 0.02, 0), at(kit.torus(0.075, 0.016, "#c9a24a"), 0, 0.17, 0), at(kit.cyl(0.07, 0.07, 0.01, kit.glow("#bfe8ff", 0.6), { seg: 10 }), 0, 0.17, 0, [Math.PI / 2, 0, 0]));
    rig.armL!.add(m);
  }
  if (skin.prop === "clipboard") {
    const cb = at(group(), 0, -0.33, 0.08, [Math.PI / 2.6, 0, 0]);
    cb.add(at(kit.box(0.2, 0.26, 0.02, "#8a5a3b", { surface: "wood" }), 0, 0.08, 0), at(kit.box(0.17, 0.2, 0.005, "#f4f1ea", { shadow: false }), 0, 0.07, 0.012), at(kit.box(0.08, 0.03, 0.02, "#c3c9d2"), 0, 0.2, 0.012));
    rig.armL!.add(cb);
  }
  rig.battery = battery(kit, torso, -0.12, 0.33, skin.apron ? 0.22 : 0.19);
  sp.body?.(kit, torso, rig);
  return bakeRig(rig);
}

/** Funde las piezas que se mueven juntas (cada articulación por su lado): de unas 55 piezas a unas 15 por personaje. */
function bakeRig<R extends Rig>(rig: R, more: THREE.Object3D[] = []): R {
  // La batería va entera aparte: su carga se mueve y los retratos la ocultan.
  const joints = [rig.head, rig.armL, rig.armR, ...rig.legs, rig.tail, ...rig.eyes, rig.carry, rig.battery?.fill.parent, ...more].filter((j): j is THREE.Object3D => !!j);
  joints.forEach(live);
  for (const j of [rig.root, rig.head, rig.armL, rig.armR, ...rig.legs, rig.tail, ...more]) if (j) bake(j);
  return rig;
}

// ---------- Mascota ----------

/** Blacky, el gato de la oficina (elegido por el usuario: el ex "Tinto"). */
export const PET = { name: "Blacky", idea: "Gato negro de ojos enormes, collar rojo con cascabel y chapita, y cola larga." };

export function buildBlacky(kit: Kit): Rig & { body: THREE.Object3D; earL: THREE.Object3D; earR: THREE.Object3D } {
  const fur = "#26232b";
  const root = group();
  const body = group();
  body.add(at(kit.sphere(0.22, fur, { surface: "fur" }), 0, 0.3, 0, undefined, [0.95, 0.85, 1.4]));
  body.add(at(kit.sphere(0.12, "#33303a", { surface: "fur" }), 0, 0.26, 0.22, undefined, [1, 1, 0.6]));
  root.add(body);
  const legs = [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ].map(([x, z]) => {
    const p = at(group(), x * 0.11, 0.22, z * 0.19);
    p.add(at(kit.cyl(0.045, 0.045, 0.22, fur, { surface: "fur" }), 0, -0.11, 0));
    root.add(p);
    return p;
  });
  const head = at(group(), 0, 0.5, 0.3);
  head.add(kit.sphere(0.21, fur, { surface: "fur" }));
  const [earL, earR] = [-1, 1].map((s) => {
    const ear = at(group(), s * 0.12, 0.15, -0.02, [0, 0, s * -0.3]);
    ear.add(at(kit.cone(0.075, 0.15, fur, { surface: "fur" }), 0, 0.03, 0), at(kit.cone(0.04, 0.09, "#c98a98", { shadow: false }), 0, 0.02, 0.025));
    head.add(ear);
    return ear;
  });
  const eyeL = at(group(), -0.08, 0.03, 0.17);
  const eyeR = at(group(), 0.08, 0.03, 0.17);
  for (const e of [eyeL, eyeR]) {
    e.add(at(kit.sphere(0.062, "#f3eecf", { shadow: false, seg: 10 }), 0, 0, 0, undefined, [1, 1.15, 0.5]));
    e.add(at(kit.box(0.025, 0.025, 0.02, kit.glow("#ffffff")), 0.02, 0.03, 0.03));
    head.add(e);
  }
  head.add(at(kit.box(0.035, 0.025, 0.02, "#d98a9a", { shadow: false }), 0, -0.04, 0.205));
  for (const s of [-1, 1]) for (const dy of [0, 0.03]) head.add(at(kit.box(0.14, 0.008, 0.008, "#bdb8c4", { shadow: false }), s * 0.17, -0.05 + dy, 0.15, [0, 0, s * (dy ? 0.15 : -0.05)]));
  head.add(at(kit.torus(0.15, 0.025, "#c23b3b"), 0, -0.15, -0.02, [Math.PI / 2.2, 0, 0]));
  head.add(at(kit.sphere(0.04, "#e2b23c"), 0, -0.2, 0.13), at(kit.box(0.05, 0.05, 0.01, "#d9dde3"), 0.07, -0.2, 0.12, [0, 0.3, 0.2]));
  root.add(head);
  const tail = at(group(), 0, 0.34, -0.3);
  let link: THREE.Object3D = tail;
  for (let i = 0; i < 4; i++) {
    const seg = at(group(), 0, i ? 0.13 : 0, 0, [i ? 0.35 : -1.2, 0, 0]);
    seg.add(at(kit.cyl(0.035, 0.04, 0.15, fur, { surface: "fur" }), 0, 0.07, 0));
    link.add(seg);
    link = seg;
  }
  root.add(tail);
  return bakeRig({ root, head, legs, tail, eyes: [eyeL, eyeR], body, earL, earR }, [body, earL, earR]);
}
