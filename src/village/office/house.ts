// La casa (reforma 2026-11-10): planta baja con ambientes, entrepiso que se ve siempre junto con la planta baja,
// jardín y sótanos de oficina que el usuario agrega desde el HUD. Las medidas y los escritorios salen de layout.ts.
import * as THREE from "three";
import { at, bake, canvasTexture, group, live, outline, type Kit, type Surface } from "./kit";
import { allDesks, BASEMENT, FLOOR_H, GARDEN, HOUSE, MEZZ, UPPER_H, type DeskSlot } from "./layout";
import type { HouseTheme } from "./house-themes";
import * as P from "./props";
import type { Ctx, Desk, DeskLook, Frame } from "./props";

/** Pared que se baja a un zócalo cuando queda entre la cámara y la casa. (nx, nz): hacia dónde mira por fuera. */
export type Wall = { full: THREE.Group; stub: THREE.Group; nx: number; nz: number; level: number };
export type House = {
  root: THREE.Group;
  /** levels[0] = la casa con el jardín; levels[k] = sótano k. */
  levels: THREE.Group[];
  /** caps[k - 1]: techo del sótano k (se oculta al enfocarlo). */
  caps: THREE.Object3D[];
  walls: Wall[];
  desks: Record<string, Desk>;
  frames: Frame[];
  lights: { light: THREE.PointLight; max: number; always: number }[];
  /** Cajas invisibles para el clic sobre los objetos que abren un menú (userData.pick = "menu:<id>"). */
  picks: THREE.Object3D[];
  /** Contorno de cada objeto que abre un menú (se prende al pasar el mouse). */
  outlines: Record<string, THREE.Mesh[]>;
};
export type HouseState = { waitingApproval: () => boolean; contactPending: () => boolean };

const INK = "#2b2730";
const CREAM = "#efe5d1";
const WOOD = "#b98a5c";
const DARK_WOOD = "#6b4a32";
const TOP = FLOOR_H + UPPER_H;
const T = 0.25; // espesor de paredes y losas
const LOOK: DeskLook = { top: "#d8b98e", topSurface: "wood", leg: INK, chair: "#3f4a5c", accent: "#e2553f" };

const Y = (o: THREE.Object3D, x: number, y: number, z: number, ry = 0) => at(o, x, y, z, [0, ry, 0]);

function pickBox(menu: string, w: number, h: number, d: number, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d));
  m.position.set(x, y, z);
  m.visible = false; // el rayo del clic igual lo encuentra
  m.userData.pick = `menu:${menu}`;
  m.updateMatrixWorld(); // no cuelga de la escena: sin esto el rayo del clic la buscaba en el origen
  return m;
}

/** Arma una pared: `build` recibe dónde poner la pared entera y dónde el zócalo. */
function wall(level: number, nx: number, nz: number, build: (full: THREE.Group, stub: THREE.Group) => void): Wall {
  const full = group();
  const stub = group();
  build(full, stub);
  bake(full);
  bake(stub);
  stub.visible = false;
  return { full: live(full), stub: live(stub), nx, nz, level };
}

