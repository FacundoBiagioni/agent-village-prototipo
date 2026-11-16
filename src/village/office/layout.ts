// Plano de la casa (reforma 2026-11-10): medidas, escritorios, caminos y sótanos. Datos puros, sin three:
// lo usan la escena (para dibujar), las acciones del servidor (para validar) y los tests.
// Ejes: x hacia la derecha, z hacia el frente (el jardín), y hacia arriba. 1 unidad = 1 metro, más o menos.

/** Planta baja: interior de la casa. */
export const HOUSE = { x0: -11, x1: 11, z0: -7, z1: 7 };
/** Altura de piso a piso (planta baja → entrepiso) y alto de las paredes de arriba. */
export const FLOOR_H = 4;
export const UPPER_H = 2.9;
/** Entrepiso: cubre el fondo a la izquierda; el living queda a doble altura. Así las dos plantas se ven siempre juntas. */
export const MEZZ = { x0: -11, x1: 3.5, z0: -7, z1: -2.8 };
/** Hasta dónde llega el jardín (frente y costado derecho). */
export const GARDEN = { x1: 14, z1: 11 };
/** Sótanos: una sala de oficina por nivel, abierta hacia el frente y la derecha (se ve en corte, como un hormiguero). */
export const BASEMENT = { x0: -10.5, x1: 13.6, z0: 0.5, z1: 10.6, pitch: 4, room: 3.5 };
export const MAX_BASEMENTS = 4;

/** Nombres que el usuario le pone a las plantas (vacío = el de siempre). */
export type FloorNames = { house: string; basements: string[]; houseShort: string; basementShorts: string[] };
export const NAME_MAX = 28;
export const SHORT_MAX = 5;
/** Lo que dice el botón de cada planta (Casa, S1...): la abreviatura que puso el usuario o la de siempre. */
export const floorShort = (names: FloorNames, level: number) => (level ? names.basementShorts[level - 1] || `S${level}` : names.houseShort || "Casa");
/** Nombre que se muestra de cada planta. 0 = la casa. */
export const floorName = (names: FloorNames, level: number) => (level ? names.basements[level - 1] || `Sótano ${level}` : names.house || "La casa");

export type BasementVariant = { id: string; name: string; idea: string; swatch: [string, string, string] };
export const BASEMENT_VARIANTS: BasementVariant[] = [
  { id: "moderna", name: "Oficina moderna", idea: "Alfombra gris, paneles de madera clara, plantas y luz blanca.", swatch: ["#8f98a8", "#e3d6bd", "#5fa98f"] },
  { id: "ladrillo", name: "Sótano de ladrillo", idea: "Ladrillo a la vista, caños de cobre, lámparas colgantes cálidas.", swatch: ["#a95a43", "#6e4a36", "#e8a84a"] },
  { id: "tecnica", name: "Sala técnica", idea: "Piso técnico, servidores con lucecitas y neón violeta.", swatch: ["#2c3142", "#4a5270", "#9c6bff"] },
];

/** level: 0 = la casa (planta baja y entrepiso); 1, 2... = sótano. rot: hacia dónde mira el agente (0 = al frente). */
export type DeskSlot = { id: string; zone: string; level: number; x: number; y: number; z: number; rot: number };

const d = (id: string, zone: string, x: number, z: number, y = 0, rot = 0): DeskSlot => ({ id, zone, level: 0, x, y, z, rot });

/** Escritorios de la casa. Los cuatro primeros son los lugares "de siempre" de cada agente (HOME). */
export const HOUSE_DESKS: DeskSlot[] = [
  d("living", "Living", 6.2, 0.2),
  d("contacto", "Entrada", 9.2, 3.4),
  d("taller", "Taller", -6.6, -5.6, FLOOR_H),
  d("estudio", "Estudio", -2.4, -5.6, FLOOR_H),
  ...[-5.4, -2.6, 0.2, 3.0].flatMap((x, i) => [d(`sala-${i + 1}`, "Sala de trabajo", x, -0.6), d(`sala-${i + 5}`, "Sala de trabajo", x, 3.0)]),
  d("mapa", "Rincón del mapa", -8.7, 4.9, 0, Math.PI / 2),
  d("altillo", "Altillo", -9.0, -5.6, FLOOR_H),
];

