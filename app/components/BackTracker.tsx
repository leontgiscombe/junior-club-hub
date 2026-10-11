"use client";

// Notes each move between the hub's pages, so the back buttons know there's
// somewhere to go back to (lib/back.ts). Draws nothing.
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { noteMove } from "@/lib/back";

export default function BackTracker() {
  const path = usePathname();
  const first = useRef(path);
  useEffect(() => {
    if (path !== first.current) noteMove();
  }, [path]);
  return null;
}
