// Primer mensaje de WhatsApp armado con plantillas (código común, sin IA): decisión del 2026-11-05.
// Sigue la estructura de la skill tono-mensajes-venta: saludo, por qué les escribo (detalle real), la demo y un cierre sin presión.
// Cada parte tiene varias versiones y cada negocio recibe una combinación propia: así no salen mensajes idénticos.
import { LINK_MARK } from "./content";

export type MessageFacts = { id: string; name: string; niche: string | null; webStatus: string; seller: string };

/** "CONSULTORIO ODONTOLOGICO PEREZ" → "Consultorio Odontologico Perez" (los nombres en mayúsculas parecen gritos). */
export function tidyName(name: string) {
  const n = name.trim().replace(/\s+/g, " ");
  if (n !== n.toUpperCase() || !/[A-ZÁÉÍÓÚÑ]{3}/.test(n)) return n;
  const small = new Set(["de", "del", "la", "las", "los", "y", "e", "en"]);
  return n
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Para qué les sirve la página, según el rubro (va en la frase de la demo). */
const BENEFIT: Record<string, string> = {
  dentist: "sus pacientes los encuentren y pidan turno más fácil",
  beauty: "sus clientes vean sus trabajos y reserven turno más fácil",
  architecture: "los clientes conozcan sus proyectos y les escriban",
};
const DEFAULT_BENEFIT = "los encuentren y les escriban más fácil";

const GREETING = (s: string) => [
  `Hola, ¿cómo están? Soy ${s}, hago páginas web acá en La Plata.`,
  `Hola, buen día. Mi nombre es ${s} y armo páginas web en La Plata.`,
  `¡Hola! Les escribe ${s}, desarrollo páginas web en La Plata.`,
  `Hola, ¿qué tal? Soy ${s}, diseño páginas web para negocios de La Plata.`,
];

/** Por qué les escribo: el detalle real de su web, dicho con tacto. */
const REASON: Record<string, (n: string) => string[]> = {
  none: (n) => [`Vi ${n} en Google Maps y noté que todavía no tienen página web.`, `Buscando negocios de la zona encontré ${n} y vi que no tienen una página propia.`, `Me crucé con ${n} en Google y me llamó la atención que no tengan página web.`],
  social_only: (n) => [`Vi que ${n} se mueve por redes, pero no tiene una página propia.`, `Encontré a ${n} por sus redes y vi que no tienen una página web propia.`, `Vi el perfil de ${n} y noté que no tienen página web propia, solo redes.`],
  down: (n) => [`Quise entrar a la página de ${n} y no está funcionando.`, `Intenté abrir la página web de ${n} y no carga.`, `Vi que la página de ${n} no está andando: quise entrar y no abre.`],
  outdated: (n) => [`Entré a la página de ${n} y vi que no se adapta bien al celular.`, `Vi la página de ${n} y noté que ya tiene sus años y se puede renovar.`, `Estuve mirando la web de ${n} y vi que en el celular no se ve del todo bien.`],
  ok: (n) => [`Vi la página de ${n} y se me ocurrieron algunas ideas para darle una vuelta.`, `Estuve mirando la web de ${n} y armé una idea para renovarla.`],
  unchecked: (n) => [`Vi la página de ${n} y se me ocurrieron algunas ideas para darle una vuelta.`, `Estuve mirando a ${n} y armé una idea para su página.`],
};

// El nombre del negocio ya va en el motivo: acá no se repite.
const OFFER = (benefit: string) => [
  `Les armé una muestra de cómo podría verse su página, pensada para que ${benefit}: ${LINK_MARK}`,
  `Me tomé el atrevimiento de prepararles una propuesta, para que ${benefit}. La pueden ver acá: ${LINK_MARK}`,
  `Les preparé una muestra de página a medida, para que ${benefit}: ${LINK_MARK}`,
];

const CLOSING = [
  "Mírenla cuando tengan un rato y, si les interesa, lo charlamos. ¡Saludos!",
  "Sin compromiso: si les gusta, me avisan y vemos. ¡Gracias por su tiempo!",
  "Cualquier cosa me escriben por acá. ¡Que tengan un buen día!",
  "Fíjense cuando puedan y, si les sirve, lo vemos juntos. ¡Saludos!",
];

/** Número estable a partir de un texto (el id del negocio): siempre la misma combinación para el mismo negocio. */
function seed(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Todas las combinaciones posibles para un negocio (las usa el test para revisarlas una por una). */
export function messageParts(f: MessageFacts) {
  const name = tidyName(f.name);
  return {
    greeting: GREETING(f.seller),
    reason: (REASON[f.webStatus] ?? REASON.none)(name),
    offer: OFFER(BENEFIT[f.niche ?? ""] ?? DEFAULT_BENEFIT),
    closing: CLOSING,
  };
}

/** Arma el mensaje: una versión de cada parte elegida por el id del negocio. */
export function draftMessage(f: MessageFacts) {
  const p = messageParts(f);
  const s = seed(f.id);
  const pick = <T>(list: T[], shift: number) => list[Math.floor(s / shift) % list.length];
  // En párrafos cortos, como se escribe por WhatsApp.
  return [`${pick(p.greeting, 1)} ${pick(p.reason, 7)}`, pick(p.offer, 53), pick(p.closing, 389)].join("\n\n");
}
