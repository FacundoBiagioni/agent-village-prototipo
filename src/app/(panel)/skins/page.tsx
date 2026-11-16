import { agents } from "@/agents";
import { SkinsPanel } from "./skins-panel";

// Skins (botón abajo a la izquierda): cómo se ve todo y cómo se llaman las plantas.
export default function SkinsPage() {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <SkinsPanel agents={agents.map((a) => ({ id: a.id, name: a.name }))} />
    </main>
  );
}

// Usa la casa del layout (useGame): la validación aislada de Next no la tiene.
export const instant = false;
