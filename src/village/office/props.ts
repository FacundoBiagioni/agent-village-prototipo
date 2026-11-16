// Muebles y decoración de la casa (low poly con texturas de pixeles). Cada pieza mira hacia +z y apoya en y = 0.
// Lo que se mueve va marcado con live(): el resto se funde en pocas mallas (kit.bake).
import * as THREE from "three";
import { at, canvasTexture, group, live, type Kit, type Surface } from "./kit";

export type Frame = (t: number, dt: number, night: number) => void;
/** `light`: luz que la escena prende de noche (`always`: también de día, para lo que está bajo techo). */
export type Ctx = { kit: Kit; frame: (f: Frame) => void; light: (l: THREE.PointLight, max: number, always?: number) => void };

const INK = "#2b2730";
const CREAM = "#f4f1ea";

// ---------- Plantas ----------

export function pot(kit: Kit, color: string, r = 0.26, h = 0.45) {
  return group(at(kit.cyl(r, r * 0.78, h, color), 0, h / 2, 0), at(kit.cyl(r * 0.92, r * 0.92, 0.03, "#4a3a2c"), 0, h - 0.01, 0));
}

/** Planta de hojas grandes (monstera), que se mueve apenas. */
export function monstera(c: Ctx, s = 1, potColor = "#e8dfd0") {
  const { kit } = c;
  const g = group(pot(kit, potColor));
  const leaves = live(group());
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const leaf = at(group(), 0, 0.45, 0, [0, a, 0]);
    leaf.add(at(kit.cyl(0.012, 0.016, 0.5 + (i % 3) * 0.15, "#3f6e3f"), 0, 0.3, 0.12, [0.45, 0, 0]));
    leaf.add(at(kit.sphere(0.2, i % 2 ? "#3f7d47" : "#4c9152", { surface: "leaf", seg: 6 }), 0, 0.6 + (i % 3) * 0.13, 0.32, [0.9, 0, 0], [1, 1.25, 0.12]));
    leaves.add(leaf);
  }
  g.add(leaves);
  g.scale.setScalar(s);
  const phase = s * 7;
  c.frame((t) => (leaves.rotation.z = Math.sin(t * 0.9 + phase) * 0.025));
  return g;
}

export function snakePlant(kit: Kit, s = 1, potColor = "#3f5a6b") {
  const g = group(pot(kit, potColor, 0.2, 0.4));
  for (let i = 0; i < 7; i++) g.add(at(kit.box(0.07, 0.6 + (i % 3) * 0.2, 0.02, i % 2 ? "#4f7d45" : "#6a9a52", { surface: "leaf" }), Math.sin(i * 2.1) * 0.08, 0.7 + (i % 3) * 0.1, Math.cos(i * 2.1) * 0.08, [Math.sin(i) * 0.15, i * 0.9, Math.cos(i) * 0.12]));
  g.scale.setScalar(s);
  return g;
}

/** Ficus: tronco fino y copa de bolas. */
export function ficus(kit: Kit, s = 1, potColor = "#c46a4a") {
  const g = group(pot(kit, potColor, 0.24, 0.4), at(kit.cyl(0.035, 0.05, 0.9, "#6b4a32", { surface: "wood" }), 0, 0.82, 0));
  for (const [x, y, z, r] of [[0, 1.5, 0, 0.36], [0.22, 1.32, 0.1, 0.25], [-0.2, 1.36, -0.08, 0.27], [0.05, 1.78, -0.05, 0.24], [-0.08, 1.3, 0.2, 0.2]]) g.add(at(kit.sphere(r, r > 0.3 ? "#4c9152" : "#5fa860", { surface: "leaf", seg: 6 }), x, y, z));
  g.scale.setScalar(s);
  return g;
}

/** Maceta colgante con enredadera. */
export function hangingPlant(kit: Kit) {
  const g = group(at(kit.cyl(0.006, 0.006, 0.5, INK), 0, 0.25, 0), at(kit.cyl(0.16, 0.11, 0.16, "#e8dfd0"), 0, -0.05, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    for (let j = 0; j < 3 + (i % 2); j++) g.add(at(kit.sphere(0.06, j % 2 ? "#5fa860" : "#4c9152", { surface: "leaf", seg: 5 }), Math.sin(a) * (0.15 + j * 0.02), -0.08 - j * 0.13, Math.cos(a) * (0.15 + j * 0.02)));
  }
  return g;
}

// ---------- Muebles ----------

export function bookshelf(kit: Kit, wood: string, w = 1.6, h = 2, rows = 3) {
  const g = group(at(kit.box(w, h, 0.4, wood, { surface: "wood" }), 0, h / 2, 0));
  const colors = ["#c8423a", "#4d8fe0", "#f2b43c", "#5c9a5b", "#9b6bd6", "#e8dfd0", "#3f5a6b", "#e2553f"];
  const step = (h - 0.35) / rows;
  for (let row = 0; row < rows; row++) {
    const y0 = 0.25 + row * step;
    g.add(at(kit.box(w - 0.08, step - 0.06, 0.02, "#2a2019"), 0, y0 + step / 2 - 0.03, 0.19)); // fondo oscuro del estante
    g.add(at(kit.box(w - 0.08, 0.03, 0.36, "#3a2a20"), 0, y0 - 0.02, 0.03));
    let x = -w / 2 + 0.1;
    for (let i = 0; x < w / 2 - 0.2; i++) {
      const bw = 0.06 + ((i * 7 + row) % 3) * 0.025;
      const bh = Math.min(step - 0.12, 0.28 + ((i * 5 + row) % 4) * 0.04);
      if ((i + row) % 6 === 5) {
        g.add(at(kit.sphere(0.09, "#5c9a5b", { surface: "leaf", seg: 6 }), x + 0.08, y0 + 0.15, 0.1), at(kit.cyl(0.07, 0.06, 0.1, "#c46a4a"), x + 0.08, y0 + 0.05, 0.1));
        x += 0.2;
        continue;
      }
      g.add(at(kit.box(bw, bh, 0.26, colors[(i * 3 + row) % colors.length], { surface: "cloth" }), x + bw / 2, y0 + bh / 2, 0.09, [0, 0, (i + row) % 7 === 3 ? 0.22 : 0]));
      x += bw + 0.012;
    }
  }
  return g;
}

/** Reloj de pared con la hora real. */
export function clock(c: Ctx, rim: string) {
  const { kit } = c;
  const g = group();
  const face = kit.glow("#ffffff");
  face.map = canvasTexture(24, 24, (x) => {
    x.fillStyle = "#f4f1ea";
    x.beginPath();
    x.arc(12, 12, 11, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#2a2630";
    for (let i = 0; i < 12; i++) x.fillRect(Math.round(12 + Math.sin((i / 12) * Math.PI * 2) * 9), Math.round(12 - Math.cos((i / 12) * Math.PI * 2) * 9), 1, 1);
  });
  g.add(at(kit.cyl(0.36, 0.36, 0.06, rim, { seg: 12 }), 0, 0, 0, [Math.PI / 2, 0, 0]), at(kit.plane(0.6, 0.6, face), 0, 0, 0.035));
  const hand = (len: number, wd: number) => {
    const p = live(at(group(), 0, 0, 0.045));
    p.add(at(kit.box(wd, len, 0.01, "#2a2630", { shadow: false }), 0, len / 2, 0));
    g.add(p);
    return p;
  };
  const hr = hand(0.15, 0.035);
  const mn = hand(0.23, 0.025);
  c.frame(() => {
    const now = new Date();
    mn.rotation.z = -((now.getMinutes() + now.getSeconds() / 60) / 60) * Math.PI * 2;
    hr.rotation.z = -(((now.getHours() % 12) + now.getMinutes() / 60) / 12) * Math.PI * 2;
  });
  return g;
}

/** Letrero de neón (texto en pixeles) que titila de vez en cuando. */
export function neonSign(c: Ctx, text: string, color: string, wpx = 96) {
  const { kit } = c;
  const mat = kit.glow("#ffffff");
  mat.transparent = true;
  mat.map = canvasTexture(wpx, 20, (x) => {
    x.font = "bold 13px monospace";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = color + "55";
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) x.fillText(text, wpx / 2 + dx, 11 + dy);
    x.fillStyle = "#ffffff";
    x.fillText(text, wpx / 2, 11);
  });
  c.frame((t) => {
    mat.opacity = Math.sin(t * 13) > 0.6 && Math.sin(t * 0.7) > 0.93 ? 0.35 : 1;
    mat.color.set(color);
  });
  return group(at(kit.box((wpx / 20) * 0.5 + 0.2, 0.62, 0.04, "#1c1a22"), 0, 0, -0.01), at(kit.plane((wpx / 20) * 0.5, 0.5, mat), 0, 0, 0.02));
}

/** Vapor (taza, pava) o humo (chimenea). */
export function steam(c: Ctx, color = "#ffffff", size = 0.04, rise = 0.45) {
  const g = live(group());
  const puffs = [0, 1, 2].map(() => {
    const m = c.kit.glow(color, 0.5);
    m.depthWrite = false;
    const p = c.kit.sphere(size, m, { seg: 5 });
    g.add(p);
    return p;
  });
  c.frame((t) =>
    puffs.forEach((p, i) => {
      const k = (t * 0.45 + i / 3) % 1;
      p.position.set(Math.sin(t * 2 + i) * size, k * rise, 0);
      p.scale.setScalar(0.6 + k * 1.4);
      (p.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - k);
    }),
  );
  return g;
}

export function rug(kit: Kit, w: number, d: number, color: string, border: string, surface: Surface = "cloth") {
  const g = group(at(kit.box(w, 0.02, d, border, { surface: "cloth", shadow: false }), 0, 0.012, 0), at(kit.box(w - 0.3, 0.022, d - 0.3, color, { surface, repeat: [Math.max(1, Math.round(w)), Math.max(1, Math.round(d))], shadow: false }), 0, 0.014, 0));
  for (const s of [-1, 1]) for (let i = 0; i < Math.floor(d / 0.14); i++) g.add(at(kit.box(0.1, 0.012, 0.03, border, { shadow: false }), s * (w / 2 + 0.05), 0.01, -d / 2 + 0.08 + i * 0.14)); // flecos
  return g;
}

export function sofa(kit: Kit, color: string, leg: string, w = 2.2) {
  const g = group();
  g.add(at(kit.box(w, 0.25, 0.85, color, { surface: "cloth" }), 0, 0.3, 0), at(kit.box(w, 0.5, 0.22, color, { surface: "cloth" }), 0, 0.6, -0.32));
  for (const s of [-1, 1]) g.add(at(kit.box(0.2, 0.42, 0.85, color, { surface: "cloth" }), s * (w / 2 - 0.1), 0.42, 0));
  for (let i = 0; i < 2; i++) g.add(at(kit.box(w / 2 - 0.22, 0.12, 0.6, color, { surface: "cloth" }), (i ? 1 : -1) * (w / 4 - 0.05), 0.48, 0.05));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(kit.cyl(0.03, 0.02, 0.18, leg), x * (w / 2 - 0.12), 0.09, z * 0.35));
  g.add(at(kit.box(0.35, 0.3, 0.12, "#e2553f", { surface: "cloth" }), -w / 2 + 0.45, 0.65, -0.15, [0.2, 0.3, 0.1]), at(kit.box(0.32, 0.28, 0.12, "#4d8fe0", { surface: "stripes" }), w / 2 - 0.45, 0.64, -0.15, [0.2, -0.25, -0.1]));
  return g;
}