type Paint = { color: string; surface: Surface };
/** Tramo de pared a lo largo de x (en z) o de z (en x), desde y0 hasta y1. `out`: hacia qué lado crece el espesor. */
function slabX(kit: Kit, x0: number, x1: number, z: number, out: number, y0: number, y1: number, p: Paint) {
  return at(kit.box(x1 - x0, y1 - y0, T, p.color, { surface: p.surface, repeat: [Math.max(1, Math.round((x1 - x0) / 2)), Math.max(1, Math.round((y1 - y0) / 1.7))] }), (x0 + x1) / 2, (y0 + y1) / 2, z + (out * T) / 2);
}
function slabZ(kit: Kit, z0: number, z1: number, x: number, out: number, y0: number, y1: number, p: Paint) {
  return at(kit.box(T, y1 - y0, z1 - z0, p.color, { surface: p.surface, repeat: [Math.max(1, Math.round((z1 - z0) / 2)), Math.max(1, Math.round((y1 - y0) / 1.7))] }), x + (out * T) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

export function buildHouse(kit: Kit, o: { occupants: Record<string, string>; basements: string[]; basementNames: string[]; state: HouseState; theme: HouseTheme }): House {
  const th = o.theme;
  const frames: Frame[] = [];
  const lights: House["lights"] = [];
  const picks: THREE.Object3D[] = [];
  const outlines: House["outlines"] = {};
  const hullMat = kit.track(new THREE.MeshBasicMaterial({ color: "#fff6c8", side: THREE.BackSide }));
  /** Objeto que abre un menú: no se funde con el resto y lleva contorno para el hover. */
  const menu = <O extends THREE.Object3D>(id: string, o: O) => {
    bake(o); // sus piezas quietas en pocas mallas (lo que se mueve va con live() y queda aparte)
    (outlines[id] ??= []).push(...outline(o, hullMat));
    return live(o);
  };
  const c: Ctx = { kit, frame: (f) => frames.push(f), light: (l, max, always = 0) => lights.push({ light: l, max, always }) };
  const desks: Record<string, Desk> = {};
  const walls: Wall[] = [];
  const slots = allDesks(o.basements.length);
  const addDesks = (g: THREE.Group, level: number, look: DeskLook) =>
    slots
      .filter((s) => s.level === level)
      .forEach((s: DeskSlot, i) => {
        const desk = P.buildDesk(kit, look, s, i, o.occupants[s.id]);
        desks[s.id] = desk;
        g.add(desk.group);
      });

  // ═══════════ La casa ═══════════
  const house = group();
  const { x0, x1, z0, z1 } = HOUSE;
  const W = x1 - x0;
  const D = z1 - z0;
  const tex = P.viewTextures();
  frames.push((t) => (tex.clouds.offset.x = t * 0.004));
  const win = (w: number, h: number, cols: number, rows: number, curtain?: string, shaft = true) => P.windowPane(c, tex, { w, h, cols, rows, frame: th.frame, trim: th.darkWood, curtain, shaft });

  // Pisos: madera en toda la casa, damero en la cocina, pasto en el jardín y la base de la maqueta.
  house.add(at(kit.box(W + 2 * T, T, D + 2 * T, th.floor.color, { surface: th.floor.surface, repeat: [11, 7] }), 0, -T / 2, 0));
  house.add(at(kit.box(MEZZ.x0 + 6.3 - x0, 0.02, MEZZ.z1 - z0, th.kitchen, { surface: "checker", repeat: [3, 2], shadow: false }), x0 + 3.15, 0.011, (z0 + MEZZ.z1) / 2));
  const gx1 = GARDEN.x1 + 0.2;
  const gz1 = GARDEN.z1 + 0.2;
  house.add(at(kit.box(gx1 - (x0 - 0.6), T, gz1 - (z1 + T), th.ground.color, { surface: th.ground.surface, repeat: [13, 2] }), (gx1 + x0 - 0.6) / 2, -T / 2, (gz1 + z1 + T) / 2));
  house.add(at(kit.box(gx1 - (x1 + T), T, D + 2 * T + 0.35, th.ground.color, { surface: th.ground.surface, repeat: [2, 8] }), (gx1 + x1 + T) / 2, -T / 2, -0.175));
  house.add(at(kit.box(gx1 - x0 + 0.6, 0.12, gz1 - z0 + 0.6, INK), (gx1 + x0 - 0.6) / 2, -T - 0.06, (gz1 + z0 - 0.6) / 2));
  house.add(at(kit.box(0.35, T, D + 2 * T + 0.35, th.edge.color, { surface: th.edge.surface, repeat: [1, 8] }), x0 - T - 0.175, -T / 2, -0.175), at(kit.box(W + 2 * T + 0.35 + (gx1 - x1 - T), T, 0.35, th.edge.color, { surface: th.edge.surface, repeat: [12, 1] }), (x0 - T - 0.35 + gx1) / 2, -T / 2, z0 - T - 0.175));

  const brick: Paint = th.backLow;
  const plaster: Paint = th.upper;
  const sage: Paint = th.left;
  const side: Paint = th.side;
  const trimX = (g: THREE.Group, xa: number, xb: number, z: number, out: number, y: number) => g.add(at(kit.box(xb - xa, 0.08, T + 0.06, th.trim), (xa + xb) / 2, y + 0.04, z + (out * T) / 2));
  const trimZ = (g: THREE.Group, za: number, zb: number, x: number, out: number, y: number) => g.add(at(kit.box(T + 0.06, 0.08, zb - za, th.trim), x + (out * T) / 2, y + 0.04, (za + zb) / 2));

  // Pared del fondo: ladrillo abajo, revoque arriba; el living la tiene a doble altura.
  walls.push(
    wall(0, 0, -1, (full, stub) => {
      full.add(slabX(kit, x0 - T, x1 + T, z0, -1, 0, FLOOR_H, brick), slabX(kit, x0 - T, x1 + T, z0, -1, FLOOR_H, TOP, plaster));
      trimX(full, x0 - T, x1 + T, z0, -1, TOP);
      full.add(at(kit.box(W, 0.12, 0.04, th.trim), 0, 0.06, z0 + 0.02), at(kit.box(MEZZ.x1 - x0, 0.1, 0.04, th.darkWood), (x0 + MEZZ.x1) / 2, FLOOR_H + 0.05, z0 + 0.02));
      stub.add(slabX(kit, x0 - T, x1 + T, z0, -1, 0, 0.35, brick));
      const zf = z0 + 0.02;
      // Living: pizarrón (menú), neón y ventanal alto.
      full.add(at(menu("pizarron", P.chalkboard(c, 2.4, 1.5)), 5.0, 2.5, zf + 0.02), at(P.neonSign(c, "agent village", "#ff5fa2", 112), 5.0, 4.9, zf + 0.02));
      full.add(at(win(1.7, 3.8, 2, 5, "#e2553f"), 9.9, 2.7, zf));
      // Entrepiso: ventana del altillo, plantillas colgadas en el taller, corcho del estudio y cartel de la biblioteca.
      full.add(at(win(1.5, 1.3, 2, 2, "#f2b43c", false), -9.0, FLOOR_H + 1.75, zf));
      [["#e2553f", false], ["#3f7f76", true], ["#f2b43c", false], ["#9c6bff", true]].forEach(([col, dark], i) => full.add(at(P.picture(kit, 0.62, 0.8, INK, P.webMock(col as string, dark as boolean)), -7.6 + i * 0.78, FLOOR_H + 1.95, zf + 0.03)));
      full.add(at(P.corkboard(kit, 1.9, 1.1), -2.4, FLOOR_H + 1.85, zf + 0.02), at(P.neonSign(c, "skills", "#ffc93c", 56), 1.75, FLOOR_H + 2.55, zf + 0.02));
    }),
  );
  // Pared izquierda: mapa de La Plata (menú Negocios), cuadros que acompañan la escalera, ventana y reloj arriba.
  walls.push(
    wall(0, -1, 0, (full, stub) => {
      full.add(slabZ(kit, z0, z1 + T, x0, -1, 0, FLOOR_H, sage), slabZ(kit, z0, MEZZ.z1, x0, -1, FLOOR_H, TOP, plaster));
      trimZ(full, MEZZ.z1, z1 + T, x0, -1, FLOOR_H);
      trimZ(full, z0, MEZZ.z1, x0, -1, TOP);
      full.add(at(kit.box(0.04, 0.12, D, th.trim), x0 + 0.02, 0.06, 0));
      stub.add(slabZ(kit, z0, z1 + T, x0, -1, 0, 0.35, sage));
      const xf = x0 + 0.04;
      full.add(Y(menu("negocios", P.cityMap(kit, 3.6, 2.2)), xf, 2.35, 4.1, Math.PI / 2));
      full.add(Y(P.picture(kit, 0.7, 0.55, DARK_WOOD, (g, w, h) => ((g.fillStyle = "#8cc8ee"), g.fillRect(0, 0, w, h), (g.fillStyle = "#f2b43c"), g.fillRect(2, 2, 4, 4), (g.fillStyle = "#6aa860"), g.fillRect(0, h - 4, w, 4))), xf, 2.5, 0.5, Math.PI / 2));
      full.add(Y(P.picture(kit, 0.55, 0.7, "#c9a24a", (g, w, h) => ((g.fillStyle = "#f6f2ea"), g.fillRect(0, 0, w, h), (g.fillStyle = "#e2553f"), g.fillRect(3, 3, 5, 8), (g.fillStyle = "#4d8fe0"), g.fillRect(5, 6, 4, 6))), xf, 3.2, -0.9, Math.PI / 2));
      full.add(Y(win(1.4, 1.3, 2, 2, "#3f7f76", false), xf - 0.02, FLOOR_H + 1.75, -5.2, Math.PI / 2), Y(P.clock(c, INK), xf + 0.02, FLOOR_H + 2.1, -3.55, Math.PI / 2));
    }),
  );
  // Pared derecha y pared del frente (con la puerta): casi siempre bajas, porque la cámara mira desde ahí.
  walls.push(
    wall(0, 1, 0, (full, stub) => {
      full.add(slabZ(kit, z0, z1 + T, x1, 1, 0, FLOOR_H, side), slabZ(kit, z0, MEZZ.z1, x1, 1, FLOOR_H, TOP, side));
      trimZ(full, MEZZ.z1, z1 + T, x1, 1, FLOOR_H);
      trimZ(full, z0, MEZZ.z1, x1, 1, TOP);
      stub.add(slabZ(kit, z0, z1 + T, x1, 1, 0, 0.35, side));
      const xf = x1 - 0.04;
      full.add(Y(win(1.8, 2.2, 2, 3, "#e2553f", false), xf, 2.1, -4.6, -Math.PI / 2), Y(win(1.8, 1.6, 2, 2, "#3f7f76", false), xf, 1.9, 3.2, -Math.PI / 2));
    }),
    wall(0, 0, 1, (full, stub) => {
      full.add(slabX(kit, x0 - T, x1 + T, z1, 1, 0, FLOOR_H, side));
      trimX(full, x0 - T, x1 + T, z1, 1, FLOOR_H);
      stub.add(slabX(kit, x0 - T, 6.5, z1, 1, 0, 0.35, side), slabX(kit, 7.9, x1 + T, z1, 1, 0, 0.35, side));
      const zf = z1 - 0.04;
      for (const [x, w] of [[-6.2, 2.2], [-1, 2.2], [3.4, 1.6]]) full.add(Y(win(w, 1.6, 2, 2, "#f2b43c", false), x, 1.9, zf, Math.PI));
      full.add(Y(P.door(kit), 7.2, 0, z1 + 0.1, Math.PI));
    }),
  );

  // ── Living a doble altura ──
  house.add(Y(P.fireplace(c, TOP), 7.4, 0, z0));
  house.add(Y(P.rug(kit, 4.4, 3.0, "#3f6e7a", CREAM, "stripes"), 7.4, 0, -4.2));
  house.add(Y(P.sofa(kit, "#d9a441", INK), 10.25, 0, -4.2, -Math.PI / 2), Y(P.armchair(kit, "#c46a4a"), 4.7, 0, -4.5, Math.PI / 2));
  house.add(at(group(at(kit.box(1.3, 0.06, 0.8, DARK_WOOD, { surface: "wood" }), 0, 0.42, 0), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => at(kit.box(0.06, 0.4, 0.06, INK), a * 0.56, 0.2, b * 0.32)), at(kit.box(0.3, 0.03, 0.22, "#e2553f"), 0.25, 0.47, 0), at(kit.box(0.28, 0.025, 0.2, "#f2e46b"), 0.22, 0.495, 0.02, [0, 0.4, 0]), at(kit.cyl(0.05, 0.045, 0.1, CREAM), -0.3, 0.5, 0.1)), 7.4, 0, -4.2));
  house.add(Y(P.floorLamp(c, CREAM, INK), 10.4, 0, -6.3), Y(P.petBed(kit), 5.3, 0, -6.1), Y(P.monstera(c, 1.2), 3.95, 0, -6.4), Y(P.catTree(c), 10.2, 0, -1.3, -0.4), Y(P.fishTank(c), 10.6, 0, 0.9, -Math.PI / 2));
  house.add(Y(P.rug(kit, 3.2, 2.6, "#7a4a6b", CREAM), 6.2, 0, 0.5));
  // ── Entrada y contacto ──
  house.add(at(kit.box(1.2, 0.02, 0.7, "#3f5a6b", { surface: "stripes", shadow: false }), 7.2, 0.012, 6.3), Y(P.coatRack(kit), 5.9, 0, 6.5), Y(P.ficus(kit, 1.1), 10.45, 0, 6.5), Y(P.snakePlant(kit, 1), 10.6, 0, 1.9));
  house.add(Y(menu("contacto", P.phoneTable(c, o.state.contactPending)), 10.3, 0, 5.5));
  picks.push(pickBox("contacto", 1, 1.4, 1, 10.3, 0.7, 5.5));
  // ── Sala de trabajo y rincón del mapa ──
  house.add(Y(P.whiteboard(kit), -7.3, 0, -1.0, 0.5), Y(P.snakePlant(kit, 1.1, "#e8dfd0"), -6.9, 0, 6.5), Y(P.monstera(c, 1.0, "#c46a4a"), 3.3, 0, 6.5), Y(P.rug(kit, 9.6, 1.5, "#5d7c8a", CREAM), -1.2, 0, 1.8));
  house.add(Y(P.fileCabinet(kit), -10.62, 0, 3.0, Math.PI / 2), Y(P.globe(kit), -10.62, 1.2, 3.0), Y(P.ficus(kit, 0.9, "#3f5a6b"), -10.4, 0, 4.6));
  picks.push(pickBox("negocios", 0.5, 2.6, 3.8, x0 + 0.2, 2.35, 4.1));
  // ── Escalera al entrepiso (contra la pared izquierda) y cajas debajo ──
  house.add(at(P.stairs(kit, FLOOR_H, 1.5 - MEZZ.z1), -10.4, 0, 1.5));
  [["#c9a877", -10.45, -2.2, 0.7], ["#b98a5c", -10.4, -1.3, 0.5], ["#c9a877", -10.5, -2.25, 0.5]].forEach(([col, x, z, s], i) => house.add(at(kit.box(s as number, s as number, s as number, col as string, { surface: "wood" }), x as number, (i === 2 ? 0.7 : 0) + (s as number) / 2, z as number, [0, i * 0.3, 0])));
  // ── Debajo del entrepiso: cocina con isla (alcancía = menú Caja) y mesa de reuniones ──
  house.add(Y(P.kitchen(c), -8.4, 0, z0), Y(P.island(kit), -7.3, 0, -3.9), Y(menu("caja", P.piggy(c)), -7.9, 0.94, -3.9, 0.5));
  picks.push(pickBox("caja", 1, 0.9, 1, -7.9, 1.3, -3.9));
  house.add(at(P.pendant(c, 1.1, "#e2553f", 5, 2.4), -7.3, FLOOR_H - T, -3.9), at(P.pendant(c, 1.1, "#3f7f76", 5, 2.4), -0.6, FLOOR_H - T, -5.0));
  house.add(Y(P.bookshelf(kit, DARK_WOOD, 2.0, 1.15, 2), -4.75, 0, -5.7, Math.PI / 2), Y(P.snakePlant(kit, 0.7, "#e8dfd0"), -4.75, 1.15, -6.3), Y(P.monstera(c, 0.6), -4.75, 1.15, -5.2));
  house.add(Y(P.meetingTable(kit, LOOK), -0.6, 0, -5.0), Y(P.bookshelf(kit, WOOD, 1.6, 2.2, 4), -3.3, 0, z0 + 0.22), Y(P.printer(kit), 1.5, 0, -6.68), Y(P.waterCooler(c), 2.8, 0, -6.72));
  for (const x of [-4.0, MEZZ.x1 - 0.2]) house.add(at(kit.box(0.3, FLOOR_H - T, 0.3, th.darkWood, { surface: "wood", repeat: [1, 3] }), x, (FLOOR_H - T) / 2, MEZZ.z1 - 0.15));

  // ── Entrepiso: losa, barandas, taller, estudio y biblioteca ──
  const mw = MEZZ.x1 - MEZZ.x0;
  const md = MEZZ.z1 - MEZZ.z0;
  house.add(at(kit.box(mw, T, md, th.mezz, { surface: "wood", repeat: [7, 2] }), (MEZZ.x0 + MEZZ.x1) / 2, FLOOR_H - T / 2, (MEZZ.z0 + MEZZ.z1) / 2));
  house.add(at(kit.box(mw + 0.06, 0.1, 0.1, th.darkWood), (MEZZ.x0 + MEZZ.x1) / 2, FLOOR_H - T - 0.03, MEZZ.z1), at(kit.box(0.1, 0.1, md, th.darkWood), MEZZ.x1, FLOOR_H - T - 0.03, (MEZZ.z0 + MEZZ.z1) / 2));
  const railX0 = -9.75;
  house.add(at(P.railing(kit, MEZZ.x1 - railX0), (railX0 + MEZZ.x1) / 2, FLOOR_H, MEZZ.z1 - 0.06), Y(P.railing(kit, md - 0.1), MEZZ.x1 - 0.06, FLOOR_H, (MEZZ.z0 + MEZZ.z1) / 2, Math.PI / 2));
  const up = <O extends THREE.Object3D>(ob: O, x: number, z: number, ry = 0) => {
    house.add(Y(ob, x, FLOOR_H, z, ry));
    return ob;
  };
  up(P.rug(kit, 3.4, 2.2, "#c9793a", CREAM), -6.4, -4.8);
  up(menu("taller", P.easel(kit)), -4.7, -4.5, -0.35);
  picks.push(pickBox("taller", 1.2, 2, 1, -4.7, FLOOR_H + 1, -4.5));
  up(P.ficus(kit, 0.9), -10.4, -6.4);
  up(group(at(kit.cyl(0.2, 0.22, 0.5, "#6b7a8f", { seg: 8 }), 0, 0.25, 0), ...[0, 1, 2, 3].map((i) => at(kit.cyl(0.03, 0.03, 0.8, ["#f4f1ea", "#f2e46b", "#8fd3f2", "#f29bb5"][i], { seg: 5 }), Math.sin(i * 1.6) * 0.08, 0.6, Math.cos(i * 1.6) * 0.08, [Math.sin(i) * 0.15, 0, Math.cos(i) * 0.15]))), -5.2, -6.5); // tubos de planos
  up(P.fileCabinet(kit, "#8a6a8f"), -0.9, -6.62);
  up(P.globe(kit), -0.9, -6.62).position.setY(FLOOR_H + 1.2);
  up(P.bookshelf(kit, DARK_WOOD, 1.5, 2.3, 4), 0.95, -6.78);
  up(P.bookshelf(kit, DARK_WOOD, 1.5, 2.3, 4), 2.55, -6.78);
  up(menu("tienda", P.shopCounter(c)), 1.7, -5.0);
  up(P.rug(kit, 2.6, 1.6, "#7a4a6b", "#e2b23c"), 1.7, -3.9);
  up(P.armchair(kit, "#3f7f76"), 0.2, -3.7, 0.9);
  up(P.hangingPlant(kit), 3.1, -3.2).position.setY(FLOOR_H + 2.3);
  picks.push(pickBox("tienda", 2.1, 1.9, 1.5, 1.7, FLOOR_H + 0.95, -5.3));
  picks.push(pickBox("pizarron", 2.6, 1.7, 0.4, 5.0, 2.5, z0 + 0.2));

  // ── Jardín: camino, buzón (menú Bandeja), canteros, árbol, banco, farol, estanque y huerta ──
  for (let i = 0; i < 5; i++) house.add(at(kit.box(0.95, 0.05, 0.6, th.path, { surface: "stone" }), 7.2 + (i % 2 ? 0.12 : -0.1), 0.02, 7.75 + i * 0.75, [0, (i % 2 ? 1 : -1) * 0.06, 0]));
  house.add(Y(menu("bandeja", P.mailbox(c, o.state.waitingApproval)), 10.4, 0, 9.3));
  picks.push(pickBox("bandeja", 0.9, 1.8, 0.9, 10.4, 0.9, 9.3));
  house.add(Y(P.flowerBed(kit, 5.2), -4.6, 0, 7.65), Y(P.flowerBed(kit, 3.6), 3.2, 0, 7.65), Y(P.flowerBed(kit, 2.2), 9.7, 0, 7.65), Y(P.flowerBed(kit, 4.5, ["#ffffff", "#c17ee0", "#f2e46b"]), 11.65, 0, -3.4, Math.PI / 2));
  house.add(Y(P.themedTree(c, th.tree, 1.15), -9.3, 0, 9.5), Y(P.bench(kit), -5.4, 0, 10.0, Math.PI), Y(P.lampPost(c), -3.2, 0, 10.4), Y(P.pond(c), -0.4, 0, 9.5));
  house.add(Y(P.crate(kit, ["#e8923a", "#e8923a", "#e8923a", "#e2553f", "#e2553f", "#6aa860", "#6aa860"]), 4.2, 0, 10.2), Y(P.crate(kit, ["#6aa860", "#6aa860", "#e2553f", "#f2e46b", "#f2e46b"]), 5.35, 0, 10.2, 0.1));
  house.add(Y(P.bush(kit, 2.2), -6.8, 0, 10.75), Y(P.bush(kit, 1.6), 13.4, 0, -5.6, Math.PI / 2), Y(P.bush(kit, 1.2), 13.5, 0, -1.6, Math.PI / 2), Y(P.bicycle(kit), 11.75, 0, 4.9, Math.PI / 2));
  for (let i = 0; i < 6; i++) house.add(at(kit.cyl(0.32, 0.32, 0.05, th.path, { surface: "stone", seg: 7 }), 12.6 + (i % 2) * 0.25, 0.02, 1.2 + i * 1.3));
  house.add(P.flyer(c, 2.5, 1.1, 9.4, "#f29bb5", false), P.flyer(c, -5, 1.3, 9.2, "#f2e46b", false), P.flyer(c, 12.3, 1.0, -2.5, "#8fd3f2", false));
  for (const [x, z] of [[-8, 9.5], [0, 9.6], [6, 9.8], [12.5, 3], [12.6, -4]]) house.add(P.flyer(c, x, 1.0, z, "#d8f26b", true));
  // Clima de la variante: sobre el jardín del frente y del costado (la casa no tiene techo: adentro no cae nada).
  if (th.weather) {
    house.add(P.weather(c, th.weather, { x0: x0 - 0.6, x1: gx1, z0: z1 + 0.5, z1: gz1, top: 9 }));
    house.add(P.weather(c, th.weather, { x0: x1 + 0.5, x1: gx1, z0: z0, z1: z1, top: 9 }));
  }
  if (th.tree !== "apple") house.add(Y(P.themedTree(c, th.tree, 0.9), 13.3, 0, 8.8)); // un segundo árbol de la variante
  // humo de la chimenea
  house.add(at(P.steam(c, "#d9d4cc", 0.16, 1.6), 7.4, TOP + 0.3, z0 + 0.3));

  addDesks(house, 0, LOOK);
  // Trampilla al sótano (solo si hay sótanos): tapa abierta y escalera de mano.
  if (o.basements.length) {
    house.add(at(kit.box(1.1, 0.02, 1.1, "#15121a", { shadow: false }), -10.2, 0.012, 6.2), at(kit.box(1.1, 0.06, 1.1, DARK_WOOD, { surface: "wood" }), -10.85, 0.5, 6.2, [0, 0, 1.25]));
    for (const s of [-1, 1]) house.add(at(kit.box(0.05, 0.9, 0.05, WOOD), -10.2 + s * 0.25, 0.45, 5.75));
  }
  bake(house);
  for (const w of walls) house.add(w.full, w.stub);

  // ═══════════ Sótanos ═══════════
  const root = group(house);
  const levels = [house];
  const caps: THREE.Object3D[] = [];
  // Los sótanos no se ven desde la casa: cada uno aparece solo, como maqueta, cuando se lo enfoca (usuario, 2026-11-10).
  o.basements.forEach((variant, i) => {
    const k = i + 1;
    const g = buildBasement(c, variant, k, o.basementNames[i] || `Sótano ${k}`);
    addDesks(g.group, k, g.look);
    bake(g.group);
    g.group.traverse((m) => {
      // Bajo tierra no llega el sol: sin sombras del sol, lo iluminan sus lámparas.
      m.castShadow = false;
      m.receiveShadow = false;
    });
    for (const w of g.walls) g.group.add(w.full, w.stub);
    g.group.add(g.cap);
    caps.push(g.cap);
    walls.push(...g.walls);
    root.add(g.group);
    levels.push(g.group);
  });
  return { root, levels, caps, walls, desks, frames, lights, picks, outlines };
}

// ---------- Sótano de oficina, en tres variantes ----------

function buildBasement(c: Ctx, variant: string, k: number, name: string) {
  const { kit } = c;
  const { x0, x1, z0, z1, pitch, room } = BASEMENT;
  const y = -pitch * k;
  const g = group();
  const V = {
    moderna: { floor: { color: "#8f98a8", surface: "felt" as Surface }, wall: { color: "#e3d6bd", surface: "wood" as Surface }, look: { top: "#f1ece4", topSurface: "plain" as Surface, leg: "#c3c9d2", chair: "#5fa98f", accent: "#4d8fe0" }, lamp: "#ffffff", light: "#f4f1ff" },
    ladrillo: { floor: { color: "#8a8480", surface: "concrete" as Surface }, wall: { color: "#a95a43", surface: "brick" as Surface }, look: { top: "#8a5a3b", topSurface: "wood" as Surface, leg: INK, chair: "#6e4a36", accent: "#e8a84a" }, lamp: "#e8a84a", light: "#ffc98a" },
    tecnica: { floor: { color: "#3a4054", surface: "tile" as Surface }, wall: { color: "#4a5270", surface: "metal" as Surface }, look: { top: "#2c3142", topSurface: "plain" as Surface, leg: "#8e96a3", chair: "#9c6bff", accent: "#7df0d0" }, lamp: "#9c6bff", light: "#b9a8ff" },
  }[variant as "moderna" | "ladrillo" | "tecnica"] ?? null;
  const v = V!;
  const w = x1 - x0;
  const d = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  // piso, y la losa de arriba (el techo), con su canto a la vista
  g.add(at(kit.box(w + 2 * T, 0.4, d + 2 * T, v.floor.color, { surface: v.floor.surface, repeat: [12, 5] }), cx, y - 0.2, cz));
  // El techo va aparte: al enfocar este sótano se saca, para verlo desde arriba.
  const cap = group(
    k > 1
      ? at(kit.box(w + 2 * T, pitch - room - 0.4 + 0.02, d + 2 * T, "#5a5560", { surface: "concrete", repeat: [12, 1], shadow: false }), cx, y + room + (pitch - room - 0.4) / 2, cz)
      : at(kit.box(w + 2 * T, pitch - room - 0.37, d + 2 * T, "#6e5a44", { surface: "earth", repeat: [12, 1], shadow: false }), cx, y + room + (pitch - room - 0.37) / 2, cz),
  );
  cap.traverse((m) => (m.receiveShadow = false));
  const walls: Wall[] = [
    wall(k, 0, -1, (full, stub) => {
      full.add(slabX(kit, x0 - T, x1 + T, z0, -1, y, y + room, v.wall));
      stub.add(slabX(kit, x0 - T, x1 + T, z0, -1, y, y + 0.35, v.wall));
      const zf = z0 + 0.03;
      const cartel = kit.glow("#ffffff");
      cartel.map = canvasTexture(64, 14, (x) => {
        x.fillStyle = "#1c1a22";
        x.fillRect(0, 0, 64, 14);
        x.fillStyle = v.lamp;
        x.font = "bold 10px monospace";
        x.textBaseline = "middle";
        x.textAlign = "center";
        x.fillText(name.toUpperCase(), 32, 8, 60);
      });
      full.add(at(kit.plane(2.2, 0.48, cartel), x0 + 2.0, y + 2.75, zf));
      if (variant === "moderna") {
        full.add(at(P.picture(kit, 1.4, 0.9, INK, P.webMock("#4d8fe0")), -2, y + 2.0, zf), at(P.picture(kit, 0.9, 0.9, INK, P.webMock("#5fa98f", true)), 0, y + 2.0, zf), at(P.clock(c, "#c3c9d2"), 6, y + 2.5, zf + 0.03));
        for (let i = 0; i < 9; i++) full.add(at(kit.box(0.05, room - 0.3, 0.04, "#d2c3a6"), x0 + 1.3 + i * 2.7, y + room / 2, zf));
      } else if (variant === "ladrillo") {
        full.add(at(P.pipe(kit, w - 0.6), cx, y + 3.05, zf + 0.1), at(P.pipe(kit, w - 0.6, "#8e96a3", 0.04), cx, y + 2.8, zf + 0.08), at(P.neonSign(c, "sotano", "#e8a84a", 60), 4, y + 2.1, zf));
        full.add(at(P.picture(kit, 1.2, 0.8, DARK_WOOD, P.webMock("#e8a84a", true)), -3.5, y + 1.9, zf));
      } else {
        for (let i = 0; i < 6; i++) full.add(at(kit.box(1.5, 0.9, 0.05, "#1b2030"), -6 + i * 3.4, y + 2.1, zf), at(kit.plane(1.4, 0.8, kit.glow(["#7df0d0", "#9c6bff", "#5fb4f0"][i % 3], 0.85)), -6 + i * 3.4, y + 2.1, zf + 0.03));
        full.add(at(kit.box(w - 0.4, 0.06, 0.06, kit.glow("#9c6bff")), cx, y + 3.2, zf));
      }
    }),
    wall(k, -1, 0, (full, stub) => {
      full.add(slabZ(kit, z0, z1 + T, x0, -1, y, y + room, v.wall));
      stub.add(slabZ(kit, z0, z1 + T, x0, -1, y, y + 0.35, v.wall));
      // escalera de mano que viene de arriba
      for (const s of [-1, 1]) full.add(at(kit.box(0.06, room, 0.06, WOOD), x0 + 0.3, y + room / 2, 6.2 + s * 0.28));
      for (let i = 0; i < 9; i++) full.add(at(kit.box(0.05, 0.05, 0.56, WOOD), x0 + 0.3, y + 0.35 + i * 0.37, 6.2));
    }),
    wall(k, 1, 0, (full, stub) => {
      full.add(slabZ(kit, z0, z1 + T, x1, 1, y, y + room, v.wall));
      stub.add(slabZ(kit, z0, z1 + T, x1, 1, y, y + 0.35, v.wall));
    }),
    wall(k, 0, 1, (full, stub) => {
      full.add(slabX(kit, x0 - T, x1 + T, z1, 1, y, y + room, v.wall));
      stub.add(slabX(kit, x0 - T, x1 + T, z1, 1, y, y + 0.35, v.wall));
    }),
  ];
  // luces de techo (siempre prendidas) y decoración de cada variante
  for (const x of [-5.5, 1.5, 8.5]) {
    g.add(at(kit.box(1.6, 0.06, 0.3, "#d9dde3"), x, y + room - 0.03, 6.2), at(kit.box(1.5, 0.03, 0.22, kit.glow(v.light)), x, y + room - 0.07, 6.2));
    const l = at(new THREE.PointLight(v.light, 0, 13, 1.6), x, y + room - 0.5, 6.2);
    g.add(l);
    c.light(l, 9, 7);
  }
  const put = (ob: THREE.Object3D, x: number, z: number, ry = 0) => g.add(Y(ob, x, y, z, ry));
  if (variant === "moderna") {
    put(P.rug(kit, 3, 2.4, "#5fa98f", CREAM), 12.0, 2.6);
    put(P.sofa(kit, "#4d8fe0", "#c3c9d2", 2.0), 12.2, 1.4);
    put(P.ficus(kit, 1.1, "#f1ece4"), 13.0, 9.9);
    put(P.monstera(c, 1.0), -9.8, 1.2);
    put(P.waterCooler(c), -9.9, 9.9);
    put(P.whiteboard(kit), -5.5, 1.0);
    put(P.snakePlant(kit, 1, "#f1ece4"), 10.6, 1.0);
  } else if (variant === "ladrillo") {
    put(P.rug(kit, 3, 2.4, "#7a4a6b", "#e8a84a"), 12.0, 2.6);
    put(P.armchair(kit, "#6e4a36"), 12.6, 1.6, -0.5);
    put(P.bookshelf(kit, DARK_WOOD, 1.6, 2.2, 4), 10.6, 0.75);
    put(P.floorLamp(c, "#e8a84a", INK, 6), 13.0, 3.4);
    for (const [x, z, s] of [[-9.8, 1.2, 0.8], [-9.0, 1.1, 0.6], [-9.7, 2.0, 0.55]]) g.add(at(kit.box(s, s, s, "#b98a5c", { surface: "wood" }), x, y + s / 2, z, [0, x, 0]));
    for (const [x, z] of [[-9.8, 9.8], [-8.9, 9.9]]) g.add(at(kit.cyl(0.36, 0.36, 0.95, "#8a5a3b", { surface: "wood", seg: 8 }), x, y + 0.48, z), at(kit.torus(0.37, 0.03, INK), x, y + 0.7, z, [Math.PI / 2, 0, 0]), at(kit.torus(0.37, 0.03, INK), x, y + 0.25, z, [Math.PI / 2, 0, 0]));
    put(P.snakePlant(kit, 1, "#6e4a36"), 13.0, 9.9);
  } else {
    for (let i = 0; i < 4; i++) put(P.serverRack(c, i), 10.4 + i * 0.95, 0.95);
    put(P.serverRack(c, 5), -9.9, 1.4, Math.PI / 2);
    put(P.serverRack(c, 7), -9.9, 2.4, Math.PI / 2);
    g.add(at(kit.box(x1 - x0 - 1, 0.04, 0.5, "#2c3142", { surface: "metal" }), cx, y + room - 0.35, 2.2), at(kit.box(0.12, 0.02, d - 1, kit.glow("#7df0d0", 0.9)), 6.2, y + 0.012, cz), at(kit.box(0.12, 0.02, d - 1, kit.glow("#9c6bff", 0.9)), -2.2, y + 0.012, cz));
    put(P.fileCabinet(kit, "#4a5270"), 13.1, 9.9, Math.PI);
  }
  return { group: g, walls, look: v.look, cap: live(cap) };
}
