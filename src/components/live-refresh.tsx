"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Escucha los eventos de los agentes y vuelve a pedir la página (agrupando ráfagas). */
export function LiveRefresh() {
  const router = useRouter();
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/events");
    let t: ReturnType<typeof setTimeout> | undefined;
    es.onopen = () => setOnline(true);
    es.onerror = () => setOnline(false);
    es.onmessage = () => {
      clearTimeout(t);
      t = setTimeout(() => router.refresh(), 150);
    };
    // PROTOTIPO: el original recalcula cada 5 s mientras algo trabaja; acá los datos son fijos, así que no hace falta.
    const tick = undefined;
    return () => {
      es.close();
      clearTimeout(t);
      clearInterval(tick);
    };
  }, [router]);

  return (
    <span className="flex items-center gap-2 text-sm text-stone-500" role="status">
      <span className={`size-2 rounded-full ${online ? "bg-emerald-500" : "bg-stone-300"}`} aria-hidden />
      {online ? "En vivo" : "Sin conexión en vivo"}
    </span>
  );
}
