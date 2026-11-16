import type { Metadata } from "next";
import { THEME_SCRIPT } from "@/components/theme";
import { PrototypeNotice } from "@/components/prototype-notice";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Village · Prototipo",
  description: "Prototipo de muestra de Agent Village: la misma interfaz con datos inventados. No funciona a propósito.",
  // Los negocios son inventados: que no aparezcan en buscadores.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: el script del <head> puede marcar el modo oscuro antes de que cargue React.
    <html lang="es-AR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        {children}
        <PrototypeNotice />
      </body>
    </html>
  );
}
