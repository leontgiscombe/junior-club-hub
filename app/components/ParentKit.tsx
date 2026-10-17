"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { KIT_EXTRAS, kitAspect, type KitExtra } from "@/lib/clubSettings";
import { KIT_ITEMS, itemsFor } from "@/lib/kitItems";
import type { ParentKitData, ParentKitChild } from "@/lib/parentKit";
import type { Submission } from "@/lib/storage";
import { useClub } from "./ClubProvider";
import KitForm, { SizeGuide } from "./KitForm";
import KitRequestForm from "./KitRequestForm";
import { ICONS, ToolTabs, TopBar, useScreens } from "./SettingsUI";

const surface = "rounded-lg bg-white shadow-sm dark:bg-[#1c1c1e]";
const muted = "text-gray-500 dark:text-gray-400";
const command = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40";
const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

function KitRow({ title, detail, icon, onClick, children }: {
  title: string; detail: string; icon: React.ReactNode; onClick: () => void; children?: React.ReactNode;
}) {
  return <button onClick={onClick} className="flex min-h-18 w-full items-center gap-3 px-4 py-3 text-left">
    <span className="shrink-0 text-green-700 dark:text-green-400">{icon}</span><span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{title}</span><span className={`mt-1 block text-xs ${muted}`}>{detail}</span></span>{children}<span aria-hidden="true" className="shrink-0 text-gray-400">›</span>
  </button>;
}

function SubmittedSizes({ submission }: { submission: Submission }) {
  const sizes = [{ label: "Shirt", value: submission.shirtSize }, { label: "Shorts", value: submission.shortsSize }, { label: "Socks", value: submission.socksSize }, ...Object.entries(submission.extras ?? {}).filter(([key, value]) => key in KIT_EXTRAS && value).map(([key, value]) => ({ label: KIT_EXTRAS[key as KitExtra].short, value }))];
  return <dl className="grid grid-cols-2 gap-5 border-y border-gray-200 py-5 dark:border-white/15">{sizes.map((size) => <div key={size.label}><dt className={`text-xs ${muted}`}>{size.label}</dt><dd className="mt-1 break-words text-xl font-bold">{size.value}</dd></div>)}</dl>;
}