const HOME: Record<string, string> = { encargado: "living", comunicador: "contacto", disenador: "taller", analista: "estudio", cobrador: "sala-1", hosting: "altillo" };

export function basementDesks(level: number): DeskSlot[] {
  const xs = [-7.6, -3.4, 0.8, 5.0, 9.2];
  return [4.2, 8.0].flatMap((z, row) => xs.map((x, i) => ({ id: `s${level}-${row * 5 + i + 1}`, zone: `Sótano ${level}`, level, x, y: -BASEMENT.pitch * level, z, rot: 0 })));
}

/** Todos los escritorios que existen con esa cantidad de sótanos. */
export function allDesks(basements: number): DeskSlot[] {
  return [...HOUSE_DESKS, ...Array.from({ length: basements }, (_, i) => basementDesks(i + 1)).flat()];
}

/** Dónde se sienta cada agente: lo que eligió el usuario si sigue siendo válido; si no, su lugar de siempre; si no, el primero libre. */
export function assignDesks(agentIds: string[], chosen: Record<string, string>, basements: number): Record<string, DeskSlot> {
  const desks = allDesks(basements);
  const taken = new Set<string>();
  const out: Record<string, DeskSlot> = {};
  const take = (agent: string, deskId: string | undefined) => {
    const desk = deskId && !taken.has(deskId) ? desks.find((x) => x.id === deskId) : undefined;
    if (!desk || out[agent]) return;
    taken.add(desk.id);
    out[agent] = desk;
  };
  for (const a of agentIds) take(a, chosen[a]);
  for (const a of agentIds) take(a, HOME[a]);
  for (const a of agentIds) take(a, desks.find((x) => !taken.has(x.id))?.id);
  return out;
}

// ---------- Caminos: los agentes van por pasillos y escaleras, no en línea recta ----------

export type P3 = { x: number; y: number; z: number };
type Node = P3 & { id: string; level: number };
const n = (id: string, x: number, z: number, y = 0, level = 0): Node => ({ id, x, y, z, level });

const HOUSE_NODES: Node[] = [
  // pasillo del medio, entre las dos filas de la sala
  n("c0", -9, 1.8), n("c1", -4, 1.8), n("c2", 1.6, 1.8), n("c3", 4.6, 1.8), n("c4", 8, 1.8),
  // pasillo del frente y puerta
  n("f0", -6, 5.8), n("f1", -4, 5.8), n("f2", 1.6, 5.8), n("f3", 4.6, 5.8), n("f4", 7.2, 5.8), n("door", 7.2, 7.4),
  // jardín
  n("g1", 7.2, 9.3), n("g2", 2, 9.6), n("g3", -4, 9.6), n("g4", 12.4, 9.2), n("g5", 12.6, 2),
  // pasillo del fondo (borde del entrepiso), cocina y living
  n("b0", -8, -2), n("b1", -4, -2), n("b2", 1.6, -2), n("b3", 4.6, -2.2), n("k1", -7.4, -4.4), n("m1", -1, -4.6),
  n("l1", 7.6, -2.4), n("l2", 6.2, -5.4),
  // escalera y entrepiso
  n("st0", -10.35, 1.9), n("st1", -10.35, -3.3, FLOOR_H), n("u1", -7.6, -3.6, FLOOR_H), n("u2", -3.4, -3.6, FLOOR_H), n("u3", 1.2, -3.6, FLOOR_H),
  // trampilla al sótano
  n("hatch", -10.2, 6.2),
];
const HOUSE_EDGES: [string, string][] = [
  ["c0", "c1"], ["c1", "c2"], ["c2", "c3"], ["c3", "c4"],
  ["f0", "f1"], ["f1", "f2"], ["f2", "f3"], ["f3", "f4"], ["f4", "door"], ["door", "g1"], ["g1", "g2"], ["g2", "g3"], ["g1", "g4"], ["g4", "g5"],
  ["b0", "b1"], ["b1", "b2"], ["b2", "b3"], ["b3", "l1"], ["l1", "l2"], ["b0", "k1"], ["b1", "k1"], ["b1", "m1"], ["b2", "m1"],
  ["c0", "b0"], ["c1", "b1"], ["c2", "b2"], ["c3", "b3"], ["c1", "f1"], ["c2", "f2"], ["c3", "f3"], ["c4", "f4"], ["c4", "l1"], ["c0", "f0"],
  ["c0", "st0"], ["st0", "st1"], ["st1", "u1"], ["u1", "u2"], ["u2", "u3"],
  ["f0", "hatch"],
];

