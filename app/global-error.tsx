"use client";

// When a page crashes outright: report it to Sentry (if it's set up) and offer
// to try again, instead of a blank screen.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full items-center justify-center bg-gray-50 p-6 text-center font-sans antialiased">
        <title>Something went wrong</title>
        <div className="max-w-sm">
          <div className="text-5xl">⚽</div>
          <h1 className="mt-3 text-2xl font-extrabold text-gray-900">Something went wrong</h1>
          <p className="mt-2 text-gray-500">Sorry — that page hit a problem. We&apos;ve been told about it.</p>
          <div className="mt-5 flex justify-center gap-3">
            <button onClick={() => unstable_retry()} className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-700">
              Try Again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="rounded-xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 hover:bg-gray-100">
              Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
