// Escena de la casa: cámara de maqueta (mover, girar, acercar), día y noche, animaciones por estado, clic en agentes y objetos,
// plantas que se enfocan (casa o sótanos) y el modo ASCII. Solo dibuja: el estado de cada agente le llega de afuera.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { VillageState } from "../state";
import { ACCENT_LAYER, AsciiPass, type AsciiConfig } from "./ascii";
import { buildAgent, buildBlacky, catSpecies, coatFor, setBattery, SKINS, SPECIES, type Rig } from "./characters";
import { buildHouse, type House } from "./house";
import { houseTheme } from "./house-themes";
import { backgroundOf } from "./backgrounds";
import { freezeStatic, group, Kit, outline, textSprite } from "./kit";
import { BASEMENT, besideDesk, FLOOR_H, MENU_SPOTS, route, type DeskSlot, type P3 } from "./layout";
import type { Desk } from "./props";

/** Lo que la casa necesita saber de cada agente (sale de getAgentStates). */
export type AgentView = { id: string; name: string; desk: DeskSlot; skin: string; state: VillageState; movingTo: DeskSlot | null; patrol?: boolean };
export type OfficeOptions = {
  species: string;
  light: "auto" | "day" | "night";
  pixel: boolean;
  energy: number;
  agents: AgentView[];
  /** Variante de cada sótano, de arriba hacia abajo, y el nombre que le puso el usuario. */
  basements: string[];
  basementNames: string[];
  /** Variante entera de la casa (botón Skins). */
  houseTheme: string;
  /** Fondo detrás de la casa (botón Skins); "casa" = el color de la variante. */
  background: string;
  /** Raza elegida para cada agente (botón Skins). */
  coats: Record<string, string>;
  /** Planta enfocada: 0 = la casa; k = sótano k (lo de arriba se oculta). */
  level: number;
  /** Hay algo en la bandeja / en contacto: el buzón levanta la banderita y el teléfono suena. */
  waitingApproval: boolean;
  contactPending: boolean;
  ascii: AsciiConfig;
};
/** Id del agente tocado, "pet", "menu:<id>" o null. */
export type Picked = string | null;
export type Portraits = Record<string, { head: string }>;

/** De noche según la hora de la PC (de 19 a 7). */
export const isNightHour = (d = new Date()) => d.getHours() >= 19 || d.getHours() < 7;

type Fx = { sign: THREE.Sprite; zzz: THREE.Sprite; smoke: THREE.Mesh[]; sparks: THREE.Mesh[] };
type Stop = { p: P3; rest: number; pose?: "sit" | "sleep" | "talk"; look?: P3 };
type Leg = { pts: THREE.Vector3[]; cum: number[]; len: number; stop: Stop };
type Tour = { legs: Leg[]; total: number; speed: number };
type Agent = { view: AgentView; rig: Rig; desk: Desk; fx: Fx; tour: Tour | null; tourKey: string };
type Pet = ReturnType<typeof buildBlacky>;
type World = { root: THREE.Group; house: House; agents: Agent[]; pet: Pet; petZzz: THREE.Sprite; petTour: Tour; npc: Rig; actors: THREE.Group };

const V = (p: P3) => new THREE.Vector3(p.x, p.y, p.z);
const levelOfY = (y: number) => (y < -1 ? Math.ceil((-y - 1) / BASEMENT.pitch) : 0);
const headingTo = (from: P3, to: P3) => Math.atan2(to.x - from.x, to.z - from.z);

/** Recorrido en ciclo: de cada parada a la siguiente por los pasillos, descansando en cada una. */
function makeTour(stops: Stop[], speed: number, basements: number): Tour {
  const legs = stops.map((stop, i) => {
    const from = stops[(i + stops.length - 1) % stops.length].p;
    const pts = route(from, stop.p, basements).map(V);
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + pts[k - 1].distanceTo(pts[k]));
    return { pts, cum, len: cum[cum.length - 1], stop };
  });
  return { legs, speed, total: legs.reduce((s, l) => s + l.len / speed + l.stop.rest, 0) };
}

