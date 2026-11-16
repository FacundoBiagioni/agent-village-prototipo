// Skills equipables (PLAN 8): reglas puras de slots y equipamiento.

/** Slots de un agente: 3 de base y uno más cada 3 niveles (1-3: 3, 4-6: 4, ...). */
export const slotsFor = (level: number) => 3 + Math.floor((Math.max(1, level) - 1) / 3);
/** Slots del aura del Encargado (se aplica a todos): 2 de base y uno más cada 5 niveles. */
export const auraSlotsFor = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 5);

/** ¿Se puede equipar? Devuelve el motivo si no, o null si sí. */
export function canEquip(o: { skill: string; inventory: string[]; equipped: string[]; fixed: string[]; slots: number }) {
  if (!o.inventory.includes(o.skill)) return "Esa skill no está en el inventario revisado";
  if (o.fixed.includes(o.skill)) return "Ya la usa en sus tareas: no hace falta equiparla";
  if (o.equipped.includes(o.skill)) return "Ya está equipada";
  if (o.equipped.length >= o.slots) return `No le quedan lugares (${o.slots}): sacá una o subí de nivel`;
  return null;
}

/** Skills extra que recibe un agente en cada pedido a la IA: las suyas y el aura, sin repetir las fijas de la tarea. */
export function extraSkills(o: { own: string[]; aura: string[]; fixed: string[] }) {
  return [...new Set([...o.own, ...o.aura])].filter((s) => !o.fixed.includes(s));
}

/** Tokens aproximados de un texto (~4 caracteres por token): para mostrar cuánto "pesa" una skill. */
export const approxTokens = (text: string) => Math.ceil(text.length / 4);
