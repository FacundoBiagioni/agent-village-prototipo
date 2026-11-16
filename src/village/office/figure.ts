// Muñeco 3D de la ficha del agente: el mismo modelo de la casa, solo, sobre un pedestal. Se gira arrastrando (o con las flechas).
import * as THREE from "three";
import { buildAgent, catSpecies, coatFor, SKINS, SPECIES } from "./characters";
import { at, Kit } from "./kit";

export function createFigure(canvas: HTMLCanvasElement, o: { agentId: string; skin: string; species: string; coat?: string; pixel: boolean }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !o.pixel, alpha: true });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
  camera.position.set(0, 1.6, 6);
  camera.lookAt(0, 0.95, 0);
  scene.add(new THREE.HemisphereLight("#ffffff", "#9a8a7a", 2.0));
  const key = new THREE.DirectionalLight("#fff3df", 2.4);
  key.position.set(3, 5, 4);
  const rim = new THREE.DirectionalLight("#bcd7ff", 1.2);
  rim.position.set(-4, 3, -3);
  scene.add(key, rim);

  const kit = new Kit();
  const species = o.species === "gato" ? catSpecies(coatFor(o.agentId, o.coat)) : (SPECIES.find((s) => s.id === o.species) ?? SPECIES[0]);
  const rig = buildAgent(kit, species, SKINS[o.skin] ?? SKINS.disenador);
  if (rig.battery) rig.battery.fill.parent!.visible = false;
  const spin = new THREE.Group();
  spin.add(rig.root, at(kit.cyl(0.62, 0.68, 0.12, "#c99f72", { surface: "wood", seg: 16 }), 0, -0.06, 0));
  scene.add(spin);

  let angle = 0.35;
  let target = 0.35;
  let dragX: number | null = null;
  const onDown = (e: PointerEvent) => {
    dragX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (dragX == null) return;
    target += (e.clientX - dragX) * 0.012;
    dragX = e.clientX;
  };
  const onUp = () => (dragX = null);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") target -= Math.PI / 8;
    if (e.key === "ArrowRight") target += Math.PI / 8;
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("keydown", onKey);

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    // Pixelado como la casa: se dibuja a menos resolución y el navegador lo agranda sin suavizar.
    renderer.setPixelRatio(o.pixel ? 0.5 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    const half = 1.0;
    Object.assign(camera, { left: (-half * w) / h, right: (half * w) / h, top: half, bottom: -half });
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const clock = new THREE.Timer();
  let raf = 0;
  function frame(now?: number) {
    raf = requestAnimationFrame(frame);
    clock.update(now);
    const t = clock.getElapsed();
    angle += (target - angle) * 0.18;
    spin.rotation.y = angle;
    rig.tick?.(t);
    rig.head.rotation.y = Math.sin(t * 0.7) * 0.25;
    rig.armR!.rotation.x = -0.25 + Math.sin(t * 1.3) * 0.08;
    rig.root.position.y = Math.sin(t * 1.6) * 0.012; // respira
    for (const e of rig.eyes) e.scale.y = t % 3.6 < 0.12 ? 0.15 : 1;
    renderer.render(scene, camera);
  }
  frame();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("keydown", onKey);
    clock.dispose();
    scene.traverse((m) => m instanceof THREE.Mesh && m.geometry.dispose());
    kit.dispose();
    renderer.dispose();
  };
}
