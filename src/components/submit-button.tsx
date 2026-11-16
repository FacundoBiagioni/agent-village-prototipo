"use client";

import { useFormStatus } from "react-dom";

/** Botón de formulario que avisa mientras se guarda. Con varios botones en el mismo formulario (mismo name, distinto value), solo cambia el que se tocó. */
export function SubmitButton({ children, pendingText, name, value, className, title }: { children: React.ReactNode; pendingText: string; name?: string; value?: string; className?: string; title?: string }) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button name={name} value={value} disabled={pending} aria-busy={mine} title={title} className={`${className ?? ""} disabled:cursor-wait disabled:opacity-60`}>
      {mine ? pendingText : children}
    </button>
  );
}
