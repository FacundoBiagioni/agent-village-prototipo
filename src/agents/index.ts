import { analista } from "./analista";
import { cobrador } from "./cobrador";
import { comunicador } from "./comunicador";
import { disenador } from "./disenador";
import { encargado } from "./encargado";
import { hosting } from "./hosting";
import type { AgentConfig } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Agente de prueba de la Fase 1: una tarea por cerebro y una con aprobación.
// Los agentes reales (Buscador, Analista, Comunicador...) llegan en la Fase 2.
const probador: AgentConfig = {
  id: "probador",
  name: "Probador",
  role: "Verifica que el bucle, los tres cerebros y la bandeja funcionen",
  tools: [],
  world: { desk: 5, skin: "probador" },
  tasks: {
    contar: {
      label: "Contar (código común)",
      brain: "code",
      steps: ["Preparar", "Calcular", "Guardar"],
      async run(ctx) {
        await ctx.step("Preparar");
        await sleep(800); // shortcut: espera artificial para ver la barra en la demo; se va con las tareas reales
        await ctx.step("Calcular");
        const total = Array.from({ length: 1000 }, (_, i) => i).reduce((a, b) => a + b, 0);
        await sleep(800);
        await ctx.step("Guardar");
        return { total };
      },
    },
    clasificar: {
      label: "Clasificar un lead (modelo local)",
      brain: "local",
      model: "gemma4:12b",
      think: false,
      fallback: "claude",
      fallbackModel: "claude-haiku-5-5",
      steps: ["Leer lead", "Clasificar"],
      async run(ctx) {
        await ctx.step("Leer lead");
        const lead = { name: "Odontología Sonrisas", rating: 4.8, reviews: 212, hasWebsite: false };
        await ctx.step("Clasificar");
        const r = await ctx.ask(
          `Clasificá la oportunidad de venderle un sitio web a este negocio: "alta", "media" o "baja". Negocio: ${JSON.stringify(lead)}`,
          { schema: { type: "object", properties: { opportunity: { type: "string", enum: ["alta", "media", "baja"] } }, required: ["opportunity"] } },
        );
        return r.json ?? r.text;
      },
    },
    saludar: {
      label: "Saludar (Claude)",
      brain: "claude",
      model: "claude-haiku-5-5",
      steps: ["Redactar"],
      async run(ctx) {
        await ctx.step("Redactar");
        const r = await ctx.ask("Escribí un saludo de una sola frase, en español rioplatense, para el dueño de una peluquería. Solo la frase.");
        return { text: r.text };
      },
    },
    enviar_prueba: {
      label: "Mensaje de prueba (requiere aprobación)",
      brain: "code",
      steps: ["Preparar mensaje", "Esperar aprobación", "Ejecutar"],
      async run(ctx) {
        await ctx.step("Preparar mensaje");
        return { to: "Negocio de prueba", text: "Hola, te preparé una demo de tu sitio. ¿Querés verla?" };
      },
      external: {
        actionType: "send_message",
        // shortcut: no envía nada real; registra la ejecución. El envío real (wa.me) llega con el Comunicador en la Fase 2
        async execute(payload) {
          return { delivered: false, simulated: true, payload };
        },
      },
    },
  },
};

/** Los agentes del equipo: los que se ven en la oficina, en la cuota y en el selector de tareas. */
export const agents: AgentConfig[] = [analista, comunicador, disenador, encargado, cobrador, hosting];
// El Probador (Fase 1) ya no se muestra (2026-11-07), pero sigue registrado: el test de aprobaciones lo usa y sus ejecuciones viejas se pueden leer.
const allAgents: AgentConfig[] = [probador, ...agents];

export function getAgent(id: string) {
  const agent = allAgents.find((a) => a.id === id);
  if (!agent) throw new Error(`Agente desconocido: ${id}`);
  return agent;
}

export function getTask(agentId: string, taskType: string) {
  const task = getAgent(agentId).tasks[taskType];
  if (!task) throw new Error(`Tarea desconocida: ${agentId}/${taskType}`);
  return task;
}
