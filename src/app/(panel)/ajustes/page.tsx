import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Panel } from "@/components/ui";
import { logout } from "../../login/actions";
import { HouseSettings } from "./house-settings";

// Ajustes en un solo lugar (reforma 2026-11-10): aspecto de la casa, panel claro u oscuro, y los accesos que se usan cada tanto.
export default function AjustesPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Panel title="Aspecto de la casa">
        <HouseSettings />
      </Panel>
      <Panel title="Panel">
        <ul className="divide-y-2 divide-(--av-sunk) text-sm">
          <li className="flex items-center justify-between gap-3 py-2">
            <span>Menús claros u oscuros</span>
            <ThemeToggle />
          </li>
          <li className="flex items-center justify-between gap-3 py-2">
            <span>Límites diarios de cada tarea (Encargado)</span>
            <Link href="/tareas" className="av-btn text-sm">
              Ver y editar
            </Link>
          </li>
          <li className="flex items-center justify-between gap-3 py-2">
            <span>Copia de seguridad para el pendrive</span>
            <Link href="/respaldo" className="av-btn text-sm">
              Abrir
            </Link>
          </li>
          <li className="flex items-center justify-between gap-3 py-2">
            <span>Sótanos de oficina y mudanzas</span>
            <span className="text-(--av-muted)">botón «+» de las plantas (abajo a la izquierda) y la ficha de cada agente</span>
          </li>
          <li className="flex items-center justify-between gap-3 py-2">
            <span>Cerrar la sesión en esta compu</span>
            <form action={logout}>
              <button className="av-btn text-sm">Salir</button>
            </form>
          </li>
        </ul>
      </Panel>
    </main>
  );
}