export default function ParentKit() {
  const CLUB = useClub();
  const { screen, open, close } = useScreens("/kit");
  const [data, setData] = useState<ParentKitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++revision.current;
    setError("");
    try {
      const response = await fetch("/api/kit", { cache: "no-store" });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "Your kit details could not be loaded.");
      if (current === revision.current) setData(next);
    } catch (failure) {
      if (current === revision.current) setError(failure instanceof Error ? failure.message : "Couldn't connect. Please try again.");
    } finally { if (current === revision.current) setLoading(false); }
  }, []);

  useEffect(() => {
    const update = () => { void refresh(); };
    const visible = () => { if (document.visibilityState === "visible") update(); };
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", visible);
    return () => { revision.current += 1; window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);

  const family = data?.family ?? [];
  const selfOnly = family.length === 1 && family[0].id === "me";
  const requests = data?.requests ?? [];
  const pending = requests.filter((request) => !request.doneAt);
  const completed = requests.filter((request) => request.doneAt);
  const history = family.flatMap((child) => child.submissions.map((submission) => ({ child, submission }))).sort((first, second) => second.submission.submittedAt.localeCompare(first.submission.submittedAt));
  const child = family.find((entry) => screen === `sizes-${entry.id}` || screen === `edit-${entry.id}`);
  const request = requests.find((entry) => screen === `request-${entry.id}`);
  const record = history.find((entry) => screen === `submission-${entry.submission.id}`);
  const view = screen === "requests" || screen === "history" ? screen : "sizes";
  const detail = !!child || !!request || !!record || ["new-request", "guide", "kit"].includes(screen) || /^(sizes-|edit-|request-|submission-)/.test(screen);
  const latest = child?.submissions[0];
  const title = child ? `${child.name}'s Sizes` : request ? "Kit Request" : record ? `${record.child.name}'s Sizes` : screen === "new-request" ? "Request Kit" : screen === "guide" ? "Size Guide" : screen === "kit" ? "This Season's Kit" : "Your Kit";

  function navigate(next: string) { if (busy) return; setError(""); setNotice(""); open(next); }
  function replaceScreen(next: string) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${next}`);
    window.dispatchEvent(new Event("hashchange"));
    window.scrollTo(0, 0);
  }
  function saved(next: string, message: string) {
    setNotice(message);
    if (window.location.hash.slice(1) === screen) replaceScreen(next);
    void refresh();
  }
  function updateSizes(entry: ParentKitChild) { setError(""); setNotice(""); replaceScreen(`edit-${entry.id}`); }
  function editChild(entry: ParentKitChild) { navigate(`${entry.submissions.length ? "sizes" : "edit"}-${entry.id}`); }
  async function takeBack() {
    if (!request || request.doneAt || busy || !confirm("Take this request back?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/kit/requests?id=${encodeURIComponent(request.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "That request could not be taken back.");
      setData((current) => current ? { ...current, requests: current.requests.filter((entry) => entry.id !== request.id) } : current);
      setNotice("Request taken back.");
      if (window.location.hash.slice(1) === screen) replaceScreen("requests");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Couldn't connect. Please try again."); }
    finally { setBusy(false); }
  }

  const banner = <div className="relative w-full overflow-hidden rounded-lg bg-[var(--club-night)]" style={{ aspectRatio: kitAspect(CLUB.kitImage) }}><Image src={CLUB.kitImage.src} alt={`Home and away kit for ${CLUB.kitSeason}`} fill unoptimized={CLUB.kitImage.src.startsWith("/api/")} sizes="(max-width: 672px) calc(100vw - 32px), 640px" className="object-contain" priority /></div>;

  return <div className="themed min-h-screen bg-[#f2f2f7] text-gray-900 dark:bg-black dark:text-gray-50">
    {detail ? <TopBar title={title} onBack={() => { if (!busy) { setError(""); setNotice(""); close(); } }} /> : <TopBar title="Your Kit" href="/" />}
    <main className="mx-auto max-w-2xl px-4 pb-12 pt-4">
      {notice && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-400/10 dark:text-green-200">{notice}</p>}
      {error && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">{error}<button onClick={() => void refresh()} className="ml-3 min-h-11 font-semibold underline">Retry</button></div>}
      {loading && !data && <p role="status" className={`py-8 text-center text-sm ${muted}`}>Loading your kit...</p>}
      {data && (child && screen.startsWith("edit-") ? <section>
        <p className={`mb-4 text-sm ${muted}`}>{child.teamName}</p>
        <KitForm key={`${child.id}:${latest?.id ?? "new"}`} team={child.team} squad={child.playerId ? [{ id: child.playerId, label: child.name }] : []} fixedChild={{ id: child.playerId, name: child.name }} extras={CLUB.kitExtras} initial={latest} onSaved={({ alreadySent }) => saved(`sizes-${child.id}`, alreadySent ? "Updated sizes saved. Your previous submission is kept, and coaches can see both." : "Kit sizes saved.")} />
      </section> : child && latest ? <section className="space-y-5"><p className={`text-sm ${muted}`}>{child.teamName} · Submitted {when(latest.submittedAt)}</p><SubmittedSizes submission={latest} /><div className="flex flex-wrap items-center gap-3"><button className={command} onClick={() => updateSizes(child)}>{ICONS.doc}Update Sizes</button><button onClick={() => navigate("guide")} className="min-h-11 px-2 text-sm font-semibold text-green-700 dark:text-green-400">Size Guide</button></div></section>
        : record ? <section className="space-y-5"><p className={`text-sm ${muted}`}>{record.child.teamName} · Submitted {when(record.submission.submittedAt)}</p><SubmittedSizes submission={record.submission} /><button className={command} onClick={() => updateSizes(record.child)}>{ICONS.doc}Update Current Sizes</button></section>
          : request ? <section className="space-y-5"><div className="flex items-center gap-3"><span className="text-green-700 dark:text-green-400">{ICONS.shirt}</span><div><h2 className="text-lg font-bold">{KIT_ITEMS[request.item]?.label ?? request.item}</h2><p className={`mt-1 text-sm ${muted}`}>{request.childName}</p></div></div><dl className="grid grid-cols-2 gap-5 border-y border-gray-200 py-4 dark:border-white/15">{[{ label: "Size", value: request.size }, { label: "Quantity", value: request.quantity }, { label: "Requested", value: when(request.createdAt) }, { label: "Status", value: request.doneAt ? "Completed" : "Waiting for coaches" }].map((item) => <div key={item.label}><dt className={`text-xs ${muted}`}>{item.label}</dt><dd className="mt-1 text-sm font-semibold">{item.value}</dd></div>)}</dl>{request.note && <p className="whitespace-pre-wrap break-words text-sm">{request.note}</p>}{request.doneAt ? <p className={`text-sm ${muted}`}>Completed {when(request.doneAt)}</p> : <button disabled={busy} onClick={() => void takeBack()} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-red-700 disabled:opacity-40 dark:text-red-400">{ICONS.bin}{busy ? "Taking back..." : "Take Back Request"}</button>}</section>
            : screen === "new-request" ? family.length ? <KitRequestForm family={family.map(({ id, name, teamName }) => ({ id, name, teamName }))} items={itemsFor(CLUB.kitExtras)} initial={[]} showHistory={false} onSent={() => saved("requests", "Your kit request has been sent to the coaches.")} /> : <p className={`py-6 text-sm ${muted}`}>Add an approved child and team in <Link href="/account" className="font-semibold underline">Your Account</Link> before requesting kit.</p>
              : screen === "guide" ? <SizeGuide defaultOpen />
                : screen === "kit" ? <section>{banner}<p className={`mt-4 text-sm ${muted}`}>{CLUB.kitSeason} season · {CLUB.fullName}</p></section>
                  : detail ? <p className={`py-8 text-center text-sm ${muted}`}>This kit record is no longer available.</p>
                    : <>
                      <button onClick={() => navigate("kit")} aria-label="View this season's kit" title="View this season's kit" className="mb-3 block w-full">{banner}</button>
                      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><h1 className="text-xl font-bold">{selfOnly ? "Your kit" : "Your family's kit"}</h1><p className={`text-xs ${muted}`}>{CLUB.kitSeason} season</p></div>
                      <ToolTabs label="Kit views" tabs={[{ id: "sizes", label: "Sizes" }, { id: "requests", label: "Requests", count: pending.length }, { id: "history", label: "History", count: history.length + completed.length }]} value={view} onChange={navigate} panelId="parent-kit-panel" />
                      <section id="parent-kit-panel" role="tabpanel" aria-label={view}>
                        {view === "sizes" && <><h2 className="mb-3 text-lg font-bold">{selfOnly ? "Your sizes" : "Your children"}</h2><div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{family.map((entry) => <KitRow key={entry.id} title={entry.name} detail={entry.teamName} icon={ICONS.child} onClick={() => editChild(entry)}><span className={`shrink-0 text-xs font-semibold ${entry.submissions.length ? "text-green-700 dark:text-green-400" : "text-amber-800 dark:text-amber-300"}`}>{entry.submissions.length ? "Submitted" : "Needed"}</span></KitRow>)}</div>{!family.length && <p className={`py-6 text-sm ${muted}`}>No approved team members linked yet. <Link href="/account" className="font-semibold underline">Your Account</Link></p>}<button onClick={() => navigate("guide")} className="mt-5 min-h-11 text-sm font-semibold text-green-700 dark:text-green-400">Size Guide</button><Link href="/kit?all=1" className={`mt-4 block py-2 text-xs underline ${muted}`}>Choose a team manually</Link></>}
                        {view === "requests" && <><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Open requests</h2><button disabled={!family.length} onClick={() => navigate("new-request")} className={command}>Request Kit</button></div><div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{pending.map((entry) => <KitRow key={entry.id} title={KIT_ITEMS[entry.item]?.label ?? entry.item} detail={`${entry.childName} · ${entry.size} · Qty ${entry.quantity}`} icon={ICONS.shirt} onClick={() => navigate(`request-${entry.id}`)}><span className={`text-xs ${muted}`}>Waiting</span></KitRow>)}</div>{!pending.length && <p className={`py-8 text-center text-sm ${muted}`}>No requests waiting.</p>}</>}
                        {view === "history" && <><h2 className="mb-3 text-lg font-bold">Submitted sizes</h2><div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{history.map((entry) => <KitRow key={`${entry.child.id}:${entry.submission.id}`} title={entry.child.name} detail={`${when(entry.submission.submittedAt)} · Shirt ${entry.submission.shirtSize} · Shorts ${entry.submission.shortsSize} · Socks ${entry.submission.socksSize}`} icon={ICONS.doc} onClick={() => navigate(`submission-${entry.submission.id}`)} />)}</div>{!history.length && <p className={`py-4 text-sm ${muted}`}>No sizes submitted yet.</p>}<h2 className="mb-3 mt-6 text-lg font-bold">Completed requests</h2><div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{completed.map((entry) => <KitRow key={entry.id} title={KIT_ITEMS[entry.item]?.label ?? entry.item} detail={`${entry.childName} · Completed ${when(entry.doneAt!)}`} icon={ICONS.shirt} onClick={() => navigate(`request-${entry.id}`)} />)}</div>{!completed.length && <p className={`py-4 text-sm ${muted}`}>No completed requests yet.</p>}</>}
                      </section>
                    </>)}
      <footer className={`mt-8 text-center text-xs ${muted}`}><Link href="/privacy" className="hover:underline">Privacy</Link>{" · "}<Link href="/terms" className="hover:underline">Terms</Link></footer>
    </main>
  </div>;
}