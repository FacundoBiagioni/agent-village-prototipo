import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoView } from "./demo-view";

// Demos: nunca indexadas por buscadores (PLAN 11).
export const metadata: Metadata = { title: "Propuesta de sitio web", robots: { index: false, follow: false } };

export default function DemoPage({ params }: PageProps<"/demo/[slug]">) {
  return (
    <Suspense>
      <DemoView params={params} />
    </Suspense>
  );
}