const tmpA = new THREE.Vector3();
/** Dónde está a los `time` segundos: caminando (con rumbo) o descansando en una parada. */
function tourAt(tour: Tour, time: number, pos: THREE.Vector3) {
  let left = time % tour.total;
  for (const leg of tour.legs) {
    const walk = leg.len / tour.speed;
    if (left < walk) {
      const dist = left * tour.speed;
      let k = 1;
      while (k < leg.cum.length - 1 && leg.cum[k] < dist) k++;
      const a = leg.pts[k - 1];
      const b = leg.pts[k];
      const f = (dist - leg.cum[k - 1]) / Math.max(1e-6, leg.cum[k] - leg.cum[k - 1]);
      pos.lerpVectors(a, b, f);
      return { walking: true, heading: headingTo(a, b), stop: null, restT: 0 };
    }
    left -= walk;
    if (left < leg.stop.rest) {
      pos.copy(tmpA.set(leg.stop.p.x, leg.stop.p.y, leg.stop.p.z));
      return { walking: false, heading: leg.stop.look ? headingTo(leg.stop.p, leg.stop.look) : null, stop: leg.stop, restT: left };
    }
    left -= leg.stop.rest;
  }
  pos.copy(tour.legs[0].pts[0]);
  return { walking: false, heading: null, stop: null, restT: 0 };
}

const PET_STOPS: Stop[] = [
  { p: { x: 5.3, y: 0, z: -6.1 }, rest: 9, pose: "sleep" },
  { p: { x: 5.2, y: 0, z: 0.9 }, rest: 4, pose: "sit", look: { x: 6.2, y: 0, z: 0.2 } },
  { p: { x: 1.6, y: 0, z: 1.8 }, rest: 0 },
  { p: { x: 2.4, y: 0, z: 9.7 }, rest: 5, pose: "sit", look: { x: -0.4, y: 0, z: 9.5 } },
  { p: { x: -4, y: 0, z: 9.6 }, rest: 3, pose: "sit", look: { x: -9.3, y: 0, z: 9.5 } },
  { p: { x: -6.4, y: 0, z: -2.6 }, rest: 4, pose: "sit", look: { x: -7.3, y: 0, z: -3.9 } },
  { p: { x: 7.6, y: 0, z: -2.4 }, rest: 0 },
];