function graph(basements: number) {
  const nodes = [...HOUSE_NODES];
  const edges = [...HOUSE_EDGES];
  for (let k = 1; k <= basements; k++) {
    const y = -BASEMENT.pitch * k;
    const xs = [-9.6, -5.5, -1.3, 2.9, 7.1, 11.4];
    xs.forEach((x, i) => {
      nodes.push(n(`s${k}a${i}`, x, 6.4, y, k));
      if (i) edges.push([`s${k}a${i - 1}`, `s${k}a${i}`]);
    });
    edges.push([k === 1 ? "hatch" : `s${k - 1}a0`, `s${k}a0`]); // la escalera baja de nivel en nivel
  }
  return { nodes, edges };
}

const dist = (a: P3, b: P3) => Math.hypot(a.x - b.x, (a.y - b.y) * 2, a.z - b.z);

/** Camino entre dos puntos de la casa, por los pasillos (Dijkstra sobre un grafo chico). Incluye los dos extremos. */
export function route(from: P3, to: P3, basements: number): P3[] {
  const { nodes, edges } = graph(basements);
  const near = (p: P3) => nodes.reduce((best, x) => (dist(x, p) < dist(best, p) ? x : best));
  const a = near(from);
  const b = near(to);
  const cost = new Map<string, number>([[a.id, 0]]);
  const prev = new Map<string, string>();
  const open = new Set(nodes.map((x) => x.id));
  const byId = new Map(nodes.map((x) => [x.id, x]));
  while (open.size) {
    let cur: string | undefined;
    for (const id of open) if (cost.has(id) && (cur === undefined || cost.get(id)! < cost.get(cur)!)) cur = id;
    if (cur === undefined || cur === b.id) break;
    open.delete(cur);
    for (const [p, q] of edges) {
      const other = p === cur ? q : q === cur ? p : null;
      if (!other || !open.has(other)) continue;
      const c = cost.get(cur)! + dist(byId.get(cur)!, byId.get(other)!);
      if (c < (cost.get(other) ?? Infinity)) {
        cost.set(other, c);
        prev.set(other, cur);
      }
    }
  }
  const mid: P3[] = [];
  for (let id: string | undefined = b.id; id; id = prev.get(id)) mid.unshift(byId.get(id)!);
  if (mid[0] !== a) return [from, to]; // sin camino (no debería pasar): línea recta
  return [from, ...mid, to];
}

/** Punto al costado de un escritorio (donde se para el que viene de visita), en coordenadas de la casa. */
export function besideDesk(desk: DeskSlot, side = -0.95, front = 0.35): P3 {
  const c = Math.cos(desk.rot);
  const s = Math.sin(desk.rot);
  return { x: desk.x + side * c + front * s, y: desk.y, z: desk.z - side * s + front * c };
}

/** Objetos de la casa que abren un menú: lo que dice el cartelito al pasar el mouse. */
export const MENU_SPOTS: { menu: string; label: string }[] = [
  { menu: "bandeja", label: "Buzón: bandeja de aprobación" },
  { menu: "negocios", label: "Mapa de La Plata: negocios" },
  { menu: "taller", label: "Caballete: demos y plantillas" },
  { menu: "contacto", label: "Teléfono y agenda: mensajes y visitas" },
  { menu: "caja", label: "Alcancía: ventas y cobros" },
  { menu: "pizarron", label: "Pizarrón: métricas y tareas" },
  { menu: "tienda", label: "Don Ramón, el librero: tienda de skills" },
];
