// Kit de piezas de la oficina 3D, estilo low poly pixelado (elegido por el usuario el 2026-11-05):
// pocos polígonos y texturas chiquitas de pixeles. Todo lo que se dibuja pasa por acá, así el arte se cambia en un solo lugar
// (y las texturas se pueden reemplazar por dibujos hechos a mano).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Tipo de superficie: define el dibujo de la textura. */
export type Surface = "plain" | "cloth" | "wood" | "fur" | "skin" | "brick" | "tile" | "concrete" | "metal" | "leaf" | "felt" | "plaster" | "checker" | "grass" | "earth" | "stone" | "stripes" | "tabby" | "spots";

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0) / 4294967296;
}

const shade = (base: THREE.Color, d: number) => `#${base.clone().offsetHSL(0, 0, d).getHexString()}`;

/** Textura de pixeles (16 o 32 px) con el dibujo de cada superficie. */
function pixelTexture(color: string, surface: Surface, repeat: [number, number]) {
  const big = surface === "wood" || surface === "brick" || surface === "tile" || surface === "checker" || surface === "grass" || surface === "earth" || surface === "stone" || surface === "plaster";
  const size = big ? 32 : 16;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const base = new THREE.Color(color);
  const r = rng(color + surface);
  const amp: Partial<Record<Surface, number>> = { stripes: 0.025, tabby: 0.05, spots: 0.05, stone: 0.04, plain: 0.025, skin: 0.02, cloth: 0.05, fur: 0.06, concrete: 0.04, leaf: 0.08, felt: 0.05, metal: 0.03, wood: 0.04, brick: 0.05, tile: 0.03 };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let d = (r() - 0.5) * 2 * (amp[surface] ?? 0.03);
      if (surface === "wood") {
        const plank = Math.floor(y / 8);
        d += ((plank * 7919) % 5) * 0.015 - 0.03; // cada tabla con su tono
        if (y % 8 === 0) d -= 0.14;
        if (x === (plank * 11) % size && y % 8 !== 0) d -= 0.1; // junta entre tablas
      }
      if (surface === "brick") {
        const row = Math.floor(y / 8);
        const off = row % 2 ? 8 : 0;
        if (y % 8 === 0 || (x + off) % 16 === 0) d = 0.22; // junta clara
        else d += (((row * 31 + Math.floor((x + off) / 16) * 17) % 7) - 3) * 0.02;
      }
      if (surface === "tile") {
        if (x % 16 === 0 || y % 16 === 0) d = 0.15;
        else d += ((Math.floor(x / 16) + Math.floor(y / 16) * 3) % 3) * 0.02 - 0.02;
      }
      if (surface === "plaster") {
        d = (r() - 0.5) * 0.03;
        if (y >= size - 3) d -= 0.1; // zócalo
        if (y === size - 4) d += 0.06;
      }
      if (surface === "checker") d = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 ? -0.09 + (r() - 0.5) * 0.02 : (r() - 0.5) * 0.02;
      if (surface === "checker" && (x % 16 === 0 || y % 16 === 0)) d -= 0.05;
      if (surface === "grass") {
        d = (r() - 0.5) * 0.07;
        if (r() > 0.9) d += 0.1; // brotes claros
        if (r() > 0.95) d -= 0.1;
      }
      if (surface === "earth") {
        d = (r() - 0.5) * 0.06 + Math.sin(y / 3 + Math.sin(x / 5)) * 0.045; // vetas
        if (r() > 0.975) d += 0.2; // piedritas
      }
      if (surface === "stone") {
        const row = Math.floor(y / 8);
        const off = (row * 5) % 11;
        if (y % 8 === 0 || (x + off) % 11 === 0) d = -0.16;
        else d += (((row * 13 + Math.floor((x + off) / 11) * 7) % 5) - 2) * 0.03;
      }
      if (surface === "stripes") d += Math.floor(x / 4) % 2 ? -0.07 : 0;
      if (surface === "tabby") d += (y + Math.round(Math.sin(x * 0.8) * 1.5)) % 5 === 0 ? -0.2 : 0;
      if (surface === "spots") d += Math.hypot((x % 8) - 3.5 + ((Math.floor(y / 8) % 2) * 4 - 2), (y % 8) - 3.5) < 2 ? -0.22 : 0;
      if (surface === "concrete" && r() > 0.97) d -= 0.05;
      if (surface === "cloth" && (x + y) % 4 === 0) d -= 0.035;
      if (surface === "fur" && r() > 0.85) d -= 0.08;
      if (surface === "leaf" && r() > 0.9) d += 0.1;
      if (surface === "metal") d += (y % 4 === 0 ? 0.04 : 0) + (x === 0 ? 0.06 : 0);
      g.fillStyle = shade(base, d);
      g.fillRect(x, y, 1, 1);
    }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  return t;
}