/** `labels`: contenedor con carteles; la escena ubica cada [data-label=agente] sobre su cabeza y cada [data-anchor="x,y,z"] en su punto. */
export function createOffice(canvas: HTMLCanvasElement, onPick: (p: Picked) => void, labels?: HTMLElement, onPortraits?: (p: Portraits) => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Las sombras no se recalculan en cada cuadro: unas 30 veces por segundo alcanzan (se mueven despacio) y es la mitad de los dibujos.
  renderer.shadowMap.autoUpdate = false;
  const SHADOW_EVERY = 1 / 30;
  let shadowAt = -1;
  const scene = new THREE.Scene();
  const bg = new THREE.Color();
  scene.background = bg;
  // Fondos dibujados (se hacen una vez cada uno y se guardan).
  const backdrops = new Map<string, THREE.Texture>();
  const backdrop = (id: string) => {
    let t = backdrops.get(id);
    if (!t) {
      const b = backgroundOf(id);
      const c = document.createElement("canvas");
      c.width = 1280;
      c.height = 800;
      b.draw?.(c.getContext("2d")!, c.width, c.height);
      t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      backdrops.set(id, t);
    }
    return t;
  };
  const ascii = new AsciiPass(renderer);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const controls = new OrbitControls(camera, canvas);
  // Arrastrar mueve la casa; botón derecho (o dos dedos) la gira y la inclina un poco; la rueda acerca.
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.enableDamping = true;
  controls.screenSpacePanning = false;
  controls.minZoom = 0.4;
  controls.maxZoom = 5;
  controls.minPolarAngle = 0.62;
  controls.maxPolarAngle = 1.2;
  controls.zoomToCursor = true;
  const HOME_TARGET = new THREE.Vector3(1.6, 3.0, 1.2);
  const HOME_DIR = new THREE.Vector3(1, 0.98, 1).normalize();
  const VIEW = 7.5;
  let focusLevel = 0;
  const levelY = (lvl: number) => (lvl ? -BASEMENT.pitch * lvl + 2 : HOME_TARGET.y);
  const homeZoom = (lvl: number) => {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    return Math.min((2 * VIEW) / (lvl ? 23 : 29), (2 * VIEW * aspect) / (lvl ? 38 : 35));
  };
  function goHome(lvl: number) {
    controls.target.set(HOME_TARGET.x + (lvl ? 0.8 : 0), levelY(lvl), HOME_TARGET.z + (lvl ? 3 : 0));
    camera.position.copy(controls.target).addScaledVector(HOME_DIR, 60);
    camera.zoom = homeZoom(lvl);
    camera.updateProjectionMatrix();
  }

  const hemi = new THREE.HemisphereLight("#e6eeff", "#8a7a6a", 1.6);
  const sun = new THREE.DirectionalLight("#fff3df", 2.4);
  sun.position.set(9, 22, 10); // entra desde el frente a la derecha: las sombras caen hacia el fondo y se ven
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, far: 80 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  const fill = new THREE.DirectionalLight("#ffffff", 0.55);
  fill.position.set(-10, 8, 12);
  scene.add(hemi, sun, fill);

  let opts: OfficeOptions | null = null;
  let kit: Kit | null = null;
  let world: World | null = null;
  let nightMix = -1;
  let sized = false;

  // Vista pixelada: el pixel acompaña al zoom (mismo tamaño respecto de los objetos). En ASCII no se usa.
  const PIXEL_GRAIN = 1.2;
  const pixelRatio = () => {
    const max = Math.min(window.devicePixelRatio, 2);
    if (!opts?.pixel || opts.ascii.on) return max;
    return Math.min(max, Math.round((PIXEL_GRAIN / camera.zoom) * 40) / 40);
  };
  controls.addEventListener("change", () => {
    if (opts?.pixel && renderer.getPixelRatio() !== pixelRatio()) resize();
  });

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    Object.assign(camera, { left: (-VIEW * w) / h, right: (VIEW * w) / h, top: VIEW, bottom: -VIEW });
    if (!sized) {
      sized = true;
      goHome(focusLevel);
    }
    camera.updateProjectionMatrix();
  }

  function disposeWorld() {
    if (!world) return;
    lit = "";
    shadowAt = -1;
    scene.remove(world.root);
    world.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
      if (o instanceof THREE.Sprite) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    kit?.dispose();
    world = null;
  }

  const speciesOf = (o: OfficeOptions, agentId: string) => (o.species === "gato" ? catSpecies(coatFor(agentId, o.coats[agentId])) : (SPECIES.find((s) => s.id === o.species) ?? SPECIES[0]));
  const castKey = (o: OfficeOptions) => [o.houseTheme, o.species, o.basements.join(","), o.basementNames.join(","), JSON.stringify(o.coats), ...o.agents.map((a) => `${a.id}:${a.desk.id}:${a.skin}`)].join("|");

  function build(o: OfficeOptions) {
    disposeWorld();
    kit = new Kit();
    const k = kit;
    const hullMat = k.track(new THREE.MeshBasicMaterial({ color: "#fff6c8", side: THREE.BackSide }));
    const house = buildHouse(k, {
      occupants: Object.fromEntries(o.agents.map((a) => [a.desk.id, a.skin])),
      basements: o.basements,
      basementNames: o.basementNames,
      theme: houseTheme(o.houseTheme),
      state: { waitingApproval: () => !!opts?.waitingApproval, contactPending: () => !!opts?.contactPending },
    });
    freezeStatic(house.root); // la casa no se mueve: sus posiciones se calculan una sola vez
    const root = group(house.root);
    const actors = group();
    const agents = o.agents.map((view): Agent => {
      const rig = buildAgent(k, speciesOf(o, view.id), SKINS[view.skin] ?? SKINS.disenador);
      rig.root.userData.pick = view.id;
      const fx: Fx = {
        sign: textSprite("!", "#c8423a", "#ffe9a8"),
        zzz: textSprite("z", "#a8b4ff"),
        smoke: [0, 1, 2].map(() => k.sphere(0.12, k.glow("#9a97a3", 0.8), { seg: 5 })),
        sparks: [0, 1, 2, 3].map((i) => k.box(0.05, 0.05, 0.05, k.accent(k.glow(["#f2b43c", "#5fd38a", "#4d8fe0", "#c17ee0"][i])))),
      };
      fx.sign.scale.setScalar(0.42);
      fx.sign.layers.enable(ACCENT_LAYER);
      house.outlines[view.id] = outline(rig.root, hullMat);
      actors.add(rig.root, fx.sign, fx.zzz, ...fx.smoke, ...fx.sparks);
      return { view, rig, desk: house.desks[view.desk.id], fx, tour: null, tourKey: "" };
    });
    const pet = buildBlacky(k);
    pet.root.userData.pick = "pet";
    const petZzz = textSprite("z", "#a8b4ff");
    petZzz.scale.setScalar(0.3);
    // Don Ramón, el librero: atiende la tienda de skills en la biblioteca del entrepiso.
    const npc = buildAgent(k, catSpecies(coatFor("librero")), SKINS.librero);
    npc.root.position.set(1.7, FLOOR_H, -5.75);
    npc.root.userData.pick = "menu:tienda";
    (house.outlines.tienda ??= []).push(...outline(npc.root, hullMat));
    actors.add(pet.root, petZzz, npc.root);
    root.add(actors);
    root.traverse((m) => {
      if (m instanceof THREE.Mesh && !Array.isArray(m.material) && k.accents.has(m.material)) m.layers.enable(ACCENT_LAYER);
    });
    scene.add(root);
    world = { root, house, agents, pet, petZzz, petTour: makeTour(PET_STOPS, 0.9, 0), npc, actors };
    if (onPortraits) onPortraits(makePortraits(o));
  }

  // Retratos para el HUD: la cara y el cuerpo entero de cada agente, dibujados chiquitos (quedan pixelados como la casa).
  function makePortraits(o: OfficeOptions): Portraits {
    const pk = new Kit();
    const ps = new THREE.Scene();
    ps.add(new THREE.HemisphereLight("#ffffff", "#9a8a7a", 2.2));
    const key = new THREE.DirectionalLight("#fff3df", 2.2);
    key.position.set(2, 4, 5);
    ps.add(key);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
    const out: Portraits = {};
    const shot = (w: number, h: number, cy: number, half: number) => {
      const rt = new THREE.WebGLRenderTarget(w, h);
      Object.assign(cam, { left: (-half * w) / h, right: (half * w) / h, top: half, bottom: -half });
      cam.position.set(1.5, cy + 0.9, 5);
      cam.lookAt(0, cy, 0);
      cam.updateProjectionMatrix();
      renderer.setRenderTarget(rt);
      renderer.setClearColor("#000000", 0);
      renderer.clear();
      renderer.render(ps, cam);
      const px = new Uint8Array(w * h * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
      renderer.setRenderTarget(null);
      rt.dispose();
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d")!;
      const img = g.createImageData(w, h);
      const toSRGB = (v: number) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const s = ((h - 1 - y) * w + x) * 4;
          const d = (y * w + x) * 4;
          for (let ch = 0; ch < 3; ch++) img.data[d + ch] = toSRGB(px[s + ch] / 255);
          img.data[d + 3] = px[s + 3] > 100 ? 255 : 0;
        }
      g.putImageData(img, 0, 0);
      return c.toDataURL();
    };
    const shadows = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    for (const id of [...o.agents.map((a) => a.id), "librero"]) {
      const rig = buildAgent(pk, id === "librero" ? catSpecies(coatFor(id)) : speciesOf(o, id), SKINS[o.agents.find((a) => a.id === id)?.skin ?? id] ?? SKINS.disenador);
      rig.root.rotation.y = 0.25;
      if (rig.battery) rig.battery.fill.parent!.visible = false;
      ps.add(rig.root);
      out[id] = { head: shot(56, 56, 1.18, 0.5) };
      ps.remove(rig.root);
      rig.root.traverse((m) => m instanceof THREE.Mesh && m.geometry.dispose());
    }
    renderer.shadowMap.enabled = shadows;
    pk.dispose();
    return out;
  }

  /** Aplica las opciones: rearma la escena solo si cambió la raza, los sótanos o dónde se sienta cada agente. */
  function update(next: OfficeOptions) {
    const rebuild = !opts || castKey(next) !== castKey(opts);
    const resized = !opts || next.pixel !== opts.pixel || next.ascii.on !== opts.ascii.on;
    const levelChanged = !opts || next.level !== focusLevel;
    canvas.style.imageRendering = next.pixel && !next.ascii.on ? "pixelated" : "auto";
    opts = next;
    const wasSized = sized;
    if (levelChanged) focusLevel = Math.min(next.level, next.basements.length);
    if (rebuild) build(next);
    if (resized) resize();
    if (levelChanged) {
      if (wasSized) flyTo(new THREE.Vector3(HOME_TARGET.x + (focusLevel ? 0.8 : 0), levelY(focusLevel), HOME_TARGET.z + (focusLevel ? 3 : 0)), homeZoom(focusLevel));
    }
    for (const a of world!.agents) {
      a.view = next.agents.find((v) => v.id === a.view.id) ?? a.view;
      a.rig.setMood?.(a.view.state);
      setBattery(a.rig, next.energy);
    }
  }

  // Vuelo suave de la cámara (cambio de planta, ir a un agente).
  let fly: { to: THREE.Vector3; zoom: number | null } | null = null;
  const flyTo = (to: THREE.Vector3, zoom: number | null = null) => (fly = { to, zoom });

  // Clic: qué se tocó (mover la cámara no cuenta como clic).
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let down = { x: 0, y: 0 };
  function pickAt(e: PointerEvent): Picked {
    if (!world) return null;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const targets: THREE.Object3D[] = [...world.agents.filter((a) => a.rig.root.visible).map((a) => a.rig.root)];
    if (world.pet.root.visible) targets.push(world.pet.root);
    if (focusLevel === 0) targets.push(world.npc.root, ...world.house.picks);
    let o: THREE.Object3D | null = ray.intersectObjects(targets, true)[0]?.object ?? null;
    while (o && !o.userData.pick) o = o.parent;
    return (o?.userData.pick as string) ?? null;
  }
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
  const onUp = (e: PointerEvent) => {
    if (e.button !== 0 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    onPick(pickAt(e));
  };
  // Hover: el objeto o el agente bajo el mouse se marca con un borde claro (en vez de botones flotantes que tapaban).
  let lastHover = 0;
  let lit = "";
  const highlight = (id: string) => {
    if (id === lit || !world) return;
    for (const h of world.house.outlines[lit] ?? []) h.visible = false;
    for (const h of world.house.outlines[id] ?? []) h.visible = true;
    lit = id;
  };
  const onMove = (e: PointerEvent) => {
    if (e.buttons || performance.now() - lastHover < 60) return;
    lastHover = performance.now();
    const hit = pickAt(e);
    const id = hit?.startsWith("menu:") ? hit.slice(5) : hit && hit !== "pet" ? hit : "";
    highlight(id);
    canvas.style.cursor = hit ? "pointer" : "grab";
    canvas.title = hit?.startsWith("menu:") ? (MENU_SPOTS.find((m) => m.menu === id)?.label ?? "") : "";
  };
  const onLeave = () => highlight("");
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);

  const at3 = new THREE.Vector3();
  function seatAgent(ag: Agent) {
    ag.rig.root.position.copy(ag.desk.seat);
    ag.rig.root.rotation.set(0, ag.desk.rot, 0);
    for (const l of ag.rig.legs) l.rotation.x = -Math.PI / 2;
    ag.rig.carry!.visible = false;
  }
  function walkPose(a: Rig, t: number, carrying: boolean) {
    a.root.position.y += Math.abs(Math.sin(t * 9)) * 0.05;
    a.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 9 + i * Math.PI) * 0.5));
    a.armL!.rotation.x = Math.sin(t * 9) * 0.4;
    a.armR!.rotation.x = carrying ? -1.1 : -Math.sin(t * 9) * 0.4;
    a.carry!.visible = carrying;
  }
  /** Sigue su recorrido (llevar una tarea o hacer la ronda). Devuelve false si en este momento está en su escritorio. */
  function followTour(ag: Agent, t: number, carrying: boolean) {
    const a = ag.rig;
    const at = tourAt(ag.tour!, t, a.root.position);
    if (at.walking) {
      a.root.rotation.set(0, at.heading!, 0);
      walkPose(a, t, carrying);
      return true;
    }
    if (at.stop?.pose !== "talk") return false;
    a.root.rotation.set(0, at.heading ?? 0, 0);
    a.legs.forEach((leg) => (leg.rotation.x = 0));
    a.armR!.rotation.x = -0.9 + Math.sin(t * 5) * 0.25; // gesticula mientras charla
    a.head.rotation.x = Math.sin(t * 3) * 0.08;
    a.carry!.visible = false;
    return true;
  }

  function animateAgent(ag: Agent, t: number, n: number) {
    const { rig: a, desk, fx, view } = ag;
    const state = view.state;
    const phase = desk.seat.x * 1.7 + desk.seat.z; // cada uno a su ritmo
    a.tick?.(t + phase);
    fx.sign.visible = state === "waiting_approval";
    fx.zzz.visible = state === "sleeping";
    fx.smoke.forEach((s) => (s.visible = state === "blocked"));
    fx.sparks.forEach((s) => (s.visible = state === "working"));
    a.head.rotation.set(0, 0, 0);
    a.armL!.rotation.set(0, 0, 0);
    a.armR!.rotation.set(0, 0, 0);
    const blink = (t + phase) % 3.7 < 0.12;
    for (const e of a.eyes) e.scale.y = state === "sleeping" ? 0.12 : blink ? 0.15 : 1;
    const screen = state === "blocked" ? "#e5534b" : state === "sleeping" || state === "idle" ? "#2f3b44" : state === "waiting_approval" ? "#ffd166" : "#86d4c8";
    desk.screen.color.set(screen);
    if (desk.screenLight) {
      desk.screenLight.color.set(screen);
      desk.screenLight.intensity = state === "sleeping" || state === "idle" ? 0.15 : 0.6 + n * 1.6;
    }
    if (desk.lamp) desk.lamp.intensity = n * 2.6; // de noche trabajan con la lámpara prendida

    // Recorridos: llevarle la carpeta a otro agente, o la ronda del Encargado cuando no tiene nada que hacer.
    const wantTour = state === "moving" && view.movingTo ? `to:${view.movingTo.id}` : state === "idle" && view.patrol ? `patrol:${world!.agents.map((o) => o.view.desk.id).join(",")}` : "";
    if (wantTour !== ag.tourKey) {
      ag.tourKey = wantTour;
      const home: Stop = { p: { x: desk.seat.x, y: view.desk.y, z: desk.seat.z }, rest: wantTour.startsWith("to:") ? 0.6 : 12 };
      const visit = (d: DeskSlot, rest: number): Stop => ({ p: besideDesk(d), rest, pose: "talk", look: d });
      const stops = wantTour.startsWith("to:") ? [visit(view.movingTo!, 1.6), home] : wantTour ? [...world!.agents.filter((o) => o !== ag).map((o) => visit(o.view.desk, 3)), home] : [];
      ag.tour = stops.length > 1 ? makeTour(stops, wantTour.startsWith("to:") ? 2.6 : 1.1, opts!.basements.length) : null;
    }
    if (ag.tour && followTour(ag, t, state === "moving")) return;

    seatAgent(ag);
    if (state === "working") {
      a.armL!.rotation.set(-1.2 + Math.sin(t * 16 + phase) * 0.1, 0, -0.15);
      a.armR!.rotation.set(-1.2 + Math.sin(t * 16 + phase + 2) * 0.1, 0, -0.35);
      a.head.rotation.x = 0.08 + Math.sin(t * 2 + phase) * 0.03;
      a.head.rotation.y = Math.sin(t * 0.5 + phase) * 0.08;
      fx.sparks.forEach((s, i) => {
        const k = (t * 0.5 + i / 4) % 1;
        desk.local(-0.22 + Math.sin(i * 2.3) * 0.25, 1.05 + k * 0.7, 0.75 + Math.cos(i * 1.7) * 0.1, s.position);
        s.rotation.set(t * 3, t * 2, 0);
        s.scale.setScalar(1 - k);
      });
    } else if (state === "idle" || state === "moving") {
      a.armL!.rotation.x = a.armR!.rotation.x = -0.5;
      a.head.rotation.y = Math.sin(t * 0.7 + phase) * 0.5;
      a.root.rotation.y = desk.rot + Math.sin(t * 0.35 + phase) * 0.18;
    } else if (state === "waiting_approval") {
      a.armR!.rotation.x = -2.9 + Math.sin(t * 6) * 0.15;
      a.armL!.rotation.x = -0.6;
      a.head.rotation.z = Math.sin(t * 2) * 0.06;
      desk.local(0.45, 2.0 + Math.sin(t * 3) * 0.06, 0, fx.sign.position);
    } else if (state === "sleeping") {
      a.head.rotation.x = 0.55;
      a.armL!.rotation.x = a.armR!.rotation.x = -1.35;
      a.root.position.y = desk.seat.y + Math.sin(t * 1.2 + phase) * 0.008; // respira
      const z = (t * 0.45 + phase) % 1;
      desk.local(0.35 + z * 0.35, 1.6 + z * 0.6, 0, fx.zzz.position);
      fx.zzz.material.opacity = 1 - z;
      fx.zzz.scale.setScalar(0.3 + z * 0.3);
    } else if (state === "blocked") {
      a.armL!.rotation.set(-2.6, 0, -0.5);
      a.armR!.rotation.set(-2.6, 0, 0.5);
      a.head.rotation.z = Math.sin(t * 5) * 0.12;
      fx.smoke.forEach((s, i) => {
        const k = (t * 0.6 + i / 3) % 1;
        desk.local(-0.22 + Math.sin(i * 2 + t) * 0.12, 1.15 + k * 0.9, 0.75, s.position);
        s.scale.setScalar(0.6 + k * 1.4);
        (s.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
      });
    }
  }

  // Blacky pasea por la casa y el jardín: camina, se sienta a mirar y duerme en su cama.
  function animatePet(t: number) {
    const { pet: c, petZzz, petTour } = world!;
    c.body.rotation.set(0, 0, 0);
    c.body.position.y = 0;
    c.head.rotation.set(0, 0, 0);
    c.head.position.y = 0.5;
    c.tail!.rotation.set(0, 0, 0);
    c.legs.forEach((l) => ((l.visible = true), l.rotation.set(0, 0, 0)));
    c.eyes.forEach((e) => (e.scale.y = (t + 0.6) % 4.3 < 0.12 ? 0.15 : 1));
    c.earL.rotation.x = Math.sin(t * 0.9) > 0.97 ? -0.4 : 0;
    c.earR.rotation.x = Math.sin(t * 1.1 + 2) > 0.97 ? -0.4 : 0;
    petZzz.visible = false;
    const at = tourAt(petTour, t, c.root.position);
    if (at.heading != null) c.root.rotation.y = at.heading;
    if (at.walking) {
      c.root.position.y += Math.abs(Math.sin(t * 10)) * 0.02;
      c.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(t * 10 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5));
      c.tail!.rotation.y = Math.sin(t * 4) * 0.35;
    } else if (at.stop?.pose === "sleep") {
      c.root.rotation.y = 0.8;
      c.root.position.y -= 0.14;
      c.legs.forEach((leg) => (leg.visible = false));
      c.head.rotation.x = 0.35;
      c.head.position.y = 0.42;
      c.tail!.rotation.y = 1.4;
      c.eyes.forEach((e) => (e.scale.y = 0.12));
      c.body.position.y = Math.sin(t * 1.5) * 0.01;
      const z = (t * 0.35) % 1;
      petZzz.visible = true;
      petZzz.position.set(c.root.position.x + 0.2 + z * 0.2, 0.7 + z * 0.4, c.root.position.z);
      petZzz.material.opacity = 1 - z;
    } else {
      // Sentado: cuerpo inclinado, patas de atrás dobladas, cola que barre el piso.
      c.body.rotation.x = -0.45;
      c.body.position.y = -0.04;
      c.legs[2].rotation.x = c.legs[3].rotation.x = -1.3;
      c.head.rotation.y = Math.sin(t * 0.6) * 0.35;
      c.tail!.rotation.y = Math.sin(t * 1.4) * 0.5;
    }
  }

  function animateNpc(t: number) {
    const a = world!.npc;
    a.head.rotation.set(Math.sin(t * 0.8) * 0.05, Math.sin(t * 0.4) * 0.45, 0);
    for (const e of a.eyes) e.scale.y = (t + 1.3) % 4.1 < 0.12 ? 0.15 : 1;
    const wave = t % 9 < 1.6;
    a.armR!.rotation.set(wave ? -2.7 : -0.3, 0, wave ? Math.sin(t * 9) * 0.35 : 0);
    a.armL!.rotation.x = -0.9;
  }

  // Día/noche: según la hora real (o fijo, si se elige en Ajustes), con transición suave.
  const tmp = new THREE.Color();
  function applyNight(dt: number) {
    // En ASCII siempre es de día: con poca luz casi todo cae debajo del primer carácter y solo quedan los bordes.
    const target = !opts!.ascii.on && (opts!.light === "night" || (opts!.light === "auto" && isNightHour())) ? 1 : 0;
    if (nightMix < 0) nightMix = target;
    nightMix += Math.sign(target - nightMix) * Math.min(Math.abs(target - nightMix), dt / 1.5);
    const n = nightMix;
    hemi.intensity = THREE.MathUtils.lerp(1.5, 0.38, n);
    hemi.color.set("#e6eeff").lerp(tmp.set("#6f7fd0"), n);
    sun.intensity = THREE.MathUtils.lerp(2.4, 0.25, n);
    sun.color.set("#fff1d6").lerp(tmp.set("#7f8fd6"), n);
    fill.intensity = THREE.MathUtils.lerp(0.55, 0.15, n);
    const th = houseTheme(opts!.houseTheme);
    bg.set(th.bg[0]).lerp(tmp.set(th.bg[1]), n);
    scene.background = opts!.background === "casa" ? bg : backdrop(opts!.background);
    if (opts!.ascii.on) {
      // En letras el volumen se lee por el contraste entre caras: menos luz pareja, más sol.
      hemi.intensity *= 0.5;
      sun.intensity *= 1.3;
      fill.intensity *= 0.4;
    }
    for (const { light, max, always } of world!.house.lights) light.intensity = always + (max - always) * n;
    return n;
  }

  // Carteles y marcas del HUD: cada cuadro se ubican en pantalla sobre su punto de la casa.
  const proj = new THREE.Vector3();
  function place(el: HTMLElement, p: THREE.Vector3, shown: boolean, w: number, h: number) {
    proj.copy(p).project(camera);
    const on = shown && Math.abs(proj.x) < 1.15 && Math.abs(proj.y) < 1.15;
    el.style.visibility = on ? "visible" : "hidden";
    if (on) el.style.transform = `translate(-50%, -100%) translate(${Math.round(((proj.x + 1) / 2) * w)}px, ${Math.round(((1 - proj.y) / 2) * h)}px)`;
  }
  // Se ve solo la planta enfocada: la casa, o un sótano por vez.
  const levelShown = (lvl: number) => lvl === focusLevel;
  function placeLabels() {
    if (!labels) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (const el of labels.children as HTMLCollectionOf<HTMLElement>) {
      const id = el.dataset.label;
      if (id) {
        const a = world!.agents.find((x) => x.view.id === id);
        if (a) place(el, at3.copy(a.rig.root.position).setY(a.rig.root.position.y + 2.15), a.rig.root.visible, w, h);
      } else if (el.dataset.anchor) {
        const [x, y, z] = el.dataset.anchor.split(",").map(Number);
        place(el, at3.set(x, y, z), levelShown(Number(el.dataset.level ?? 0)), w, h);
      }
    }
  }

  const UP = new THREE.Vector3(0, 1, 0);
  const view = new THREE.Vector3();
  let spin = 0;

  const timer = new THREE.Timer();
  timer.connect(document);
  let raf = 0;
  function frame(now?: number) {
    raf = requestAnimationFrame(frame);
    timer.update(now);
    if (!world || !opts || !sized) return;
    const dt = Math.min(timer.getDelta(), 0.1);
    const t = timer.getElapsed();
    if (Math.abs(spin) > 0.001) {
      const step = Math.sign(spin) * Math.min(Math.abs(spin), dt * 4);
      camera.position.sub(controls.target).applyAxisAngle(UP, step).add(controls.target);
      spin -= step;
    }
    if (fly) {
      const k = Math.min(1, dt * 5);
      view.copy(fly.to).sub(controls.target).multiplyScalar(k);
      controls.target.add(view);
      camera.position.add(view);
      if (fly.zoom != null) {
        camera.zoom += (fly.zoom - camera.zoom) * k;
        camera.updateProjectionMatrix();
      }
      if (controls.target.distanceTo(fly.to) < 0.02) fly = null;
    }
    controls.update();
    const ty = levelY(focusLevel);
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -13, 16);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -9, 13);
    if (!fly) {
      // La altura la pone la planta enfocada; al mover la cámara no se va para arriba ni para abajo.
      const dy = ty - controls.target.y;
      controls.target.y += dy;
      camera.position.y += dy;
    }

    // Plantas: enfocando un sótano se oculta todo lo de arriba.
    world.house.levels.forEach((g, lvl) => (g.visible = levelShown(lvl)));
    world.house.caps.forEach((c, i) => (c.visible = focusLevel <= i));
    // Vista de maqueta: la pared que queda entre la cámara y la casa se baja a un zócalo (con lo que tiene colgado).
    view.copy(camera.position).sub(controls.target).setY(0).normalize();
    for (const wall of world.house.walls) {
      const hidden = view.x * wall.nx + view.z * wall.nz > 0.12;
      if (wall.full.visible === hidden) shadowAt = -1; // cambió la pared: la sombra se rehace ya
      wall.full.visible = !hidden;
      wall.stub.visible = hidden;
    }
    const n = applyNight(dt);
    for (const f of world.house.frames) f(t, dt, n);
    for (const a of world.agents) {
      animateAgent(a, t, n);
      const shown = levelShown(levelOfY(a.rig.root.position.y));
      a.rig.root.visible = shown;
      if (!shown) a.fx.sign.visible = a.fx.zzz.visible = false;
      if (!shown) for (const m of [...a.fx.smoke, ...a.fx.sparks]) m.visible = false;
    }
    animatePet(t);
    animateNpc(t);
    world.pet.root.visible = world.npc.root.visible = focusLevel === 0;
    if (focusLevel) world.petZzz.visible = false;
    placeLabels();
    if (shadowAt < 0 || t - shadowAt >= SHADOW_EVERY || t < shadowAt) {
      renderer.shadowMap.needsUpdate = true;
      shadowAt = t;
    }
    if (opts.ascii.on) ascii.render(scene, camera, opts.ascii, renderer.domElement.width, renderer.domElement.height, renderer.getPixelRatio());
    else renderer.render(scene, camera);
  }
  frame();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  return {
    update,
    /** Botones de la vista: girar (en radianes), acercar o alejar, y volver a la vista inicial de la planta enfocada. */
    rotate: (rad: number) => (spin += rad),
    zoom(factor: number) {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom);
      camera.updateProjectionMatrix();
      resize();
    },
    reset() {
      spin = 0;
      fly = null;
      goHome(focusLevel);
      resize();
    },
    /** Lleva la cámara hasta un agente (al tocar su cara en el HUD). */
    focusAgent(id: string) {
      const a = world?.agents.find((x) => x.view.id === id);
      if (!a) return;
      // El punto de mira queda a la altura de la planta: se corre a lo largo de la visual para que el agente quede en el centro.
      const dir = view.copy(camera.position).sub(controls.target).normalize();
      const head = a.rig.root.position.y + 1;
      flyTo(new THREE.Vector3().copy(a.rig.root.position).setY(head).addScaledVector(dir, -(head - levelY(focusLevel)) / dir.y), Math.max(camera.zoom, 1.6));
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      controls.dispose();
      timer.dispose();
      ascii.dispose();
      backdrops.forEach((t) => t.dispose());
      disposeWorld();
      renderer.dispose();
    },
  };
}
