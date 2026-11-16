import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PAGE_NAMES } from "@/demos/gallery";
import { STUDIO_PAGES } from "@/demos/templates/studio";
import { DemoView } from "../demo-view";

export const metadata: Metadata = { title: "Propuesta de sitio web", robots: { index: false, follow: false } };

/** Páginas extra de las demos de varias páginas (Proyectos, Estudio). */
export default function DemoSubPage({ params }: PageProps<"/demo/[slug]/[page]">) {
  return (
    <Suspense>
      <SubPage params={params} />
    </Suspense>
  );
}

async function SubPage({ params }: { params: Promise<{ slug: string; page: string }> }) {
  const p = await params;
  // Páginas de la dirección "studio" o de una plantilla de la galería; DemoView decide si esta demo la tiene.
  if (!([...STUDIO_PAGES, ...PAGE_NAMES] as string[]).includes(p.page)) notFound();
  return <DemoView params={Promise.resolve(p)} />;
}
