import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DIRECTIONS, type DirectionId } from "@/demos/directions";
import { TEMPLATE_NICHES, type TemplateNiche } from "@/demos/gallery";
import { sampleContent } from "@/demos/gallery-store";
import { EditorialTemplate } from "@/demos/templates/editorial";
import { GroteskTemplate } from "@/demos/templates/grotesk";
import { PhotoTemplate } from "@/demos/templates/photo";
import { StudioTemplate } from "@/demos/templates/studio";

export const metadata: Metadata = { title: "Muestra de diseño", robots: { index: false, follow: false } };
const TEMPLATES = { editorial: EditorialTemplate, grotesk: GroteskTemplate, photo: PhotoTemplate };
const inThreeWeeks = () => new Date(Date.now() + 21 * 86_400_000); // el aviso de vencimiento de la muestra, como en una demo nueva

/** Una dirección de diseño con un negocio de ejemplo del rubro, para recordarla al elegir (solo en el panel: el proxy pide sesión). */
export default function MuestraPage(props: PageProps<"/muestra/[dir]">) {
  return (
    <Suspense>
      <Muestra {...props} />
    </Suspense>
  );
}

async function Muestra({ params, searchParams }: PageProps<"/muestra/[dir]">) {
  await connection();
  const dir = (await params).dir as DirectionId;
  const rubro = String((await searchParams).rubro ?? "dentist") as TemplateNiche;
  if (!(dir in DIRECTIONS) || !(rubro in TEMPLATE_NICHES)) notFound();
  const sample = await sampleContent(rubro);
  const c = rubro === "barber" && dir === "grotesk" ? { ...sample, brand: { photos: [], ...sample.brand, palette: "barber" } } : sample;
  const expiresAt = inThreeWeeks();
  if (dir === "studio") return <StudioTemplate c={c} expiresAt={expiresAt} base={`/muestra/studio`} />;
  const Template = TEMPLATES[dir];
  return <Template c={c} expiresAt={expiresAt} />;
}
