"use client";

// Reads a QR code with the device's back camera (jsQR, which works in every
// browser, iPhones included). If there's no camera, or it's blocked or broken,
// it says so — the screens that use it always offer typing the code instead.
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { useScrollLock } from "./useScrollLock";

export default function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  useScrollLock();
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let done = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function scan() {
      const v = video.current;
      if (done || !v || !ctx) return;
      if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth) {
        // a smaller copy is plenty to read a QR code, and quicker
        const scale = Math.min(1, 640 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (found?.data) {
          done = true;
          onResult(found.data);
          return;
        }
      }
      frame = requestAnimationFrame(scan);
    }

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem("This device can't use its camera here.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (done) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        frame = requestAnimationFrame(scan);
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setProblem(
          name === "NotAllowedError"
            ? "The camera isn't allowed. You can turn it on in your device's settings."
            : name === "NotFoundError"
              ? "This device doesn't have a camera."
              : "The camera isn't working.",
        );
      }
    })();

    return () => {
      done = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div data-dark-top className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="w-16" />
        <h2 className="text-[17px] font-semibold">Scan the QR Code</h2>
        <button onClick={onClose} className="w-16 text-right text-[15px] font-bold text-green-400">
          Cancel
        </button>
      </div>
      {problem ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-lg font-semibold">{problem}</p>
          <p className="text-sm text-white/70">No problem — type the six-digit code instead.</p>
          <button onClick={onClose} className="rounded-2xl bg-green-600 px-6 py-3 font-bold">
            Type the Code
          </button>
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
          {/* where to hold the code */}
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          <p className="absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] px-8 text-center text-sm text-white/85">
            Point the camera at the QR code on the grown-up&apos;s phone.
          </p>
        </div>
      )}
    </div>
  );
}
