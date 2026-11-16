import { reviewSkill } from "@/runtime/skill-review";
import { downloadSkill, installedFrom, installSkill, OFFICIAL } from "@/runtime/skill-store";
import { supervise } from "@/runtime/supervisor";
import type { AgentConfig } from "./types";

// Encargado / Supervisor (PLAN 6.6), versión inicial: todo con código común, sin IA.
// El freno a duplicadas y límites diarios corre antes de cada tarea (runtime/supervisor.ts → guardRun).
export const encargado: AgentConfig = {
  id: "encargado",
  name: "Encargado",
  role: "Vigila a los demás: avisa si alguno se traba, reintenta una vez lo que falló por algo pasajero, frena tareas duplicadas y aplica los límites diarios de cuota. No sale hacia afuera ni hace el trabajo de otro.",
  tools: [], // sin herramientas: lee y escribe la base desde el código
  world: { desk: 3, skin: "encargado", patrol: true },
  tasks: {
    supervisar: {
      label: "Revisar el equipo",
      brain: "code",
      steps: ["Revisar trabados y fallas"],
      async run(ctx) {
        await ctx.step("Revisar trabados y fallas");
        return supervise();
      },
    },
    // Tienda de skills (PLAN 8): revisa una skill del catálogo y pide aprobación para instalarla. Nunca instala sola.
    revisar_skill: {
      label: "Revisar una skill de la tienda (requiere aprobación)",
      startsFrom: "Tienda",
      brain: "code",
      steps: ["Bajar la skill", "Revisarla", "Esperar aprobación"],
      async run(ctx) {
        await ctx.step("Bajar la skill");
        const name = String(ctx.input.name ?? "");
        if ((await installedFrom(name)) === "own") throw new Error("Ya hay una skill propia con ese nombre");
        const repo = String(ctx.input.repo ?? OFFICIAL); // pedidos viejos no traen fuente: eran del oficial
        const s = await downloadSkill(name, repo);
        await ctx.step("Revisarla");
        const r = reviewSkill({ md: s.md, files: s.item.files, licenseFile: s.licenseFile });
        if (repo !== OFFICIAL) r.warnings.unshift(`viene de ${repo}, una fuente que agregaste vos (no es la oficial de Anthropic): leé el texto antes de aprobar`);
        if (!r.allowed) throw new Error(`No se puede instalar: licencia ${r.license} (solo se aceptan licencias abiertas, como Apache 2.0 o MIT)`);
        await ctx.step("Esperar aprobación");
        // Lo que se aprueba es exactamente este texto (fijado al commit): eso es lo que se instala.
        return { name, fuente: repo, descripcion: s.item.description, licencia: r.license, origen: s.url, commit: s.commit, tokens: r.tokens, archivos: r.files, programas: r.scripts, avisos: r.warnings, md: s.md };
      },
      external: {
        actionType: "install_skill",
        async execute(payload) {
          const p = payload as { name: string; md: string; origen: string; commit: string; licencia: string };
          return installSkill({ name: p.name, md: p.md, url: p.origen, commit: p.commit, license: p.licencia });
        },
      },
    },
  },
};
