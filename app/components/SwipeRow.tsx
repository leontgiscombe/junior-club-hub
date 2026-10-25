"use client";

// A list row that slides left under a finger to show its actions (Done,
// Remove…), as in an iPhone's Mail. Its own buttons stay, for a mouse; this is
// the quick way on a phone.
import { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";

export type SwipeAction = { label: string; tone: "green" | "red" | "gray"; onAction: () => void };

const TONE = { green: "bg-green-600", red: "bg-red-600", gray: "bg-gray-500" } as const;
const WIDTH = 84; // each action's width

export default function SwipeRow({ actions, className = "", children }: { actions: SwipeAction[]; className?: string; children: React.ReactNode }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; from: number; decided: boolean; sideways: boolean } | null>(null);
  const row = useRef<HTMLLIElement>(null);
  const full = actions.length * WIDTH;

  // a tap anywhere else closes it
  useEffect(() => {
    if (offset === 0) return;
    const away = (e: PointerEvent) => {
      if (!row.current?.contains(e.target as Node)) setOffset(0);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [offset]);

  return (
    <li ref={row} className={`relative overflow-hidden ${className}`}>
      {/* the actions, waiting behind the row */}
      <div className="absolute inset-y-0 right-0 flex" aria-hidden={offset === 0}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            tabIndex={offset === 0 ? -1 : 0}
            onClick={() => {
              setOffset(0);
              a.onAction();
            }}
            className={`${TONE[a.tone]} flex items-center justify-center text-sm font-bold text-white`}
            style={{ width: WIDTH }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div
        className="relative bg-white dark:bg-[#1c1c1e]"
        style={{ transform: `translateX(${-offset}px)`, transition: dragging ? "none" : "transform 200ms ease-out", touchAction: "pan-y" }}
        onPointerDown={(e) => {
          if (e.pointerType !== "touch") return;
          start.current = { x: e.clientX, y: e.clientY, from: offset, decided: false, sideways: false };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (!s.decided) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            s.decided = true;
            s.sideways = Math.abs(dx) > Math.abs(dy);
            if (s.sideways) {
              setDragging(true);
              e.currentTarget.setPointerCapture(e.pointerId);
            }
          }
          if (!s.sideways) return;
          setOffset(Math.min(Math.max(s.from - dx, 0), full + 24));
        }}
        onPointerUp={() => {
          const s = start.current;
          start.current = null;
          if (!s?.sideways) return;
          setDragging(false);
          const open = offset > full / 2;
          if (open && s.from === 0) haptic();
          setOffset(open ? full : 0);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setOffset(0);
        }}
        onClickCapture={(e) => {
          // a row slid open: a tap on it closes it, rather than pressing what's under the finger
          if (offset > 0) {
            e.preventDefault();
            e.stopPropagation();
            setOffset(0);
          }
        }}
      >
        {children}
      </div>
    </li>
  );
}