export type PartOpts = { surface?: Surface; shadow?: boolean; repeat?: [number, number] };
type Paint = string | THREE.Material;

export class Kit {
  private mats = new Map<string, THREE.Material>();
  /** Materiales que no son del caché (pantallas, letreros): también se liberan al cerrar. */
  private extra: THREE.Material[] = [];

  mat(color: string, o: PartOpts = {}): THREE.Material {
    const surface = o.surface ?? "plain";
    const repeat = o.repeat ?? [1, 1];
    const key = `${color}|${surface}|${repeat}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ map: pixelTexture(color, surface, repeat), flatShading: true });
      this.mats.set(key, m);
    }
    return m;
  }

  /** Material propio (no compartido), para lo que cambia de color en vivo. */
  ownMat(color: string, o: PartOpts = {}) {
    const m = this.mat("#ffffff", o).clone() as THREE.MeshLambertMaterial;
    m.map = m.map!.clone();
    m.color.set(color);
    this.extra.push(m);
    return m;
  }

  /** Brilla sola (pantallas, luces, neón): no le afectan las sombras ni la noche. */
  glow(color: string, opacity = 1) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
    this.extra.push(m);
    return m;
  }

  /** Materiales de lo que "avisa" algo (pantallas, fuego, buzón): el modo ASCII los pinta con el color de aviso. */
  accents = new Set<THREE.Material>();
  accent<T extends THREE.Material>(m: T) {
    this.accents.add(m);
    return m;
  }

  track<T extends THREE.Material>(m: T) {
    this.extra.push(m);
    return m;
  }

  finish(mesh: THREE.Mesh, o: PartOpts = {}) {
    mesh.castShadow = o.shadow ?? !(mesh.material instanceof THREE.MeshBasicMaterial);
    mesh.receiveShadow = !(mesh.material instanceof THREE.MeshBasicMaterial);
    return mesh;
  }

  private make(geo: THREE.BufferGeometry, paint: Paint, o: PartOpts) {
    return this.finish(new THREE.Mesh(geo, typeof paint === "string" ? this.mat(paint, o) : paint), o);
  }

  box(w: number, h: number, d: number, paint: Paint, o: PartOpts = {}) {
    return this.make(new THREE.BoxGeometry(w, h, d), paint, o);
  }
  sphere(r: number, paint: Paint, o: PartOpts & { seg?: number } = {}) {
    const s = o.seg ?? 8;
    return this.make(new THREE.SphereGeometry(r, s, Math.max(4, Math.round(s * 0.7))), paint, o);
  }
  /** Media esfera (pelo, cúpulas). */
  dome(r: number, paint: Paint, o: PartOpts = {}) {
    return this.make(new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), paint, o);
  }
  cyl(rTop: number, rBottom: number, h: number, paint: Paint, o: PartOpts & { seg?: number } = {}) {
    return this.make(new THREE.CylinderGeometry(rTop, rBottom, h, o.seg ?? 8), paint, o);
  }
  cone(r: number, h: number, paint: Paint, o: PartOpts & { seg?: number } = {}) {
    return this.make(new THREE.ConeGeometry(r, h, o.seg ?? 6), paint, o);
  }
  torus(r: number, tube: number, paint: Paint, o: PartOpts & { arc?: number } = {}) {
    return this.make(new THREE.TorusGeometry(r, tube, 4, 10, o.arc ?? Math.PI * 2), paint, o);
  }
  plane(w: number, h: number, paint: Paint, o: PartOpts = {}) {
    return this.make(new THREE.PlaneGeometry(w, h), paint, { shadow: false, ...o });
  }

  dispose() {
    for (const m of [...this.mats.values(), ...this.extra]) {
      const map = (m as THREE.MeshBasicMaterial).map;
      map?.dispose();
      m.dispose();
    }
    this.mats.clear();
    this.accents.clear();
    this.extra = [];
  }
}

/** Ubica un objeto y lo devuelve (para armar figuras en una línea). */
export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rot?: [number, number, number], scale?: [number, number, number]) {
  o.position.set(x, y, z);
  if (rot) o.rotation.set(...rot);
  if (scale) o.scale.set(...scale);
  return o;
}

export function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  if (children.length) g.add(...children);
  return g;
}

/** Dibuja en un lienzo chiquito y lo devuelve como textura de pixeles (letreros, vistas de ventana, caras de robot). */
export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Cartel flotante sobre un personaje ("!", "z z"). */
export function textSprite(text: string, color: string, bg?: string) {
  const t = canvasTexture(64, 64, (g) => {
    if (bg) {
      g.fillStyle = "#231e2b";
      g.fillRect(6, 6, 52, 52);
      g.fillStyle = bg;
      g.fillRect(9, 9, 46, 46);
    }
    g.fillStyle = color;
    g.font = "bold 34px monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 32, 34);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.renderOrder = 10;
  return s;
}

/** Marca un grupo como "vivo" (se mueve o se muestra y oculta): la fusión no lo toca. */
export function live<T extends THREE.Object3D>(o: T) {
  o.userData.live = true;
  return o;
}

/** Funde en pocas mallas todo lo quieto de un grupo (una por material): la casa tiene miles de piezas y así se dibuja en un puñado de pasadas.
 *  Saltea lo marcado con live() y lo ya fundido. Lo que se toca con el mouse se resuelve aparte (cajas de clic). */
export function bake(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, { mat: THREE.Material; cast: boolean; recv: boolean; geos: THREE.BufferGeometry[] }>();
  const gone: THREE.Mesh[] = [];
  const visit = (o: THREE.Object3D) => {
    if (o !== root && (o.userData.live || o.userData.baked)) return;
    if (!o.visible) return;
    if (o instanceof THREE.Mesh && !Array.isArray(o.material) && !o.userData.pick) {
      const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] }));
      b.geos.push(o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)));
      gone.push(o);
      // Lo que cuelga de esta pieza (la carga de la batería, por ejemplo) pasa a colgar del grupo, en el mismo lugar.
      for (const c of [...o.children]) {
        root.attach(c);
        visit(c);
      }
      return;
    }
    for (const c of [...o.children]) visit(c);
  };
  visit(root);
  for (const m of gone) {
    m.removeFromParent();
    m.geometry.dispose();
  }
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geos);
    b.geos.forEach((g) => g.dispose());
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.recv;
    root.add(mesh);
  }
  root.userData.baked = true;
  return root;
}

/** Congela lo quieto: deja de recalcular cada cuadro la posición de lo que no se mueve (y no recorre los grupos sin nada vivo adentro).
 *  Lo marcado con live() y lo que cuelga de ello sigue normal. Devuelve si el grupo tiene algo vivo. */
export function freezeStatic(o: THREE.Object3D, first = true): boolean {
  if (first) o.updateMatrixWorld(true);
  if (o.userData.live) return true;
  let alive = false;
  for (const c of o.children) alive = freezeStatic(c, false) || alive;
  o.matrixAutoUpdate = false;
  if (!alive) o.matrixWorldAutoUpdate = false;
  return alive;
}

/** Contorno claro para el hover: una copia de cada pieza un poco más grande, pintada solo por dentro (se ve el borde).
 *  Arranca oculto; devuelve las copias para prenderlas y apagarlas. */
export function outline(root: THREE.Object3D, mat: THREE.Material): THREE.Mesh[] {
  const hulls: THREE.Mesh[] = [];
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !Array.isArray(o.material) && o.visible) meshes.push(o);
  });
  for (const m of meshes) {
    m.geometry.computeBoundingSphere();
    const r = m.geometry.boundingSphere?.radius || 0.1;
    const hull = new THREE.Mesh(m.geometry, mat);
    const s = (r + 0.07) / r;
    hull.scale.setScalar(s);
    // Crece alrededor de su centro (una pieza fundida no tiene el centro en su origen).
    if (m.geometry.boundingSphere) hull.position.copy(m.geometry.boundingSphere.center).multiplyScalar(1 - s);
    hull.visible = false;
    hull.castShadow = hull.receiveShadow = false;
    hull.userData.hull = true;
    m.add(hull);
    hulls.push(hull);
  }
  return hulls;
}
