"use client";

// A one-off check of what an FA Full-Time code snippet returns. Full-Time blocks
// requests from servers, so the hub can't fetch fixtures itself — but its
// official snippets run in a visitor's own browser. This page loads one (in an
// iframe, so the snippet's script can write its markup however it likes) and
// shows the result, so it can be copied back and an import built around it.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function snippetPage(code: string) {
  // The snippet as Full-Time hands it out, with the code dropped in.
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="lrep${code}">Data loading....</div>
<script>var lrcode = '${code}';</script>
<script src="https://fulltime.thefa.com/client/api/cs1.js"></script>
</body></html>`;
}

export default function FaSnippetTest() {
  const [code, setCode] = useState("93109564");
  const [loaded, setLoaded] = useState("93109564");
  const [html, setHtml] = useState("");
  const [status, setStatus] = useState("Loading…");
  const [copied, setCopied] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  // Watch the iframe until the snippet has replaced "Data loading....".
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHtml("");
    setStatus("Loading…");
    const started = Date.now();
    const timer = window.setInterval(() => {
      const doc = frame.current?.contentDocument;
      const box = doc?.getElementById(`lrep${loaded}`);
      const body = doc?.body?.innerHTML ?? "";
      if (box && !box.innerHTML.includes("Data loading")) {
        setHtml(body);
        setStatus("Loaded — copy the text below and send it back.");
        window.clearInterval(timer);
      } else if (Date.now() - started > 20000) {
        setHtml(body);
        setStatus("Nothing came back after 20 seconds — Full-Time may have blocked it.");
        window.clearInterval(timer);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [loaded]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function copy() {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-green-700 px-4 py-6 text-white">
        <Link href="/admin" className="text-sm font-medium text-green-200 hover:text-white">
          ← Coach Admin
        </Link>
        <h1 className="mt-2 text-xl font-extrabold">🔌 FA Full-Time Test</h1>
        <p className="mt-0.5 text-sm text-green-200">
          Loads a Full-Time code snippet in your browser to see what it gives us
        </p>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLoaded(code.trim());
          }}
          className="mb-4 flex gap-2"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            aria-label="Snippet code (lrcode)"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900"
          />
          <button className="cursor-pointer rounded-xl bg-green-600 px-4 py-2 font-bold text-white">
            Load
          </button>
        </form>

        <p className="mb-2 text-sm font-semibold text-gray-700">{status}</p>

        <iframe
          key={loaded}
          ref={frame}
          srcDoc={snippetPage(loaded)}
          title="Full-Time snippet"
          className="mb-4 h-80 w-full rounded-xl border border-gray-200 bg-white"
        />

        {html && (
          <>
            <button
              onClick={copy}
              className="mb-2 cursor-pointer rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white"
            >
              {copied ? "Copied ✓" : "Copy what came back"}
            </button>
            <textarea
              readOnly
              value={html}
              rows={10}
              className="w-full rounded-xl border border-gray-200 bg-white p-2 font-mono text-xs text-gray-700"
            />
          </>
        )}
      </div>
    </main>
  );
}
