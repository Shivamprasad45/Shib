// app/page.tsx or wherever you use MapVideoForm
"use client";

import dynamic from "next/dynamic";

// Dynamically import with SSR disabled
const MapVideoForm = dynamic(() => import("../app/components/Movi"), {
  ssr: false,
});

export default function HomePage() {
  return (
    <main className="p-4">
      <MapVideoForm />
    </main>
  );
}
