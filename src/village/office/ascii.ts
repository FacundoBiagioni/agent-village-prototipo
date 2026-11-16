// Modo ASCII (botón especial de Ajustes): la misma casa 3D convertida en letras, en la placa de video.
// La escena se dibuja chiquita (2x2 pixeles por letra) y un sombreador elige cada carácter:
//  - por brillo, de una rampa de caracteres que el usuario elige;
//  - en los bordes (donde la profundidad pega un salto o se quiebra), una raya | / - \ según hacia dónde va el borde.
// Eso es lo que hace que se lea el volumen aunque sean letras. Blanco, gris y negro; un color para los avisos.
import * as THREE from "three";
import { ASCII_CHARSETS, ASCII_TINTS, type AsciiConfig } from "./ascii-config";

export * from "./ascii-config";
const EDGE_GLYPHS = "|/-\\";
/** Capa de los objetos que avisan algo (buzón, fuego, pantallas, carteles): en ASCII van con el color de aviso. */
export const ACCENT_LAYER = 1;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene, tDepth, tMask, tGlyphs;
uniform vec2 uCells;
uniform float uRamp, uTotal, uEdges, uInvert, uColor, uDepthRange;
uniform vec3 uFg, uBg, uAccent, uAlert;

float lumOf(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float depthAt(vec2 cuv, vec2 o) { return texture2D(tDepth, cuv + (o + 0.25) / uCells).r * uDepthRange; }

void main() {
  vec2 pos = vUv * uCells;
  vec2 cell = floor(pos);
  vec2 inCell = fract(pos);
  vec2 cuv = (cell + 0.5) / uCells;
  vec3 scene = texture2D(tScene, cuv).rgb;
  float lum = pow(clamp(lumOf(scene), 0.0, 1.0), 0.5);       // de lineal a "como se ve"
  lum = smoothstep(0.05, 1.3, lum);                          // deja las letras más densas para lo que brilla de verdad
  float d0 = depthAt(cuv, vec2(0.0));
  bool empty = d0 > uDepthRange * 0.999;                     // fondo: sin casa

  // Bordes: segunda derivada de la profundidad (vale 0 en una cara plana, salta en aristas y siluetas).
  float ex = abs(depthAt(cuv, vec2(-1.0, 0.0)) + depthAt(cuv, vec2(1.0, 0.0)) - 2.0 * d0);
  float ey = abs(depthAt(cuv, vec2(0.0, -1.0)) + depthAt(cuv, vec2(0.0, 1.0)) - 2.0 * d0);
  float e1 = abs(depthAt(cuv, vec2(-1.0, 1.0)) + depthAt(cuv, vec2(1.0, -1.0)) - 2.0 * d0);
  float e2 = abs(depthAt(cuv, vec2(1.0, 1.0)) + depthAt(cuv, vec2(-1.0, -1.0)) - 2.0 * d0);
  float e = max(max(ex, ey), max(e1, e2));
  bool edge = uEdges > 0.5 && e > 1.9;   // saltos de más de un metro: siluetas y aristas grandes

  float idx;
  if (edge) {
    // la raya va perpendicular a la dirección en la que más cambia: 0 vertical, 1 barra, 2 horizontal, 3 barra invertida
    // (ojo: sin barras invertidas en estos comentarios; al final de una línea GLSL las toma como "sigue abajo")
    float g = 0.0;
    if (ey >= ex && ey >= e1 && ey >= e2) g = 2.0;
    else if (e1 > ex && e1 >= e2) g = 1.0;
    else if (e2 > ex) g = 3.0;
    idx = uRamp + g;
  } else {
    idx = empty ? 0.0 : min(uRamp - 1.0, floor(lum * uRamp));
  }
  float a = texture2D(tGlyphs, vec2((idx + inCell.x) / uTotal, inCell.y)).r;

  vec3 mask = texture2D(tMask, cuv).rgb;
  float m = max(mask.r, max(mask.g, mask.b));
  vec3 fg = uFg * (edge ? 1.0 : 0.3 + 0.75 * lum);
  if (uColor > 0.5) fg = mix(fg, pow(scene, vec3(0.45)) * 1.25 + 0.08, 0.85);
  if (m > 0.3) fg = (mask.r > mask.g * 1.7 && mask.r > mask.b * 1.7) ? uAlert : uAccent;
  vec3 col = mix(uBg, fg, a);
  if (uInvert > 0.5) col = vec3(1.0) - col;
  gl_FragColor = vec4(col, 1.0);
}`;

function glyphAtlas(chars: string, cw: number, ch: number) {
  const all = [...chars, ...EDGE_GLYPHS];
  const c = document.createElement("canvas");
  c.width = all.length * cw;
  c.height = ch;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#fff";
  g.font = `${Math.round(ch * 0.92)}px "Cascadia Mono", Consolas, "DejaVu Sans Mono", "Courier New", monospace`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  all.forEach((s, i) => g.fillText(s, i * cw + cw / 2, ch / 2 + ch * 0.04, cw * 1.15));
  const t = new THREE.CanvasTexture(c);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return { tex: t, ramp: [...chars].length, total: all.length };
}

export class AsciiPass {
  private rt: THREE.WebGLRenderTarget | null = null;
  private mask: THREE.WebGLRenderTarget | null = null;
  private quad: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private black = new THREE.MeshBasicMaterial({ color: "#000000" });
  private key = "";
  private glyphs: THREE.Texture | null = null;

  constructor(private renderer: THREE.WebGLRenderer) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: null }, tDepth: { value: null }, tMask: { value: null }, tGlyphs: { value: null },
        uCells: { value: new THREE.Vector2(1, 1) }, uRamp: { value: 1 }, uTotal: { value: 5 }, uEdges: { value: 1 }, uInvert: { value: 0 }, uColor: { value: 0 }, uDepthRange: { value: 200 },
        uFg: { value: new THREE.Color() }, uBg: { value: new THREE.Color() }, uAccent: { value: new THREE.Color("#ffb000") }, uAlert: { value: new THREE.Color("#ff5a47") },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  /** w, h: tamaño del lienzo en pixeles reales. */
  private setup(cfg: AsciiConfig, w: number, h: number, dpr: number) {
    const chPx = Math.max(6, Math.round(cfg.cell * dpr * 1.7));
    const cwPx = Math.max(4, Math.round(cfg.cell * dpr));
    const cols = Math.max(8, Math.floor(w / cwPx));
    const rows = Math.max(4, Math.floor(h / chPx));
    const key = `${cfg.charset}|${cwPx}|${chPx}|${cols}|${rows}`;
    if (key === this.key) return;
    this.key = key;
    this.rt?.dispose();
    this.mask?.dispose();
    this.glyphs?.dispose();
    this.rt = new THREE.WebGLRenderTarget(cols * 2, rows * 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthTexture: new THREE.DepthTexture(cols * 2, rows * 2, THREE.FloatType) });
    this.mask = new THREE.WebGLRenderTarget(cols * 2, rows * 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const chars = ASCII_CHARSETS.find((s) => s.id === cfg.charset)?.chars ?? ASCII_CHARSETS[0].chars;
    const atlas = glyphAtlas(chars, cwPx, chPx);
    this.glyphs = atlas.tex;
    const u = this.quad.material.uniforms;
    u.tScene.value = this.rt.texture;
    u.tDepth.value = this.rt.depthTexture;
    u.tMask.value = this.mask.texture;
    u.tGlyphs.value = atlas.tex;
    u.uCells.value.set(cols, rows);
    u.uRamp.value = atlas.ramp;
    u.uTotal.value = atlas.total;
  }

  render(scene: THREE.Scene, camera: THREE.OrthographicCamera, cfg: AsciiConfig, w: number, h: number, dpr: number) {
    this.setup(cfg, w, h, dpr);
    const r = this.renderer;
    const u = this.quad.material.uniforms;
    const tint = ASCII_TINTS.find((t) => t.id === cfg.tint) ?? ASCII_TINTS[0];
    u.uFg.value.set(tint.fg);
    u.uBg.value.set(tint.bg);
    u.uAccent.value.set(tint.id === "ambar" ? "#ffffff" : "#ffb000");
    u.uEdges.value = cfg.edges ? 1 : 0;
    u.uInvert.value = cfg.invert ? 1 : 0;
    u.uColor.value = tint.id === "color" ? 1 : 0;
    u.uDepthRange.value = camera.far - camera.near;
    const bg = scene.background;
    scene.background = null;
    r.setClearColor("#000000", 1);
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, camera);
    // Máscara de avisos: toda la casa en negro (para que tape) y encima, con su color, lo que avisa.
    r.shadowMap.autoUpdate = false;
    r.setRenderTarget(this.mask);
    r.clear();
    scene.overrideMaterial = this.black;
    r.render(scene, camera);
    scene.overrideMaterial = null;
    const auto = r.autoClear;
    r.autoClear = false;
    camera.layers.set(ACCENT_LAYER);
    r.render(scene, camera);
    camera.layers.enableAll();
    r.autoClear = auto;
    r.shadowMap.autoUpdate = true;
    scene.background = bg;
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);
  }

  dispose() {
    this.rt?.dispose();
    this.mask?.dispose();
    this.glyphs?.dispose();
    this.black.dispose();
    this.quad.geometry.dispose();
    this.quad.material.dispose();
  }
}
