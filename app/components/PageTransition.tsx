"use client";

// Each page slides in like a phone app's (app/template.tsx): keyed by the
// address, so every move between pages is one page leaving and another
// arriving, not only moves between the app's sections.
import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <ViewTransition key={path} enter="page-enter" exit="page-exit" default="none">
      <div className="page-in">{children}</div>
    </ViewTransition>
  );
}