export function armchair(kit: Kit, color: string, leg = INK) {
  const g = group(at(kit.box(0.9, 0.24, 0.85, color, { surface: "cloth" }), 0, 0.3, 0), at(kit.box(0.9, 0.62, 0.2, color, { surface: "cloth" }), 0, 0.68, -0.33, [-0.12, 0, 0]));
  for (const s of [-1, 1]) g.add(at(kit.box(0.18, 0.4, 0.8, color, { surface: "cloth" }), s * 0.42, 0.44, 0.02), at(kit.cyl(0.1, 0.1, 0.8, color, { surface: "cloth", seg: 6 }), s * 0.42, 0.64, 0.02, [Math.PI / 2, 0, 0]));
  g.add(at(kit.box(0.56, 0.1, 0.56, color, { surface: "cloth" }), 0, 0.46, 0.06), at(kit.box(0.34, 0.3, 0.1, "#f2e46b", { surface: "cloth" }), 0, 0.66, -0.18, [0.25, 0, 0.1]));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(kit.cyl(0.03, 0.02, 0.18, leg), x * 0.36, 0.09, z * 0.33));
  return g;
}

export function floorLamp(c: Ctx, shadeColor: string, metal: string, max = 5) {
  const { kit } = c;
  const g = group();
  g.add(at(kit.cyl(0.18, 0.2, 0.04, metal), 0, 0.02, 0), at(kit.cyl(0.02, 0.02, 1.6, metal), 0, 0.8, 0), at(kit.cyl(0.18, 0.26, 0.3, shadeColor, { surface: "cloth" }), 0, 1.7, 0));
  const bulb = kit.glow("#ffe2a0", 0.3);
  g.add(at(kit.sphere(0.08, bulb, { seg: 6 }), 0, 1.58, 0));
  const l = at(new THREE.PointLight("#ffcf8a", 0, 5.5, 2), 0, 1.5, 0);
  g.add(l);
  c.light(l, max);
  c.frame((_t, _dt, n) => (bulb.opacity = 0.3 + n * 0.7));
  return g;
}

/** Lámpara colgante (cuelga `drop` metros desde su punto). */
export function pendant(c: Ctx, drop: number, color: string, max = 4, always = 0) {
  const { kit } = c;
  const g = group(at(kit.cyl(0.008, 0.008, drop, INK), 0, -drop / 2, 0), at(kit.cone(0.22, 0.2, color, { seg: 8 }), 0, -drop - 0.05, 0), at(kit.cyl(0.04, 0.04, 0.06, INK), 0, -drop + 0.05, 0));
  const bulb = kit.glow("#ffe2a0", 0.5);
  g.add(at(kit.sphere(0.07, bulb, { seg: 6 }), 0, -drop - 0.13, 0));
  const l = at(new THREE.PointLight("#ffd08a", 0, 7, 2), 0, -drop - 0.3, 0);
  g.add(l);
  c.light(l, max, always);
  c.frame((_t, _dt, n) => (bulb.opacity = Math.max(0.45 + always * 0.1, 0.4 + n * 0.6)));
  return g;
}

/** Bichito que vuela en círculos (mariposa de día, luciérnaga de noche). */
export function flyer(c: Ctx, cx: number, cy: number, cz: number, color: string, glowing: boolean) {
  const { kit } = c;
  const m = glowing ? kit.glow(color, 1) : kit.mat(color);
  const b = live(group());
  const wings = [-1, 1].map((s) => {
    const wing = at(kit.box(0.09, 0.005, 0.07, m, { shadow: false }), s * 0.045, 0, 0);
    b.add(wing);
    return wing;
  });
  if (glowing) b.add(kit.sphere(0.03, m, { seg: 5 }));
  const phase = cx * 3 + cz;
  c.frame((t, _dt, n) => {
    const v = glowing ? n : 1 - n;
    b.visible = v > 0.05;
    if (glowing) (m as THREE.MeshBasicMaterial).opacity = v * (0.5 + Math.sin(t * 3 + phase) * 0.5);
    const a = t * 0.5 + phase;
    b.position.set(cx + Math.sin(a) * 0.9, cy + Math.sin(t * 1.3 + phase) * 0.25, cz + Math.cos(a * 1.3) * 0.7);
    b.rotation.y = -a;
    wings.forEach((wg, i) => (wg.rotation.z = (i ? 1 : -1) * Math.abs(Math.sin(t * 14 + phase)) * 1.1));
  });
  return b;
}

/** Cuadro con un dibujo de pixeles. */
export function picture(kit: Kit, w: number, h: number, frame: string, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void) {
  const W = Math.round(w * 20);
  const H = Math.round(h * 20);
  const m = kit.track(new THREE.MeshLambertMaterial({ map: canvasTexture(W, H, (g) => draw(g, W, H)) }));
  return group(at(kit.box(w + 0.1, h + 0.1, 0.05, frame, { surface: "wood" }), 0, 0, 0), at(kit.plane(w, h, m), 0, 0, 0.03));
}

/** Página web en miniatura (las plantillas del Diseñador colgadas en el taller). */
export const webMock = (accent: string, dark = false) => (g: CanvasRenderingContext2D, W: number, H: number) => {
  g.fillStyle = dark ? "#23202b" : "#f6f2ea";
  g.fillRect(0, 0, W, H);
  g.fillStyle = accent;
  g.fillRect(0, 0, W, Math.round(H * 0.42));
  g.fillStyle = dark ? "#f6f2ea" : "#2b2730";
  g.fillRect(2, 2, 5, 1);
  g.fillRect(3, Math.round(H * 0.18), Math.round(W * 0.55), 2);
  g.fillRect(3, Math.round(H * 0.3), Math.round(W * 0.3), 1);
  for (let i = 0; i < 3; i++) {
    g.fillStyle = dark ? "#3a3546" : "#dcd5c8";
    g.fillRect(2 + i * Math.floor((W - 2) / 3), Math.round(H * 0.52), Math.floor((W - 8) / 3), Math.round(H * 0.24));
  }
  g.fillStyle = accent;
  g.fillRect(Math.round(W * 0.35), Math.round(H * 0.84), Math.round(W * 0.3), 2);
};

// ---------- Ventanas ----------

export type ViewTex = { day: THREE.Texture; night: THREE.Texture; clouds: THREE.Texture };

/** Lo que se ve por las ventanas: jardín con árboles (de día con flores, de noche con luciérnagas y luna). */
export function viewTextures(): ViewTex {
  const W = 64;
  const H = 40;
  let s = 11;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const trees = Array.from({ length: 9 }, (_, i) => ({ x: i * 8 + Math.floor(r() * 4), r: 4 + Math.floor(r() * 4) }));
  const draw = (night: boolean) => (g: CanvasRenderingContext2D) => {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, night ? "#0b1530" : "#8cc8ee");
    grad.addColorStop(1, night ? "#22305a" : "#e2f2f2");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    if (night) {
      g.fillStyle = "#f4efcf";
      g.fillRect(50, 5, 5, 5);
      g.fillStyle = "#0b1530";
      g.fillRect(52, 4, 4, 4);
      g.fillStyle = "#fff6c8";
      for (let i = 0; i < 12; i++) g.fillRect(Math.floor(r() * W), Math.floor(r() * 16), 1, 1);
    }
    g.fillStyle = night ? "#1a2a3a" : "#8fbf7a";
    for (let x = 0; x < W; x++) g.fillRect(x, H - 14 - Math.round(Math.sin(x / 9) * 3), 1, 20);
    trees.forEach((tr) => {
      g.fillStyle = night ? "#132230" : "#4f8d55";
      g.fillRect(tr.x - tr.r / 2, H - 14 - tr.r, tr.r, tr.r);
      g.fillStyle = night ? "#0d1822" : "#3d6e45";
      g.fillRect(tr.x, H - 14 - tr.r / 2, tr.r / 2, tr.r / 2);
    });
    g.fillStyle = night ? "#15241c" : "#6aa860";
    g.fillRect(0, H - 8, W, 8);
    for (let i = 0; i < (night ? 8 : 12); i++) {
      g.fillStyle = night ? "#d8f26b" : ["#f29bb5", "#f2e46b", "#ffffff"][i % 3];
      g.fillRect(Math.floor(r() * W), night ? H - 4 - Math.floor(r() * 14) : H - 1 - Math.floor(r() * 6), 1, 1);
    }
  };
  const clouds = canvasTexture(128, 40, (g) => {
    g.fillStyle = "rgba(255,255,255,0.95)";
    for (const [x, y, w] of [[8, 8, 18], [44, 14, 26], [86, 6, 20], [110, 18, 14]]) {
      g.fillRect(x, y, w, 4);
      g.fillRect(x + 3, y - 3, w - 8, 3);
      g.fillRect(x + 6, y - 5, w - 14, 2);
    }
  });
  clouds.wrapS = THREE.RepeatWrapping;
  return { day: canvasTexture(W, H, draw(false)), night: canvasTexture(W, H, draw(true)), clouds };
}

/** Ventana con marco, divisiones, cortinas y un rayo de sol. Centrada en el origen, mirando a +z (pegada a su pared). */
export function windowPane(c: Ctx, tex: ViewTex, o: { w: number; h: number; cols: number; rows: number; frame: string; trim: string; curtain?: string; shaft?: boolean }) {
  const { kit } = c;
  const g = group();
  const dayMat = kit.glow("#ffffff");
  dayMat.map = tex.day;
  const nightMat = kit.glow("#ffffff", 0);
  nightMat.map = tex.night;
  const cloudMat = kit.track(new THREE.MeshBasicMaterial({ map: tex.clouds, transparent: true, opacity: 0.9 }));
  g.add(at(kit.plane(o.w, o.h, dayMat), 0, 0, 0.02), at(kit.plane(o.w, o.h, nightMat), 0, 0, 0.025), at(kit.plane(o.w, o.h * 0.6, cloudMat), 0, o.h * 0.2, 0.03));
  const fw = 0.08;
  g.add(at(kit.box(o.w + fw * 2, fw, 0.12, o.frame, { surface: "wood" }), 0, o.h / 2, 0.06), at(kit.box(o.w + fw * 2, fw, 0.12, o.frame, { surface: "wood" }), 0, -o.h / 2, 0.06));
  for (let i = 0; i <= o.cols; i++) g.add(at(kit.box(i === 0 || i === o.cols ? fw : 0.04, o.h, 0.1, o.frame, { surface: "wood" }), -o.w / 2 + (o.w / o.cols) * i, 0, 0.06));
  for (let j = 1; j < o.rows; j++) g.add(at(kit.box(o.w, 0.04, 0.1, o.frame, { surface: "wood" }), 0, -o.h / 2 + (o.h / o.rows) * j, 0.06));
  g.add(at(kit.box(o.w + 0.3, 0.06, 0.28, o.trim, { surface: "wood" }), 0, -o.h / 2 - 0.04, 0.14));
  if (o.curtain) {
    g.add(at(kit.cyl(0.02, 0.02, o.w + 0.6, INK), 0, o.h / 2 + 0.16, 0.14, [0, 0, Math.PI / 2]));
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.add(at(kit.box(0.13, o.h + 0.25, 0.06, o.curtain, { surface: "cloth" }), s * (o.w / 2 + 0.16 - i * 0.12), 0.02, 0.12 + (i % 2) * 0.03));
  }
  let shaftMat: THREE.MeshBasicMaterial | undefined;
  if (o.shaft !== false) {
    shaftMat = kit.track(new THREE.MeshBasicMaterial({ color: "#fff1c4", transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    g.add(at(kit.plane(o.w * 0.9, 3.2, shaftMat), 0.6, -o.h / 2 - 0.4, 1.4, [-0.95, 0, 0]));
  }
  c.frame((t, _dt, n) => {
    nightMat.opacity = n;
    cloudMat.opacity = 0.9 * (1 - n);
    if (shaftMat) shaftMat.opacity = 0.11 * (1 - n) * (0.85 + Math.sin(t * 0.7) * 0.15);
  });
  return g;
}

// ---------- Escritorio ----------

export function chair(kit: Kit, color: string, leg: string) {
  const c = group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    c.add(at(kit.box(0.04, 0.03, 0.26, leg), Math.sin(a) * 0.12, 0.05, Math.cos(a) * 0.12, [0, a, 0]));
    c.add(at(kit.sphere(0.03, "#222028", { seg: 5 }), Math.sin(a) * 0.24, 0.03, Math.cos(a) * 0.24));
  }
  c.add(at(kit.cyl(0.03, 0.03, 0.3, leg, { surface: "metal" }), 0, 0.22, 0));
  c.add(at(kit.box(0.52, 0.08, 0.48, color, { surface: "cloth" }), 0, 0.4, 0));
  c.add(at(kit.box(0.5, 0.44, 0.07, color, { surface: "cloth" }), 0, 0.72, -0.26, [-0.12, 0, 0]));
  c.add(at(kit.box(0.04, 0.3, 0.04, leg), 0, 0.5, -0.25));
  for (const s of [-1, 1]) c.add(at(kit.box(0.05, 0.03, 0.26, leg), s * 0.28, 0.6, -0.02), at(kit.box(0.03, 0.18, 0.03, leg), s * 0.28, 0.5, -0.1));
  return c;
}

function deskPlant(kit: Kit, kind: number) {
  const p = group(at(kit.cyl(0.07, 0.055, 0.11, ["#e8dfd0", "#c46a4a", "#3f5a6b"][kind % 3]), 0, 0.055, 0));
  if (kind % 2) for (let i = 0; i < 5; i++) p.add(at(kit.box(0.03, 0.2, 0.01, "#4f8d55", { surface: "leaf" }), Math.sin(i * 1.3) * 0.03, 0.18, Math.cos(i * 1.3) * 0.03, [Math.sin(i) * 0.3, i, Math.cos(i) * 0.3]));
  else p.add(at(kit.sphere(0.09, "#5c9a5b", { surface: "leaf", seg: 6 }), 0, 0.16, 0));
  return p;
}

export type DeskLook = { top: string; topSurface: Surface; leg: string; chair: string; accent: string };
export type Desk = {
  group: THREE.Group;
  /** Dónde se sienta el agente y hacia dónde mira. */
  seat: THREE.Vector3;
  rot: number;
  level: number;
  screen: THREE.MeshBasicMaterial;
  screenLight: THREE.PointLight | null;
  lamp: THREE.PointLight | null;
  /** Pasa un punto del escritorio (x al costado, y arriba, z al frente) a coordenadas de la casa. */
  local: (x: number, y: number, z: number, out?: THREE.Vector3) => THREE.Vector3;
};

/** Escritorio con notebook, lámpara y silla. `detail`: el skin del agente que lo ocupa (cada rubro decora el suyo); sin detalle queda libre. */
export function buildDesk(kit: Kit, look: DeskLook, slot: { x: number; y: number; z: number; rot: number; level: number }, index: number, detail?: string): Desk {
  const occupied = !!detail;
  const g = at(group(), slot.x, slot.y, slot.z, [0, slot.rot, 0]);
  const { top, topSurface, leg, accent } = look;
  g.add(at(kit.box(1.5, 0.05, 0.8, top, { surface: topSurface }), 0, 0.725, 0.62));
  g.add(at(kit.box(1.52, 0.02, 0.82, leg, { surface: "metal" }), 0, 0.695, 0.62));
  for (const s of [-1, 1]) for (const dz of [0.3, 0.94]) g.add(at(kit.box(0.04, 0.69, 0.04, leg, { surface: "metal" }), s * 0.68, 0.345, dz));
  for (const s of [-1, 1]) g.add(at(kit.box(0.04, 0.04, 0.64, leg, { surface: "metal" }), s * 0.68, 0.12, 0.62));
  // Cajonera con ruedas debajo, a un costado.
  g.add(at(kit.box(0.4, 0.5, 0.5, top, { surface: topSurface }), 0.45, 0.31, 0.66));
  for (let i = 0; i < 3; i++) g.add(at(kit.box(0.14, 0.02, 0.02, leg), 0.45, 0.16 + i * 0.16, 0.4));
  // Notebook baja: la tapa queda de espaldas al frente sin taparle la cara al agente.
  const LX = -0.22;
  g.add(at(kit.box(0.5, 0.012, 0.34, accent, { surface: "felt" }), LX + 0.05, 0.756, 0.5));
  g.add(at(kit.box(0.5, 0.022, 0.34, "#c3c9d2", { surface: "metal" }), LX, 0.762, 0.55));
  const lid = at(group(), LX, 0.775, 0.72, [occupied ? 0.32 : Math.PI / 2 - 0.02, 0, 0]);
  lid.add(at(kit.box(0.5, 0.33, 0.02, "#c3c9d2", { surface: "metal" }), 0, 0.165, 0), at(kit.box(0.06, 0.06, 0.005, CREAM, { shadow: false }), 0, 0.17, 0.012));
  const screen = kit.accent(kit.glow(occupied ? "#86d4c8" : "#1c1b22"));
  lid.add(at(kit.plane(0.45, 0.27, screen), 0, 0.165, -0.012, [0, Math.PI, 0]));
  g.add(lid);
  // Solo los escritorios ocupados llevan luces de verdad (las luces cuestan).
  const screenLight = occupied ? at(new THREE.PointLight("#86d4c8", 0, 2.2, 2), LX, 1.0, 0.45) : null;
  if (screenLight) g.add(screenLight);
  g.add(at(kit.box(0.06, 0.03, 0.1, "#2a2630"), 0.2, 0.765, 0.48));
  const lampG = at(group(), -0.6, 0.75, 0.95);
  lampG.add(kit.cyl(0.07, 0.08, 0.03, leg), at(kit.cyl(0.012, 0.012, 0.3, leg), 0, 0.15, 0, [0.35, 0, 0]), at(kit.cyl(0.012, 0.012, 0.25, leg), 0, 0.3, -0.15, [-1.1, 0, 0]));
  lampG.add(at(kit.cone(0.08, 0.1, accent), 0, 0.32, -0.3, [Math.PI + 0.4, 0, 0]), at(kit.sphere(0.03, kit.glow("#ffe2a0")), 0, 0.29, -0.31));
  const lamp = occupied ? at(new THREE.PointLight("#ffcf7a", 0, 3, 2), 0, 0.2, -0.32) : null;
  if (lamp) lampG.add(lamp);
  g.add(lampG);
  const ch = chair(kit, look.chair, leg);
  if (!occupied) at(ch, 0.1, 0, -0.2, [0, 0.4 - (index % 3) * 0.3, 0]);
  g.add(ch);
  const side = (...o: THREE.Object3D[]) => {
    const b = at(group(), -0.73, 0.75, 0.3, [0, Math.PI / 2, 0]);
    b.add(at(kit.box(0.02, 0.2, 0.02, leg), 0, 0, -0.01), ...o);
    g.add(b);
    return b;
  };
  if (detail === "disenador") {
    // Abanico de muestras, tableta con lápiz, taza y tablero de inspiración.
    const fan = at(group(), 0.5, 0.76, 0.86);
    ["#e2553f", "#f2b43c", "#5fd38a", "#4d8fe0", "#c17ee0"].forEach((c, i) => fan.add(at(kit.box(0.06, 0.012, 0.26, c), 0, i * 0.006, 0, [0, -0.5 + i * 0.25, 0])));
    g.add(fan, at(kit.box(0.28, 0.015, 0.2, "#2a2630"), 0.32, 0.757, 0.5, [0, -0.3, 0]), at(kit.cyl(0.01, 0.01, 0.2, CREAM), 0.36, 0.77, 0.45, [0, 0.4, Math.PI / 2]), at(kit.cyl(0.05, 0.045, 0.1, "#e2553f"), 0.62, 0.8, 0.48));
    const board = side(at(kit.box(0.5, 0.36, 0.02, "#c99f6b", { surface: "felt" }), 0, 0.2, 0));
    ["#f29bb5", "#8fd3f2", "#f2e46b", "#a6e39a"].forEach((c, i) => board.add(at(kit.box(0.13, 0.11, 0.01, c, { shadow: false }), -0.14 + (i % 2) * 0.24 + (i > 1 ? 0.04 : 0), 0.28 - Math.floor(i / 2) * 0.15, 0.015, [0, 0, (i - 1.5) * 0.1])));
  } else if (detail === "analista") {
    // Carpetas apiladas, lupa y un mapa con chinches.
    for (let i = 0; i < 4; i++) g.add(at(kit.box(0.3, 0.035, 0.22, ["#c9a24a", "#4d8fe0", "#e2553f", "#5fd38a"][i]), 0.5, 0.765 + i * 0.037, 0.85, [0, (i - 1.5) * 0.12, 0]));
    g.add(at(kit.torus(0.06, 0.012, "#c9a24a"), 0.3, 0.76, 0.48, [Math.PI / 2, 0, 0]), at(kit.box(0.02, 0.012, 0.12, "#6b4a32"), 0.36, 0.76, 0.4, [0, 0.6, 0]));
    const map = side(at(kit.box(0.5, 0.36, 0.02, "#e8dfc4", { surface: "cloth" }), 0, 0.2, 0));
    for (const [x, y] of [[-0.15, 0.3], [0.05, 0.18], [0.16, 0.3], [-0.05, 0.1]]) map.add(at(kit.sphere(0.02, "#e2553f", { seg: 5 }), x, y, 0.02));
  } else if (detail === "comunicador") {
    // Sobres apilados, avioncito de papel y una taza.
    for (let i = 0; i < 3; i++) g.add(at(kit.box(0.2, 0.012, 0.13, CREAM), 0.45, 0.757 + i * 0.013, 0.88, [0, i * 0.2, 0]));
    g.add(at(kit.cone(0.06, 0.18, CREAM, { seg: 3 }), 0.2, 0.78, 0.9, [Math.PI / 2, 0, 0.3], [1, 1, 0.3]), at(kit.cyl(0.05, 0.045, 0.1, "#4d8fe0"), 0.6, 0.8, 0.5));
    side(at(kit.box(0.5, 0.36, 0.02, CREAM), 0, 0.2, 0), at(kit.box(0.4, 0.03, 0.01, "#4d8fe0", { shadow: false }), 0, 0.3, 0.015), at(kit.box(0.3, 0.03, 0.01, "#f2b43c", { shadow: false }), -0.05, 0.22, 0.015), at(kit.box(0.36, 0.03, 0.01, "#5fd38a", { shadow: false }), -0.02, 0.14, 0.015));
  } else if (detail === "encargado") {
    // Pizarrita con el plan del día, campanita y bandeja de papeles.
    const board = side(at(kit.box(0.5, 0.36, 0.02, CREAM), 0, 0.2, 0));
    for (let i = 0; i < 4; i++) board.add(at(kit.box(0.3 - (i % 2) * 0.08, 0.025, 0.01, ["#5fd38a", "#5fd38a", "#f2b43c", INK][i], { shadow: false }), -0.02, 0.32 - i * 0.07, 0.015));
    g.add(at(kit.dome(0.07, "#e2b23c"), 0.3, 0.75, 0.5), at(kit.cyl(0.08, 0.08, 0.015, INK), 0.3, 0.757, 0.5));
    g.add(at(kit.box(0.34, 0.05, 0.26, "#6b4a32", { surface: "wood" }), 0.5, 0.775, 0.85), at(kit.box(0.3, 0.02, 0.22, CREAM), 0.5, 0.805, 0.85, [0, 0.1, 0]));
  } else if (detail) {
    // Cualquier otro agente: taza y cuaderno.
    g.add(at(kit.cyl(0.05, 0.045, 0.1, accent), 0.55, 0.8, 0.5), at(kit.box(0.26, 0.02, 0.2, "#4d8fe0"), 0.4, 0.76, 0.85, [0, 0.2, 0]));
  } else {
    g.add(at(deskPlant(kit, index), 0.5, 0.75, 0.86));
    if (index % 2) g.add(at(kit.box(0.09, 0.09, 0.005, ["#f2e46b", "#f29bb5", "#8fd3f2"][index % 3], { shadow: false }), -0.2, 0.755, 0.45, [-Math.PI / 2, 0, 0.3]));
  }
  const cos = Math.cos(slot.rot);
  const sin = Math.sin(slot.rot);
  const local = (x: number, y: number, z: number, out = new THREE.Vector3()) => out.set(slot.x + x * cos + z * sin, slot.y + y, slot.z - x * sin + z * cos);
  return { group: g, seat: new THREE.Vector3(slot.x, slot.y + 0.1, slot.z), rot: slot.rot, level: slot.level, screen, screenLight, lamp, local };
}

export function meetingTable(kit: Kit, look: DeskLook) {
  const g = group();
  g.add(at(kit.cyl(1.0, 1.0, 0.06, look.top, { surface: look.topSurface, seg: 12 }), 0, 0.74, 0), at(kit.cyl(0.08, 0.12, 0.7, look.leg, { surface: "metal" }), 0, 0.37, 0), at(kit.cyl(0.4, 0.45, 0.04, look.leg), 0, 0.02, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const s = at(group(), Math.sin(a) * 1.35, 0, Math.cos(a) * 1.35, [0, a + Math.PI, 0]);
    s.add(at(kit.cyl(0.22, 0.2, 0.08, look.chair, { surface: "cloth" }), 0, 0.46, 0), at(kit.cyl(0.03, 0.03, 0.42, look.leg), 0, 0.22, 0), at(kit.cyl(0.18, 0.18, 0.02, look.leg), 0, 0.01, 0), at(kit.box(0.4, 0.22, 0.05, look.chair, { surface: "cloth" }), 0, 0.64, -0.2));
    g.add(s);
  }
  g.add(at(kit.cyl(0.07, 0.09, 0.22, "#e8dfd0"), 0.1, 0.88, -0.1), at(kit.sphere(0.06, "#f29bb5", { seg: 6 }), 0.1, 1.02, -0.1), at(kit.sphere(0.05, "#f2e46b", { seg: 6 }), 0.16, 0.99, -0.06));
  g.add(at(kit.box(0.3, 0.01, 0.22, CREAM), -0.4, 0.775, 0.2, [0, 0.4, 0]), at(kit.box(0.3, 0.01, 0.22, "#e8dfd0"), -0.35, 0.785, 0.22, [0, 0.2, 0]));
  return g;
}

/** Cama de Blacky, con su nombre, los platitos y un ovillo. */
export function petBed(kit: Kit) {
  const g = group();
  g.add(at(kit.torus(0.45, 0.15, "#c23b3b", { surface: "cloth" }), 0, 0.13, 0, [Math.PI / 2, 0, 0]), at(kit.cyl(0.44, 0.46, 0.1, "#f0d9b5", { surface: "cloth", seg: 10 }), 0, 0.06, 0));
  const plate = kit.glow("#ffffff");
  plate.map = canvasTexture(48, 12, (c) => {
    c.fillStyle = "#26232b";
    c.fillRect(0, 0, 48, 12);
    c.fillStyle = "#f3eecf";
    c.font = "bold 9px monospace";
    c.textBaseline = "middle";
    c.fillText("BLACKY", 6, 7);
  });
  g.add(at(kit.box(0.7, 0.2, 0.03, "#26232b"), 0, 0.12, -0.62), at(kit.plane(0.66, 0.16, plate), 0, 0.13, -0.6));
  g.add(at(kit.cyl(0.13, 0.11, 0.07, "#4d8fe0"), 0.75, 0.035, -0.2), at(kit.cyl(0.1, 0.1, 0.02, "#8a6a44"), 0.75, 0.065, -0.2), at(kit.cyl(0.13, 0.11, 0.07, "#4d8fe0"), 0.75, 0.035, 0.15), at(kit.cyl(0.1, 0.1, 0.02, "#8fd3f2"), 0.75, 0.065, 0.15));
  g.add(at(kit.sphere(0.08, "#e58fa0", { surface: "cloth", seg: 6 }), 0.55, 0.08, 0.55));
  return g;
}

// ---------- Piezas nuevas de la casa ----------

/** Hogar a leña con chimenea que sube `h` metros. El fuego titila y da luz siempre (más de noche). */
export function fireplace(c: Ctx, h: number) {
  const { kit } = c;
  const stone = "#a59c8e";
  const g = group();
  for (const s of [-1, 1]) g.add(at(kit.box(0.55, 1.3, 0.7, stone, { surface: "stone" }), s * 0.93, 0.65, 0.35));
  g.add(at(kit.box(2.4, 0.5, 0.7, stone, { surface: "stone", repeat: [2, 1] }), 0, 1.55, 0.35), at(kit.box(2.4, 1.3, 0.12, "#2a2422"), 0, 0.65, 0.06), at(kit.box(1.3, 0.08, 0.7, "#3a3432"), 0, 0.04, 0.35));
  g.add(at(kit.box(2.8, 0.12, 0.9, "#6b4a32", { surface: "wood" }), 0, 1.86, 0.4)); // repisa
  g.add(at(kit.box(1.6, h - 1.9, 0.5, stone, { surface: "stone", repeat: [1, 3] }), 0, 1.9 + (h - 1.9) / 2, 0.25));
  g.add(at(kit.box(1.8, 0.14, 0.6, "#8d8478", { surface: "stone" }), 0, h + 0.07, 0.25));
  // leños y brasas
  for (let i = 0; i < 3; i++) g.add(at(kit.cyl(0.07, 0.07, 0.8, "#5a3d2a", { surface: "wood", seg: 6 }), -0.1 + i * 0.1, 0.14 + (i % 2) * 0.1, 0.38, [0, 0.3 - i * 0.3, Math.PI / 2]));
  const ember = kit.accent(kit.glow("#ff7a2e"));
  g.add(at(kit.box(0.8, 0.05, 0.3, ember), 0, 0.1, 0.38));
  const flames = [0, 1, 2, 3].map((i) => {
    const f = live(at(kit.cone(0.16 - i * 0.02, 0.5 - i * 0.05, kit.accent(kit.glow(["#ff8a2e", "#ffb347", "#ffe27a", "#ff6b2e"][i], 0.92)), { seg: 5 }), -0.27 + i * 0.18, 0.42, 0.4));
    g.add(f);
    return f;
  });
  const l = at(new THREE.PointLight("#ff9a4a", 0, 9, 2), 0, 0.8, 1.1);
  g.add(l);
  c.frame((t, _dt, n) => {
    flames.forEach((f, i) => {
      const k = 0.8 + Math.sin(t * (7 + i * 1.7) + i * 2) * 0.22 + Math.sin(t * 13 + i) * 0.08;
      f.scale.set(1, k, 1);
      f.position.y = 0.2 + 0.24 * k;
    });
    l.intensity = (2.5 + n * 5) * (0.85 + Math.sin(t * 9) * 0.1 + Math.sin(t * 23) * 0.05);
    ember.color.setHSL(0.06, 1, 0.5 + Math.sin(t * 3) * 0.06);
  });
  // sobre la repisa: velas, reloj de arena y un retrato de Blacky
  g.add(at(kit.cyl(0.04, 0.04, 0.22, CREAM), -1.1, 2.03, 0.45), at(kit.sphere(0.03, kit.glow("#ffd27a"), { seg: 5 }), -1.1, 2.17, 0.45), at(kit.cyl(0.04, 0.04, 0.14, CREAM), -0.95, 1.99, 0.5), at(kit.sphere(0.03, kit.glow("#ffd27a"), { seg: 5 }), -0.95, 2.09, 0.5));
  g.add(
    at(
      picture(kit, 0.5, 0.5, "#c9a24a", (x, W, H) => {
        x.fillStyle = "#7fa6c0";
        x.fillRect(0, 0, W, H);
        x.fillStyle = "#26232b";
        x.fillRect(3, 4, 4, 5);
        x.fillRect(2, 2, 2, 2);
        x.fillRect(6, 2, 2, 2);
        x.fillStyle = "#f3eecf";
        x.fillRect(3, 5, 1, 1);
        x.fillRect(6, 5, 1, 1);
      }),
      0.85, 2.2, 0.5, [-0.12, 0, 0],
    ),
  );
  // leñero al costado
  for (let i = 0; i < 6; i++) g.add(at(kit.cyl(0.07, 0.07, 0.5, i % 2 ? "#6b4a32" : "#7d5a3c", { surface: "wood", seg: 6 }), 1.55 + (i % 3) * 0.15, 0.08 + Math.floor(i / 3) * 0.14, 0.4, [Math.PI / 2, 0, 0]));
  return g;
}

/** Cocina: mesada contra la pared con heladera, anafe, pava que humea, alacenas y bacha. Ancho ~4.6. */
export function kitchen(c: Ctx) {
  const { kit } = c;
  const g = group();
  const wood = "#e3d6bd";
  g.add(at(kit.box(3.4, 0.9, 0.65, wood, { surface: "wood" }), 0.55, 0.45, 0.33), at(kit.box(3.5, 0.06, 0.72, "#5a5560", { surface: "concrete" }), 0.55, 0.93, 0.36));
  for (let i = 0; i < 5; i++) g.add(at(kit.box(0.6, 0.7, 0.02, "#d2c3a6", { surface: "wood" }), -0.85 + i * 0.68, 0.45, 0.67), at(kit.sphere(0.025, INK, { seg: 5 }), -0.65 + i * 0.68, 0.6, 0.69));
  // heladera retro
  g.add(at(kit.box(0.85, 2.0, 0.75, "#8ec3b9", { surface: "metal" }), -1.75, 1.0, 0.38), at(kit.box(0.86, 0.02, 0.76, "#6fa39a"), -1.75, 1.35, 0.38));
  for (const y of [1.0, 1.55]) g.add(at(kit.box(0.04, 0.3, 0.05, "#d9dde3", { surface: "metal" }), -1.42, y, 0.78));
  ["#e2553f", "#f2e46b", "#4d8fe0"].forEach((col, i) => g.add(at(kit.box(0.09, 0.09, 0.01, col, { shadow: false }), -1.95 + i * 0.16, 1.65 - (i % 2) * 0.12, 0.76)));
  // anafe y pava
  g.add(at(kit.box(0.7, 0.03, 0.55, "#26232b"), 0.2, 0.975, 0.36));
  for (const [x, z] of [[-0.16, 0.25], [0.16, 0.25], [-0.16, 0.5], [0.16, 0.5]]) g.add(at(kit.cyl(0.09, 0.09, 0.012, "#4f4b57", { seg: 8 }), 0.2 + x, 0.995, z));
  g.add(at(kit.cyl(0.11, 0.13, 0.16, "#e2553f", { seg: 8 }), 0.04, 1.08, 0.25), at(kit.torus(0.08, 0.012, INK, { arc: Math.PI }), 0.04, 1.17, 0.25), at(kit.cone(0.03, 0.12, "#e2553f", { seg: 5 }), 0.17, 1.12, 0.25, [0, 0, -1.1]));
  g.add(at(steam(c), 0.2, 1.2, 0.25));
  // bacha con canilla
  g.add(at(kit.box(0.6, 0.02, 0.42, "#c3c9d2", { surface: "metal" }), 1.5, 0.965, 0.36), at(kit.box(0.5, 0.02, 0.32, "#8e96a3"), 1.5, 0.95, 0.36), at(kit.cyl(0.02, 0.02, 0.25, "#c3c9d2", { surface: "metal" }), 1.5, 1.08, 0.1), at(kit.box(0.03, 0.03, 0.16, "#c3c9d2"), 1.5, 1.2, 0.17));
  // alacenas y estante con frascos
  g.add(at(kit.box(2.2, 0.7, 0.36, wood, { surface: "wood" }), 0.1, 2.25, 0.18));
  for (let i = 0; i < 3; i++) g.add(at(kit.box(0.68, 0.6, 0.02, "#d2c3a6", { surface: "wood" }), -0.6 + i * 0.72, 2.25, 0.37));
  g.add(at(kit.box(1.1, 0.04, 0.26, "#6b4a32", { surface: "wood" }), 1.85, 1.95, 0.13));
  for (let i = 0; i < 4; i++) g.add(at(kit.cyl(0.07, 0.07, 0.18 + (i % 2) * 0.06, ["#f4f1ea", "#c46a4a", "#5c9a5b", "#f2b43c"][i]), 1.45 + i * 0.26, 2.07 + (i % 2) * 0.03, 0.13));
  // cafetera y tazas
  g.add(at(kit.box(0.3, 0.4, 0.3, "#2b2730", { surface: "metal" }), 2.0, 1.16, 0.3), at(kit.box(0.2, 0.05, 0.16, "#e2553f"), 2.0, 1.02, 0.45));
  for (let i = 0; i < 3; i++) g.add(at(kit.cyl(0.045, 0.04, 0.09, ["#e2553f", CREAM, "#4d8fe0"][i]), 0.75 + i * 0.13, 1.0, 0.5));
  // sartenes colgadas
  for (let i = 0; i < 3; i++) g.add(at(kit.cyl(0.11 - i * 0.015, 0.11 - i * 0.015, 0.03, "#3a3540", { seg: 8 }), -0.7 + i * 0.3, 1.55, 0.06, [Math.PI / 2, 0, 0]), at(kit.box(0.025, 0.2, 0.02, "#3a3540"), -0.7 + i * 0.3, 1.74, 0.05));
  return g;
}

/** Isla de cocina con banquetas, frutera y la alcancía (el menú Caja). */
export function island(kit: Kit) {
  const g = group(at(kit.box(2.2, 0.86, 0.9, "#8ec3b9", { surface: "wood" }), 0, 0.43, 0), at(kit.box(2.4, 0.07, 1.05, "#d8b98e", { surface: "wood", repeat: [2, 1] }), 0, 0.9, 0));
  for (const x of [-0.7, 0, 0.7]) g.add(at(kit.cyl(0.19, 0.19, 0.06, "#c46a4a", { surface: "cloth", seg: 8 }), x, 0.62, 0.85), at(kit.cyl(0.025, 0.025, 0.6, INK), x, 0.3, 0.85), at(kit.cyl(0.16, 0.16, 0.02, INK, { seg: 8 }), x, 0.01, 0.85));
  g.add(at(kit.cyl(0.2, 0.12, 0.09, "#f4f1ea", { seg: 8 }), 0.75, 0.98, -0.05));
  [["#e2553f", 0.68, 0.02], ["#f2b43c", 0.82, -0.02], ["#6aa860", 0.74, -0.14], ["#f2e46b", 0.78, 0.08]].forEach(([col, x, z]) => g.add(at(kit.sphere(0.07, col as string, { seg: 6 }), x as number, 1.05, z as number)));
  return g;
}

/** Alcancía chanchito con una moneda entrando. */
export function piggy(c: Ctx) {
  const { kit } = c;
  const pink = "#f2a0ad";
  const g = group(at(kit.sphere(0.2, pink, { seg: 8 }), 0, 0.22, 0, undefined, [1.25, 1, 1]), at(kit.cyl(0.07, 0.07, 0.06, "#e58fa0", { seg: 8 }), 0.26, 0.22, 0, [0, 0, Math.PI / 2]));
  for (const [x, z] of [[-0.13, -0.1], [0.13, -0.1], [-0.13, 0.1], [0.13, 0.1]]) g.add(at(kit.cyl(0.04, 0.04, 0.1, pink, { seg: 6 }), x, 0.05, z));
  for (const s of [-1, 1]) g.add(at(kit.cone(0.05, 0.09, "#e58fa0", { seg: 4 }), 0.12, 0.42, s * 0.09), at(kit.sphere(0.02, INK, { seg: 5 }), 0.22, 0.28, s * 0.07));
  g.add(at(kit.box(0.14, 0.01, 0.03, INK, { shadow: false }), -0.02, 0.425, 0));
  const coin = live(at(kit.cyl(0.07, 0.07, 0.015, kit.accent(kit.glow("#ffc93c")), { seg: 10 }), -0.02, 0.6, 0, [Math.PI / 2, 0, 0]));
  g.add(coin);
  c.frame((t) => {
    const k = (t * 0.5) % 1;
    coin.position.y = 0.75 - Math.min(1, k * 2.2) * 0.3;
    coin.rotation.z = t * 5;
    coin.visible = k < 0.55;
  });
  return g;
}

/** Escalera recta que sube `rise` en `run` metros hacia -z, con baranda del lado +x. */
export function stairs(kit: Kit, rise: number, run: number, w = 1.1, wood = "#b98a5c") {
  const g = group();
  const n = 13;
  for (let i = 0; i < n; i++) {
    const y = ((i + 1) / n) * rise;
    g.add(at(kit.box(w, 0.07, run / n + 0.04, wood, { surface: "wood" }), 0, y - 0.035, -(i + 0.5) * (run / n)));
    g.add(at(kit.box(w - 0.1, y - 0.07, 0.04, "#efe5d1"), 0, (y - 0.07) / 2, -(i + 1) * (run / n) + 0.02)); // contrahuella
  }
  const len = Math.hypot(rise, run);
  const ang = Math.atan2(rise, run);
  g.add(at(kit.box(0.06, 0.07, len + 0.3, "#6b4a32", { surface: "wood" }), w / 2, rise / 2 + 0.95, -run / 2, [ang, 0, 0]));
  for (let i = 0; i <= 6; i++) g.add(at(kit.box(0.05, 0.95, 0.05, "#efe5d1"), w / 2, (i / 6) * rise + 0.48, -(i / 6) * run));
  return g;
}

/** Baranda recta de `len` metros a lo largo de x. */
export function railing(kit: Kit, len: number, wood = "#6b4a32") {
  const g = group(at(kit.box(len, 0.07, 0.09, wood, { surface: "wood" }), 0, 1.0, 0), at(kit.box(len, 0.04, 0.04, "#efe5d1"), 0, 0.12, 0));
  const n = Math.max(1, Math.round(len / 0.28));
  for (let i = 0; i <= n; i++) g.add(at(kit.box(i % 5 === 0 ? 0.08 : 0.035, 1.0, i % 5 === 0 ? 0.08 : 0.035, i % 5 === 0 ? wood : "#efe5d1"), -len / 2 + (len / n) * i, 0.5, 0));
  return g;
}

/** Rascador de gatos con plataformas, cueva y un ratoncito colgando. */
export function catTree(c: Ctx) {
  const { kit } = c;
  const g = group(at(kit.box(0.9, 0.08, 0.9, "#d9c7a3", { surface: "cloth" }), 0, 0.04, 0));
  g.add(at(kit.cyl(0.07, 0.07, 1.9, "#c9a877", { surface: "stripes", seg: 8 }), -0.25, 1.0, -0.2), at(kit.cyl(0.07, 0.07, 1.1, "#c9a877", { surface: "stripes", seg: 8 }), 0.28, 0.6, 0.2));
  g.add(at(kit.box(0.6, 0.06, 0.6, "#8fb9a8", { surface: "cloth" }), 0.25, 1.17, 0.2), at(kit.box(0.7, 0.06, 0.6, "#8fb9a8", { surface: "cloth" }), -0.2, 1.97, -0.2), at(kit.box(0.5, 0.4, 0.5, "#d9c7a3", { surface: "cloth" }), -0.2, 0.3, -0.2), at(kit.cyl(0.14, 0.14, 0.02, "#26232b", { seg: 8 }), -0.2, 0.3, 0.06, [Math.PI / 2, 0, 0]));
  const toy = live(at(group(at(kit.cyl(0.004, 0.004, 0.4, INK), 0, -0.2, 0), at(kit.sphere(0.05, "#9aa0ad", { seg: 5 }), 0, -0.42, 0)), 0.5, 1.14, 0.42));
  g.add(toy);
  c.frame((t) => (toy.rotation.z = Math.sin(t * 1.8) * 0.35));
  return g;
}

/** Pecera con dos peces que nadan. */
export function fishTank(c: Ctx) {
  const { kit } = c;
  const g = group(at(kit.box(0.9, 0.5, 0.45, "#6b4a32", { surface: "wood" }), 0, 0.25, 0), at(kit.box(0.84, 0.5, 0.4, kit.glow("#8fd3f2", 0.45)), 0, 0.77, 0), at(kit.box(0.88, 0.04, 0.44, INK), 0, 1.04, 0), at(kit.box(0.8, 0.04, 0.36, "#e8d9a8"), 0, 0.54, 0));
  g.add(at(kit.box(0.03, 0.22, 0.03, "#5c9a5b", { surface: "leaf" }), -0.28, 0.67, -0.05, [0, 0, 0.15]), at(kit.box(0.03, 0.3, 0.03, "#4c9152", { surface: "leaf" }), -0.2, 0.7, 0.05, [0, 0, -0.1]));
  const fish = ["#ff8a2e", "#ffd166"].map((col, i) => {
    const f = live(group(at(kit.box(0.1, 0.06, 0.03, kit.glow(col)), 0, 0, 0), at(kit.box(0.04, 0.07, 0.02, kit.glow(col)), -0.07, 0, 0)));
    g.add(f);
    c.frame((t) => {
      const a = t * (0.7 + i * 0.3) + i * 3;
      f.position.set(Math.sin(a) * 0.28, 0.75 + i * 0.1 + Math.sin(t * 1.3 + i) * 0.04, Math.cos(a) * 0.08);
      f.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
    });
    return f;
  });
  void fish;
  return g;
}

/** Caballete con una demo a medio pintar. */
export function easel(kit: Kit) {
  const g = group();
  for (const [x, r] of [[-0.3, 0.12], [0.3, -0.12]]) g.add(at(kit.box(0.05, 1.9, 0.05, "#8a5a3b", { surface: "wood" }), x, 0.92, 0, [-0.12, 0, r]));
  g.add(at(kit.box(0.05, 1.8, 0.05, "#8a5a3b", { surface: "wood" }), 0, 0.85, -0.45, [0.4, 0, 0]), at(kit.box(0.9, 0.05, 0.12, "#8a5a3b", { surface: "wood" }), 0, 0.72, 0.05));
  g.add(at(picture(kit, 1.0, 0.8, CREAM, webMock("#e2553f")), 0, 1.2, 0.05, [-0.12, 0, 0]));
  ["#e2553f", "#f2b43c", "#4d8fe0"].forEach((c, i) => g.add(at(kit.cyl(0.035, 0.035, 0.07, c, { seg: 6 }), -0.3 + i * 0.12, 0.78, 0.07)));
  return g;
}

/** Mapa grande de La Plata (cuadrícula con diagonales) con chinches. Centrado, mirando a +z. */
export function cityMap(kit: Kit, w: number, h: number) {
  const g = picture(kit, w, h, "#6b4a32", (x, W, H) => {
    x.fillStyle = "#efe6cc";
    x.fillRect(0, 0, W, H);
    x.fillStyle = "#cfe3b8";
    x.fillRect(Math.round(W * 0.42), Math.round(H * 0.3), Math.round(W * 0.16), Math.round(H * 0.4)); // el bosque
    x.strokeStyle = "#c9b68e";
    x.lineWidth = 1;
    for (let i = 4; i < W; i += 6) {
      x.beginPath();
      x.moveTo(i + 0.5, 0);
      x.lineTo(i + 0.5, H);
      x.stroke();
    }
    for (let j = 4; j < H; j += 6) {
      x.beginPath();
      x.moveTo(0, j + 0.5);
      x.lineTo(W, j + 0.5);
      x.stroke();
    }
    x.strokeStyle = "#b08a5a"; // las diagonales
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(W, H);
    x.moveTo(W, 0);
    x.lineTo(0, H);
    x.stroke();
    x.fillStyle = "#7fb8e8";
    x.fillRect(0, H - 3, W, 3); // el río
  });
  [["#e2553f", -0.3, 0.2], ["#e2553f", 0.22, -0.1], ["#4d8fe0", 0.05, 0.28], ["#f2b43c", -0.12, -0.25], ["#5fd38a", 0.34, 0.22], ["#e2553f", -0.38, -0.05]].forEach(([c, x, y]) => g.add(at(kit.sphere(0.045, c as string, { seg: 5 }), (x as number) * w, (y as number) * h, 0.06)));
  return g;
}

/** Pizarrón con un gráfico de barras que crece y una línea de tendencia. */
export function chalkboard(c: Ctx, w: number, h: number) {
  const { kit } = c;
  const g = group(at(kit.box(w + 0.14, h + 0.14, 0.06, "#8a5a3b", { surface: "wood" }), 0, 0, 0), at(kit.box(w, h, 0.02, "#2f4a3e"), 0, 0, 0.03), at(kit.box(w, 0.05, 0.12, "#8a5a3b", { surface: "wood" }), 0, -h / 2 - 0.02, 0.08));
  const bars = [0.35, 0.5, 0.42, 0.7, 0.62, 0.9].map((v, i) => {
    const b = live(at(kit.box(w * 0.09, 1, 0.012, kit.glow(i === 5 ? "#ffc93c" : "#e8efe6"), { shadow: false }), -w * 0.34 + i * w * 0.13, -h * 0.38, 0.045));
    b.geometry.translate(0, 0.5, 0);
    g.add(b);
    c.frame((t) => (b.scale.y = Math.max(0.02, h * 0.7 * v * Math.min(1, ((t * 0.25 + 0.1) % 4) * 1.4 - i * 0.12))));
    return b;
  });
  void bars;
  g.add(at(kit.box(w * 0.84, 0.012, 0.01, kit.glow("#e8efe6"), { shadow: false }), 0, -h * 0.39, 0.045), at(kit.box(0.12, 0.04, 0.03, CREAM), -w * 0.3, -h / 2 + 0.03, 0.1), at(kit.box(0.18, 0.06, 0.05, "#c8423a"), w * 0.3, -h / 2 + 0.04, 0.1));
  return g;
}

/** Corcho con notas, fotos y un hilo rojo (el Analista investiga). */
export function corkboard(kit: Kit, w: number, h: number) {
  const g = group(at(kit.box(w + 0.1, h + 0.1, 0.05, "#6b4a32", { surface: "wood" }), 0, 0, 0), at(kit.box(w, h, 0.02, "#c99f6b", { surface: "felt", repeat: [2, 1] }), 0, 0, 0.025));
  const pts: [number, number][] = [[-0.36, 0.2], [-0.1, -0.15], [0.14, 0.22], [0.36, -0.1], [-0.3, -0.25], [0.3, 0.26]];
  pts.forEach(([x, y], i) => g.add(at(kit.box(0.24, 0.2, 0.01, ["#f4f1ea", "#f2e46b", "#8fd3f2", "#f29bb5", "#a6e39a", "#f4f1ea"][i], { shadow: false }), x * w, y * h, 0.04, [0, 0, (i - 2.5) * 0.06]), at(kit.sphere(0.022, "#e2553f", { seg: 5 }), x * w, y * h + 0.07, 0.05)));
  for (let i = 0; i < pts.length - 2; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const dx = (b[0] - a[0]) * w;
    const dy = (b[1] - a[1]) * h;
    g.add(at(kit.box(Math.hypot(dx, dy), 0.012, 0.005, "#c8423a", { shadow: false }), ((a[0] + b[0]) / 2) * w, ((a[1] + b[1]) / 2) * h + 0.07, 0.052, [0, 0, Math.atan2(dy, dx)]));
  }
  return g;
}

/** Mesita con teléfono rojo de disco y agenda (el menú Contacto). El tubo vibra cuando hay algo pendiente. */
export function phoneTable(c: Ctx, ringing: () => boolean) {
  const { kit } = c;
  const g = group(at(kit.cyl(0.42, 0.42, 0.05, "#8a5a3b", { surface: "wood", seg: 10 }), 0, 0.8, 0), at(kit.cyl(0.05, 0.08, 0.78, "#6b4a32", { surface: "wood" }), 0, 0.4, 0), at(kit.cyl(0.26, 0.3, 0.04, "#6b4a32", { seg: 8 }), 0, 0.02, 0));
  g.add(at(kit.box(0.3, 0.1, 0.24, "#c8423a"), -0.05, 0.88, 0), at(kit.cyl(0.07, 0.07, 0.02, CREAM, { seg: 8 }), -0.05, 0.94, 0.03, [0.3, 0, 0]));
  const handset = live(at(group(at(kit.box(0.34, 0.05, 0.07, "#a8332c"), 0, 0, 0), at(kit.box(0.08, 0.07, 0.08, "#a8332c"), -0.14, -0.03, 0), at(kit.box(0.08, 0.07, 0.08, "#a8332c"), 0.14, -0.03, 0)), -0.05, 1.0, -0.06));
  g.add(handset, at(kit.box(0.2, 0.03, 0.26, "#3f5a6b"), 0.24, 0.84, 0.05, [0, -0.3, 0]), at(kit.box(0.18, 0.012, 0.24, CREAM), 0.24, 0.86, 0.05, [0, -0.3, 0]));
  c.frame((t) => {
    const on = ringing() && t % 3 < 1.2;
    handset.rotation.z = on ? Math.sin(t * 40) * 0.12 : 0;
    handset.position.y = on ? 1.02 : 1.0;
  });
  return g;
}

/** Buzón (el menú Bandeja): la banderita se levanta y asoman cartas cuando hay algo esperando. */
export function mailbox(c: Ctx, waiting: () => boolean) {
  const { kit } = c;
  const g = group(at(kit.box(0.1, 1.1, 0.1, "#6b4a32", { surface: "wood" }), 0, 0.55, 0), at(kit.box(0.42, 0.34, 0.62, "#c8423a", { surface: "metal" }), 0, 1.24, 0), at(kit.cyl(0.21, 0.21, 0.62, "#c8423a", { surface: "metal", seg: 8 }), 0, 1.41, 0, [Math.PI / 2, 0, 0]), at(kit.box(0.3, 0.3, 0.02, "#a8332c"), 0, 1.3, 0.32));
  const flag = live(at(group(at(kit.box(0.03, 0.34, 0.03, CREAM), 0, 0.17, 0), at(kit.box(0.03, 0.14, 0.2, kit.accent(kit.glow("#ffc93c"))), 0, 0.3, 0.1)), 0.23, 1.25, 0.1));
  const letters = live(group(at(kit.box(0.22, 0.14, 0.02, CREAM), 0, 1.36, 0.36, [0.3, 0, 0.1]), at(kit.box(0.2, 0.13, 0.02, "#f2e46b"), 0.04, 1.33, 0.38, [0.5, 0, -0.15])));
  g.add(flag, letters);
  c.frame((t, dt) => {
    const on = waiting();
    flag.rotation.x += ((on ? 0 : Math.PI / 2) - flag.rotation.x) * Math.min(1, dt * 6);
    letters.visible = on;
    letters.position.y = on ? Math.sin(t * 3) * 0.01 : 0;
  });
  return g;
}

export function tree(c: Ctx, s = 1) {
  const { kit } = c;
  const g = group(at(kit.cyl(0.16, 0.24, 1.9, "#6b4a32", { surface: "wood", seg: 6 }), 0, 0.95, 0), at(kit.cyl(0.07, 0.1, 0.8, "#6b4a32", { surface: "wood", seg: 5 }), 0.3, 1.7, 0, [0, 0, -0.8]));
  const crown = live(at(group(), 0, 2.1, 0));
  for (const [x, y, z, r, col] of [[0, 0.75, 0, 1.0, "#4c9152"], [0.75, 0.35, 0.2, 0.7, "#5fa860"], [-0.7, 0.4, -0.2, 0.75, "#3f7d47"], [0.1, 0.3, 0.75, 0.65, "#5fa860"], [-0.1, 0.35, -0.75, 0.7, "#3f7d47"], [0.2, 1.35, 0, 0.6, "#6bb86a"]] as const) crown.add(at(kit.sphere(r, col, { surface: "leaf", seg: 6 }), x, y, z));
  for (const [x, y, z] of [[0.7, 0.2, 0.6], [-0.5, 0.9, 0.6], [0.3, 1.2, 0.5], [-0.8, 0.2, 0.3]]) crown.add(at(kit.sphere(0.09, "#e2553f", { seg: 5 }), x, y, z)); // manzanas
  g.add(crown);
  g.scale.setScalar(s);
  c.frame((t) => (crown.rotation.z = Math.sin(t * 0.6) * 0.012));
  return g;
}

export function bush(kit: Kit, w = 1.4) {
  const g = group();
  const n = Math.max(2, Math.round(w / 0.5));
  for (let i = 0; i < n; i++) g.add(at(kit.sphere(0.34 + (i % 2) * 0.08, i % 2 ? "#4c9152" : "#5fa860", { surface: "leaf", seg: 6 }), -w / 2 + (w / (n - 1)) * i, 0.3 + (i % 2) * 0.06, (i % 3) * 0.08));
  return g;
}

export function flowerBed(kit: Kit, w: number, colors = ["#f29bb5", "#f2e46b", "#ffffff", "#e2553f", "#c17ee0"]) {
  const g = group(at(kit.box(w, 0.16, 0.5, "#6b4a32", { surface: "wood" }), 0, 0.08, 0), at(kit.box(w - 0.08, 0.04, 0.42, "#4a3a2c", { surface: "earth" }), 0, 0.16, 0));
  const n = Math.round(w / 0.22);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.14 + i * ((w - 0.28) / Math.max(1, n - 1));
    const z = ((i * 7) % 3) * 0.12 - 0.12;
    const hgt = 0.2 + ((i * 5) % 3) * 0.07;
    g.add(at(kit.box(0.02, hgt, 0.02, "#4c9152"), x, 0.18 + hgt / 2, z), at(kit.sphere(0.06, colors[i % colors.length], { seg: 5 }), x, 0.2 + hgt, z), at(kit.box(0.08, 0.01, 0.04, "#5fa860", { surface: "leaf" }), x + 0.03, 0.26, z));
  }
  return g;
}

export function bench(kit: Kit) {
  const g = group();
  for (let i = 0; i < 3; i++) g.add(at(kit.box(1.5, 0.05, 0.13, "#b98a5c", { surface: "wood" }), 0, 0.45, -0.15 + i * 0.15));
  for (let i = 0; i < 2; i++) g.add(at(kit.box(1.5, 0.12, 0.04, "#b98a5c", { surface: "wood" }), 0, 0.68 + i * 0.17, -0.26));
  for (const s of [-1, 1]) g.add(at(kit.box(0.06, 0.45, 0.4, INK, { surface: "metal" }), s * 0.65, 0.225, 0), at(kit.box(0.06, 0.5, 0.05, INK), s * 0.65, 0.7, -0.26));
  return g;
}

export function lampPost(c: Ctx) {
  const { kit } = c;
  const g = group(at(kit.cyl(0.12, 0.16, 0.2, INK, { seg: 6 }), 0, 0.1, 0), at(kit.cyl(0.04, 0.05, 2.3, INK, { seg: 6 }), 0, 1.3, 0), at(kit.box(0.34, 0.04, 0.34, INK), 0, 2.46, 0), at(kit.cone(0.26, 0.2, INK, { seg: 4 }), 0, 2.96, 0, [0, Math.PI / 4, 0]));
  const glass = kit.glow("#ffe2a0", 0.4);
  g.add(at(kit.box(0.26, 0.38, 0.26, glass), 0, 2.67, 0));
  const l = at(new THREE.PointLight("#ffd08a", 0, 8, 2), 0, 2.6, 0);
  g.add(l);
  c.light(l, 7);
  c.frame((_t, _dt, n) => (glass.opacity = 0.35 + n * 0.65));
  return g;
}

export function bicycle(kit: Kit, color = "#3f9f95") {
  const g = group();
  for (const x of [-0.5, 0.5]) g.add(at(kit.torus(0.3, 0.03, INK), x, 0.33, 0), at(kit.cyl(0.03, 0.03, 0.05, "#c3c9d2", { seg: 6 }), x, 0.33, 0, [Math.PI / 2, 0, 0]));
  const bar = (x1: number, y1: number, x2: number, y2: number, col = color) => g.add(at(kit.box(Math.hypot(x2 - x1, y2 - y1), 0.04, 0.04, col), (x1 + x2) / 2, (y1 + y2) / 2, 0, [0, 0, Math.atan2(y2 - y1, x2 - x1)]));
  bar(-0.5, 0.33, -0.12, 0.72);
  bar(-0.12, 0.72, 0.36, 0.72);
  bar(-0.5, 0.33, 0, 0.33);
  bar(0, 0.33, -0.12, 0.72);
  bar(0, 0.33, 0.36, 0.72);
  bar(0.5, 0.33, 0.36, 0.72);
  bar(0.36, 0.72, 0.32, 0.95, INK);
  g.add(at(kit.box(0.04, 0.04, 0.4, INK), 0.32, 0.95, 0), at(kit.box(0.22, 0.05, 0.12, "#6b4a32"), -0.14, 0.8, 0), at(kit.box(0.3, 0.22, 0.26, "#c9a877", { surface: "stripes" }), 0.55, 0.78, 0)); // canasto
  return g;
}

export function crate(kit: Kit, veg: string[]) {
  const g = group(at(kit.box(0.9, 0.3, 0.6, "#b98a5c", { surface: "wood" }), 0, 0.15, 0), at(kit.box(0.82, 0.04, 0.52, "#4a3a2c", { surface: "earth" }), 0, 0.3, 0));
  veg.forEach((col, i) => g.add(at(kit.sphere(0.09, col, { seg: 5 }), -0.3 + (i % 4) * 0.2, 0.36, -0.12 + Math.floor(i / 4) * 0.24), at(kit.box(0.02, 0.14, 0.02, "#5fa860"), -0.3 + (i % 4) * 0.2, 0.46, -0.12 + Math.floor(i / 4) * 0.24)));
  return g;
}

/** Estanque con nenúfares y un pececito que da vueltas. */
export function pond(c: Ctx) {
  const { kit } = c;
  const g = group(at(kit.cyl(1.0, 1.0, 0.06, "#8d8478", { surface: "stone", seg: 10 }), 0, 0.03, 0), at(kit.cyl(0.85, 0.85, 0.02, kit.glow("#6fb6d9", 0.85), { seg: 10 }), 0, 0.065, 0));
  for (const [x, z, r] of [[0.3, 0.2, 0.16], [-0.35, -0.1, 0.13], [0.1, -0.45, 0.1]]) g.add(at(kit.cyl(r, r, 0.012, "#5fa860", { seg: 7 }), x, 0.08, z));
  g.add(at(kit.sphere(0.06, "#f29bb5", { seg: 5 }), 0.3, 0.12, 0.2));
  const fish = live(group(at(kit.box(0.14, 0.02, 0.06, kit.glow("#ff8a2e")), 0, 0, 0)));
  g.add(fish);
  c.frame((t) => {
    fish.position.set(Math.sin(t * 0.6) * 0.5, 0.08, Math.cos(t * 0.6) * 0.5);
    fish.rotation.y = t * 0.6 + Math.PI / 2;
  });
  for (let i = 0; i < 7; i++) g.add(at(kit.sphere(0.14 + (i % 3) * 0.04, "#9a9488", { surface: "stone", seg: 5 }), Math.sin(i * 0.9) * 1.02, 0.07, Math.cos(i * 0.9) * 1.02));
  return g;
}

/** Puerta de entrada con vidrio y picaporte (para la pared del frente). */
export function door(kit: Kit) {
  const g = group(at(kit.box(1.1, 2.2, 0.08, "#3f7f76", { surface: "wood" }), 0, 1.1, 0), at(kit.box(1.3, 0.1, 0.16, CREAM), 0, 2.25, 0), at(kit.box(0.6, 0.6, 0.1, kit.glow("#bfe8ff", 0.7)), 0, 1.6, 0), at(kit.sphere(0.05, "#e2b23c", { seg: 6 }), 0.4, 1.05, -0.08));
  for (const s of [-1, 1]) g.add(at(kit.box(0.1, 2.3, 0.16, CREAM), s * 0.6, 1.15, 0));
  return g;
}

export function coatRack(kit: Kit) {
  const g = group(at(kit.cyl(0.03, 0.03, 1.8, "#6b4a32", { surface: "wood" }), 0, 0.9, 0), at(kit.cyl(0.22, 0.26, 0.05, "#6b4a32", { seg: 8 }), 0, 0.025, 0));
  for (let i = 0; i < 4; i++) g.add(at(kit.box(0.2, 0.03, 0.03, "#6b4a32"), Math.sin(i * 1.57) * 0.1, 1.7, Math.cos(i * 1.57) * 0.1, [0, i * 1.57 + 1.57, 0.4]));
  g.add(at(kit.box(0.32, 0.6, 0.12, "#e2553f", { surface: "cloth" }), 0.12, 1.36, 0.06), at(kit.cyl(0.16, 0.2, 0.12, "#3a3f52", { surface: "cloth", seg: 8 }), -0.14, 1.72, -0.04));
  return g;
}

/** Dispenser de agua con burbujas. */
export function waterCooler(c: Ctx) {
  const { kit } = c;
  const g = group(at(kit.box(0.4, 1.0, 0.4, CREAM, { surface: "metal" }), 0, 0.5, 0), at(kit.cyl(0.17, 0.17, 0.45, kit.glow("#8fd3f2", 0.6), { seg: 8 }), 0, 1.24, 0), at(kit.box(0.2, 0.12, 0.05, "#d9dde3"), 0, 0.8, 0.21));
  const bub = live(at(kit.sphere(0.03, kit.glow("#ffffff", 0.8), { seg: 5 }), 0, 1.1, 0));
  g.add(bub);
  c.frame((t) => {
    const k = (t * 0.7) % 1;
    bub.position.y = 1.08 + k * 0.32;
    bub.visible = k < 0.9;
  });
  return g;
}

export function printer(kit: Kit) {
  return group(at(kit.box(0.8, 0.6, 0.55, "#6b4a32", { surface: "wood" }), 0, 0.3, 0), at(kit.box(0.6, 0.26, 0.45, "#d9dde3", { surface: "metal" }), 0, 0.73, 0), at(kit.box(0.4, 0.02, 0.3, CREAM), 0, 0.87, 0.08), at(kit.box(0.08, 0.03, 0.02, kit.glow("#5fd38a")), 0.2, 0.78, 0.23));
}

export function globe(kit: Kit) {
  return group(at(kit.cyl(0.12, 0.14, 0.04, "#6b4a32", { seg: 8 }), 0, 0.02, 0), at(kit.cyl(0.015, 0.015, 0.2, "#c9a24a"), 0, 0.12, 0), at(kit.sphere(0.2, "#4d8fe0", { surface: "spots", seg: 8 }), 0, 0.36, 0), at(kit.torus(0.23, 0.012, "#c9a24a", { arc: Math.PI }), 0, 0.36, 0, [0, 0, -Math.PI / 2 + 0.4]));
}

export function fileCabinet(kit: Kit, color = "#6b7a8f") {
  const g = group(at(kit.box(0.55, 1.2, 0.6, color, { surface: "metal" }), 0, 0.6, 0));
  for (let i = 0; i < 3; i++) g.add(at(kit.box(0.47, 0.32, 0.02, "#7d8ca1", { surface: "metal" }), 0, 0.22 + i * 0.38, 0.31), at(kit.box(0.16, 0.03, 0.03, "#d9dde3"), 0, 0.28 + i * 0.38, 0.33));
  return g;
}

/** Rack de servidores con lucecitas que parpadean (sala técnica). */
export function serverRack(c: Ctx, seed = 0) {
  const { kit } = c;
  const g = group(at(kit.box(0.8, 2.1, 0.7, "#23262f", { surface: "metal" }), 0, 1.05, 0));
  const leds = ["#5fd38a", "#7df0d0", "#ffc93c", "#9c6bff"].map((col, k) => {
    const m = kit.glow(col);
    m.transparent = true;
    c.frame((t) => (m.opacity = Math.sin(t * (2 + k) + k * 1.7 + seed) > -0.3 ? 1 : 0.15));
    return m;
  });
  for (let i = 0; i < 7; i++) {
    g.add(at(kit.box(0.68, 0.2, 0.02, "#30343f", { surface: "metal" }), 0, 0.25 + i * 0.27, 0.36));
    for (let j = 0; j < 4; j++) g.add(at(kit.box(0.04, 0.04, 0.01, leds[(i + j * 3 + seed) % 4], { shadow: false }), -0.24 + j * 0.09, 0.25 + i * 0.27, 0.375));
  }
  return g;
}

/** Caño que recorre `len` metros a lo largo de x. */
export function pipe(kit: Kit, len: number, color = "#c47a4a", r = 0.06) {
  const g = group(at(kit.cyl(r, r, len, color, { surface: "metal", seg: 6 }), 0, 0, 0, [0, 0, Math.PI / 2]));
  for (let x = -len / 2 + 0.6; x < len / 2; x += 2.2) g.add(at(kit.cyl(r * 1.5, r * 1.5, 0.1, "#8a5a3b", { seg: 6 }), x, 0, 0, [0, 0, Math.PI / 2]));
  return g;
}

/** Pizarra blanca con ruedas. */
export function whiteboard(kit: Kit) {
  const g = group(at(kit.box(1.7, 1.1, 0.05, "#d9dde3", { surface: "metal" }), 0, 1.4, 0), at(kit.box(1.6, 1.0, 0.02, CREAM), 0, 1.4, 0.03));
  for (const s of [-1, 1]) g.add(at(kit.box(0.05, 1.95, 0.05, "#8e96a3", { surface: "metal" }), s * 0.85, 0.98, 0), at(kit.box(0.05, 0.05, 0.6, "#8e96a3"), s * 0.85, 0.05, 0));
  [["#e2553f", 0.5, 0.3, 0.9], ["#4d8fe0", 0.3, 0.14, 0.6], ["#5fd38a", 0.4, -0.02, 0.75], ["#2b2730", 0.2, -0.18, 0.5]].forEach(([col, , y, w]) => g.add(at(kit.box(w as number, 0.035, 0.01, col as string, { shadow: false }), -0.75 + (w as number) / 2 + 0.1, 1.4 + (y as number), 0.045)));
  ["#f2e46b", "#f29bb5", "#8fd3f2"].forEach((col, i) => g.add(at(kit.box(0.16, 0.16, 0.01, col, { shadow: false }), 0.5, 1.72 - i * 0.22, 0.045, [0, 0, (i - 1) * 0.1])));
  return g;
}

/** Mostrador de la tienda de skills con cartel. */
export function shopCounter(c: Ctx) {
  const { kit } = c;
  const g = group(at(kit.box(1.9, 0.95, 0.6, "#8a5a3b", { surface: "wood" }), 0, 0.475, 0), at(kit.box(2.05, 0.06, 0.72, "#b98a5c", { surface: "wood" }), 0, 0.98, 0));
  for (let i = 0; i < 3; i++) g.add(at(kit.box(0.5, 0.6, 0.02, "#6b4a32", { surface: "wood" }), -0.6 + i * 0.6, 0.48, 0.31));
  // libros apilados, campanita y una skill "en oferta" que flota y gira
  ["#c8423a", "#4d8fe0", "#f2b43c"].forEach((col, i) => g.add(at(kit.box(0.34, 0.07, 0.26, col, { surface: "cloth" }), -0.6, 1.045 + i * 0.07, 0.02, [0, i * 0.25, 0])));
  g.add(at(kit.dome(0.07, "#e2b23c"), 0.75, 1.01, 0.15));
  const gem = live(at(kit.cone(0.13, 0.26, kit.glow("#9c6bff", 0.9), { seg: 4 }), 0.2, 1.45, 0.1));
  const gem2 = at(kit.cone(0.13, 0.2, kit.glow("#c9a8ff", 0.9), { seg: 4 }), 0, -0.23, 0, [Math.PI, 0, 0]);
  gem.add(gem2);
  g.add(gem);
  c.frame((t) => {
    gem.rotation.y = t * 1.5;
    gem.position.y = 1.5 + Math.sin(t * 2) * 0.05;
  });
  return g;
}

// ---------- Vegetación y clima de cada variante de la casa ----------

/** Pino nevado (cabaña). */
export function pine(c: Ctx, s = 1) {
  const { kit } = c;
  const g = group(at(kit.cyl(0.14, 0.2, 1.0, "#5a3b26", { surface: "wood", seg: 6 }), 0, 0.5, 0));
  [[1.5, 1.0, 1.2], [1.2, 1.9, 1.0], [0.85, 2.7, 0.85], [0.5, 3.35, 0.7]].forEach(([r, y, h], i) => {
    g.add(at(kit.cone(r, h * 1.4, i % 2 ? "#2f5a4a" : "#36684f", { surface: "leaf", seg: 7 }), 0, y, 0));
    g.add(at(kit.cone(r * 0.82, h * 0.5, "#f4f8fb", { seg: 7 }), 0, y + h * 0.42, 0)); // nieve arriba de cada piso
  });
  g.scale.setScalar(s);
  return g;
}

/** Palmera de tronco curvo, con cocos. */
export function palm(c: Ctx, s = 1) {
  const { kit } = c;
  const g = group();
  let y = 0;
  for (let i = 0; i < 7; i++) {
    g.add(at(kit.cyl(0.13 - i * 0.008, 0.15 - i * 0.008, 0.48, i % 2 ? "#a07a4e" : "#8a6a44", { surface: "wood", seg: 6 }), i * i * 0.012, y + 0.24, 0, [0, 0, -i * 0.05]));
    y += 0.46;
  }
  const top = live(at(group(), 0.6, y, 0));
  for (let i = 0; i < 8; i++) {
    const leaf = at(group(), 0, 0, 0, [0, (i / 8) * Math.PI * 2, 0]);
    leaf.add(at(kit.box(0.34, 0.03, 1.5, i % 2 ? "#4c9152" : "#5fa860", { surface: "leaf" }), 0, -0.25, 0.7, [0.45, 0, 0]));
    top.add(leaf);
  }
  for (let i = 0; i < 3; i++) top.add(at(kit.sphere(0.12, "#6b4a32", { seg: 6 }), Math.sin(i * 2.1) * 0.15, -0.15, Math.cos(i * 2.1) * 0.15));
  g.add(top);
  g.scale.setScalar(s);
  c.frame((t) => (top.rotation.z = Math.sin(t * 0.8) * 0.04));
  return g;
}

/** Cerezo en flor. */
export function sakura(c: Ctx, s = 1) {
  const { kit } = c;
  const g = group(at(kit.cyl(0.14, 0.24, 1.7, "#4a2f22", { surface: "wood", seg: 6 }), 0, 0.85, 0), at(kit.cyl(0.07, 0.1, 1.0, "#4a2f22", { surface: "wood", seg: 5 }), 0.4, 1.7, 0.1, [0.2, 0, -0.9]), at(kit.cyl(0.07, 0.1, 0.9, "#4a2f22", { surface: "wood", seg: 5 }), -0.4, 1.8, -0.1, [-0.2, 0, 0.8]));
  const crown = live(at(group(), 0, 2.2, 0));
  for (const [x, y, z, r, col] of [[0, 0.5, 0, 0.95, "#f2a6c0"], [0.85, 0.15, 0.2, 0.7, "#f7c1d4"], [-0.8, 0.25, -0.2, 0.75, "#eb94b4"], [0.1, 0.2, 0.75, 0.6, "#f7c1d4"], [-0.1, 0.3, -0.75, 0.65, "#f2a6c0"], [0.2, 1.1, 0, 0.55, "#fbd5e3"]] as const) crown.add(at(kit.sphere(r, col, { surface: "leaf", seg: 6 }), x, y, z));
  g.add(crown);
  g.scale.setScalar(s);
  c.frame((t) => (crown.rotation.z = Math.sin(t * 0.6) * 0.012));
  return g;
}

/** Maceta grande de cemento con un árbol chico (loft). */
export function planter(c: Ctx, s = 1) {
  const { kit } = c;
  const g = group(at(kit.box(1.4, 0.8, 1.4, "#8a8c90", { surface: "concrete" }), 0, 0.4, 0), at(kit.box(1.25, 0.05, 1.25, "#4a3a2c", { surface: "earth" }), 0, 0.8, 0), at(ficus(kit, 1.3, "#8a8c90"), 0, 0.5, 0));
  g.scale.setScalar(s);
  return g;
}

export function themedTree(c: Ctx, kind: string, s = 1) {
  return kind === "pine" ? pine(c, s) : kind === "palm" ? palm(c, s) : kind === "sakura" ? sakura(c, s) : kind === "planter" ? planter(c, s * 0.9) : tree(c, s);
}

/** Lo que cae del cielo sobre el jardín: copos, pétalos u hojas. Puntos chiquitos que bajan con un vaivén. */
export function weather(c: Ctx, kind: "snow" | "petals" | "leaves", box: { x0: number; x1: number; z0: number; z1: number; top: number }) {
  const n = kind === "snow" ? 420 : kind === "petals" ? 160 : 60;
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = box.x0 + Math.random() * (box.x1 - box.x0);
    pos[i * 3 + 1] = Math.random() * box.top;
    pos[i * 3 + 2] = box.z0 + Math.random() * (box.z1 - box.z0);
    seed[i] = Math.random() * 10;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = c.kit.track(new THREE.PointsMaterial({ color: kind === "snow" ? "#ffffff" : kind === "petals" ? "#f7b8cf" : "#d9a441", size: kind === "snow" ? 0.09 : 0.12, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false }));
  const pts = live(new THREE.Points(geo, mat));
  pts.frustumCulled = false;
  const speed = kind === "snow" ? 0.55 : kind === "petals" ? 0.4 : 0.6;
  c.frame((t, dt) => {
    for (let i = 0; i < n; i++) {
      let y = pos[i * 3 + 1] - dt * speed * (0.7 + (seed[i] % 1) * 0.6);
      if (y < 0) y += box.top;
      pos[i * 3 + 1] = y;
      pos[i * 3] += Math.sin(t * 0.9 + seed[i]) * dt * 0.25;
    }
    geo.attributes.position.needsUpdate = true;
  });
  return pts;
}
