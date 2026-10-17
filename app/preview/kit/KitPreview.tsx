"use client";

import Image from "next/image";
import { useState } from "react";
import { KIT_ITEMS, SIZES, SOCK_SIZES, type KitItem } from "@/lib/kitItems";
import { ICONS, ToolTabs, useScreens } from "../../components/SettingsUI";
import { command, field, muted, PreviewFrame, PreviewRow, surface } from "../PreviewUI";

type Sizes = { shirt: string; shorts: string; socks: string };
type Child = { id: string; name: string; team: string; sizes: Sizes | null; submittedAt: string | null };
type KitRequest = { id: string; childId: string; item: KitItem; size: string; quantity: number; note: string; createdAt: string; doneAt: string | null };
const EMPTY_SIZES: Sizes = { shirt: "", shorts: "", socks: "" };
const SIZE_FIELDS = [{ key: "shirt", label: "Shirt size", sizes: SIZES }, { key: "shorts", label: "Shorts size", sizes: SIZES }, { key: "socks", label: "Socks size", sizes: SOCK_SIZES }] as const;
const INITIAL_CHILDREN: Child[] = [
  { id: "alex", name: "Alex Taylor", team: "Lions U10", sizes: { shirt: "XXS", shorts: "XXS", socks: "S" }, submittedAt: "14 Oct 2026" },
  { id: "sam", name: "Sam Taylor", team: "Tigers U11", sizes: null, submittedAt: null },
];
const INITIAL_REQUESTS: KitRequest[] = [
  { id: "pending", childId: "alex", item: "jacket", size: "XXS", quantity: 1, note: "Replacement for a lost jacket.", createdAt: "15 Oct 2026", doneAt: null },
  { id: "completed", childId: "sam", item: "socks", size: "S", quantity: 2, note: "", createdAt: "1 Oct 2026", doneAt: "5 Oct 2026" },
];

function sizesSummary(sizes: Sizes) { return `Shirt ${sizes.shirt} · Shorts ${sizes.shorts} · Socks ${sizes.socks}`; }

export default function KitPreview() {
  const { screen, open, close } = useScreens("/preview/kit");
  const [children, setChildren] = useState(INITIAL_CHILDREN);
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const [drafts, setDrafts] = useState<Record<string, Sizes>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const view = screen === "requests" || screen === "history" ? screen : "sizes";
  const child = children.find((entry) => screen === `sizes-${entry.id}`);
  const request = requests.find((entry) => screen === `request-${entry.id}`);
  const detail = !!child || !!request || ["new-request", "guide", "kit"].includes(screen);
  const pending = requests.filter((entry) => !entry.doneAt);
  const completed = requests.filter((entry) => entry.doneAt);
  const historyCount = children.filter((entry) => entry.submittedAt).length + completed.length;
  const title = child ? `${child.name}'s Sizes` : request ? "Kit Request" : screen === "new-request" ? "Request Kit" : screen === "guide" ? "Size Guide" : screen === "kit" ? "This Season's Kit" : "Your Kit";
  const selectedSizes = child ? drafts[child.id] ?? child.sizes ?? EMPTY_SIZES : EMPTY_SIZES;

  function navigate(next: string) { setNotice(""); setConfirmCancel(false); open(next); }
  function openSizes(entry: Child) { setEditing(entry.sizes ? null : entry.id); navigate(`sizes-${entry.id}`); }
  function back() { setConfirmCancel(false); setNotice(""); close(); }

  return <PreviewFrame title={title} area="kit" onBack={detail ? back : undefined}>
    {notice && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-400/10 dark:text-green-200">{notice}</p>}
    {child ? <section>
      <div className="mb-5 flex items-start justify-between gap-3"><div><p className={`text-sm ${muted}`}>{child.team}</p><p className={`mt-1 text-xs ${muted}`}>{child.submittedAt ? `Submitted ${child.submittedAt}` : "Sizes still needed"}</p></div><button onClick={() => navigate("guide")} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-green-700 dark:text-green-400">Size Guide</button></div>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setChildren(children.map((entry) => entry.id === child.id ? { ...entry, sizes: { ...selectedSizes }, submittedAt: "Just now" } : entry)); setEditing(null); setNotice("Sizes submitted in preview."); }}>
        {SIZE_FIELDS.map((option) => <label key={option.key} className="block text-sm font-semibold">{option.label}<select required disabled={editing !== child.id} value={selectedSizes[option.key]} onChange={(event) => setDrafts({ ...drafts, [child.id]: { ...selectedSizes, [option.key]: event.target.value } })} className={field}><option value="">Choose a size</option>{option.sizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>)}
        {editing === child.id ? <button className={command} disabled={SIZE_FIELDS.some((option) => !selectedSizes[option.key])}>{ICONS.doc}{child.submittedAt ? "Save Sizes" : "Submit Sizes"}</button> : <button type="button" className={command} onClick={() => setEditing(child.id)}>{ICONS.doc}Edit Sizes</button>}
      </form>
    </section> : screen === "new-request" ? <RequestForm family={children} onSubmit={(next) => { setRequests([{ ...next, id: crypto.randomUUID(), createdAt: "Just now", doneAt: null }, ...requests]); close(); setNotice("Kit request sent in preview."); }} />
      : request ? <section className="space-y-5">
        <div className="flex items-center gap-3"><span className="text-green-700 dark:text-green-400">{ICONS.shirt}</span><div><h2 className="text-lg font-bold">{KIT_ITEMS[request.item].label}</h2><p className={`mt-1 text-sm ${muted}`}>{children.find((entry) => entry.id === request.childId)?.name}</p></div></div>
        <dl className="grid grid-cols-2 gap-5 border-y border-gray-200 py-4 dark:border-white/15">{[{ label: "Size", value: request.size }, { label: "Quantity", value: request.quantity }, { label: "Requested", value: request.createdAt }, { label: "Status", value: request.doneAt ? "Completed" : "Waiting for coaches" }].map((item) => <div key={item.label}><dt className={`text-xs ${muted}`}>{item.label}</dt><dd className="mt-1 text-sm font-semibold">{item.value}</dd></div>)}</dl>
        {request.note && <p className="whitespace-pre-wrap break-words text-sm">{request.note}</p>}
        {request.doneAt ? <p className={`text-sm ${muted}`}>Completed {request.doneAt}</p> : confirmCancel ? <div><p role="alert" className="mb-3 text-sm font-semibold">Take back this request?</p><div className="flex flex-wrap gap-3"><button onClick={() => { setRequests(requests.filter((entry) => entry.id !== request.id)); close(); setNotice("Request taken back in preview."); }} className="min-h-11 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white">Confirm Take Back</button><button onClick={() => setConfirmCancel(false)} className="min-h-11 px-3 text-sm font-semibold">Keep Request</button></div></div> : <button onClick={() => setConfirmCancel(true)} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">{ICONS.bin}Take Back Request</button>}
      </section>
        : screen === "guide" ? <section>
          <h2 className="mb-3 text-lg font-bold">Shirt and shorts</h2><table className="w-full text-left text-sm"><thead><tr className={`border-b border-gray-200 dark:border-white/15 ${muted}`}><th scope="col" className="py-3">Size</th><th scope="col" className="py-3">Player height</th></tr></thead><tbody>{SIZES.map((size, index) => <tr key={size} className="border-b border-gray-100 dark:border-white/10"><th scope="row" className="py-3 font-semibold">{size}</th><td className="py-3">{["110-119 cm", "120-132 cm", "133-146 cm", "147-160 cm", "160-172 cm"][index]}</td></tr>)}</tbody></table>
          <h2 className="mb-3 mt-6 text-lg font-bold">Socks</h2><table className="w-full text-left text-sm"><thead><tr className={`border-b border-gray-200 dark:border-white/15 ${muted}`}><th scope="col" className="py-3">Size</th><th scope="col" className="py-3">UK shoe size</th></tr></thead><tbody>{SOCK_SIZES.map((size, index) => <tr key={size} className="border-b border-gray-100 dark:border-white/10"><th scope="row" className="py-3 font-semibold">{size}</th><td className="py-3">{["10-2", "2.5-5", "5.5-8"][index]}</td></tr>)}</tbody></table>
        </section>
          : screen === "kit" ? <section><p className={`mb-4 text-sm ${muted}`}>2026/27 season</p><Image src="/kit-generic.jpg" alt="The club's current season kit" width={600} height={700} className="max-h-[65vh] w-full object-contain" priority /><button className={`${command} mt-5`} onClick={() => navigate("sizes")}>View Sizes</button></section>
            : <>
              <button onClick={() => navigate("kit")} aria-label="View this season's kit" title="View this season's kit" className="mb-3 block w-full overflow-hidden rounded-lg bg-[var(--club-night)]"><Image src="/kit-generic.jpg" alt="Home and away kits" width={1024} height={557} sizes="(max-width: 672px) calc(100vw - 32px), 640px" className="h-auto w-full" priority /></button>
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><h1 className="text-xl font-bold">Your family&apos;s kit</h1><p className={`text-xs ${muted}`}>2026/27 season</p></div>
              <ToolTabs label="Kit preview views" tabs={[{ id: "sizes", label: "Sizes" }, { id: "requests", label: "Requests", count: pending.length }, { id: "history", label: "History", count: historyCount }]} value={view} onChange={navigate} panelId="kit-preview-panel" />
              <section id="kit-preview-panel" role="tabpanel" aria-label={view}>
                {view === "sizes" && <><h2 className="mb-3 text-lg font-bold">Your children</h2><div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{children.map((entry) => <PreviewRow key={entry.id} title={entry.name} detail={entry.team} icon={ICONS.child} onClick={() => openSizes(entry)}><span className={`shrink-0 text-xs font-semibold ${entry.submittedAt ? "text-green-700 dark:text-green-400" : "text-amber-800 dark:text-amber-300"}`}>{entry.submittedAt ? "Submitted" : "Needed"}</span></PreviewRow>)}</div><button className="mt-5 min-h-11 text-sm font-semibold text-green-700 dark:text-green-400" onClick={() => navigate("guide")}>Size Guide</button></>}
                {view === "requests" && <><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Open requests</h2><button className={command} onClick={() => navigate("new-request")}>Request Kit</button></div><div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{pending.map((entry) => <PreviewRow key={entry.id} title={KIT_ITEMS[entry.item].label} detail={`${children.find((item) => item.id === entry.childId)?.name} · ${entry.size} · Qty ${entry.quantity}`} icon={ICONS.shirt} onClick={() => navigate(`request-${entry.id}`)}><span className={`text-xs ${muted}`}>Waiting</span></PreviewRow>)}</div>{!pending.length && <p className={`py-8 text-center text-sm ${muted}`}>No requests waiting.</p>}</>}
                {view === "history" && <><h2 className="mb-3 text-lg font-bold">Submitted sizes</h2><div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{children.filter((entry) => entry.submittedAt && entry.sizes).map((entry) => <PreviewRow key={entry.id} title={entry.name} detail={`${entry.submittedAt} · ${sizesSummary(entry.sizes!)}`} icon={ICONS.doc} onClick={() => openSizes(entry)} />)}</div><h2 className="mb-3 mt-6 text-lg font-bold">Completed requests</h2><div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{completed.map((entry) => <PreviewRow key={entry.id} title={KIT_ITEMS[entry.item].label} detail={`${children.find((item) => item.id === entry.childId)?.name} · Completed ${entry.doneAt}`} icon={ICONS.shirt} onClick={() => navigate(`request-${entry.id}`)} />)}</div>{!completed.length && <p className={`py-5 text-sm ${muted}`}>No completed requests yet.</p>}</>}
              </section>
            </>}
  </PreviewFrame>;
}

function RequestForm({ family, onSubmit }: { family: Child[]; onSubmit: (request: Omit<KitRequest, "id" | "createdAt" | "doneAt">) => void }) {
  const [childId, setChildId] = useState(family[0]?.id ?? "");
  const [item, setItem] = useState<KitItem>("shirt");
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (childId && KIT_ITEMS[item].sizes.includes(size) && quantity >= 1 && quantity <= 5) onSubmit({ childId, item, size, quantity, note: note.trim() }); }}>
    <label className="block text-sm font-semibold">Child<select className={field} value={childId} onChange={(event) => setChildId(event.target.value)} required>{family.map((child) => <option key={child.id} value={child.id}>{child.name} · {child.team}</option>)}</select></label>
    <label className="block text-sm font-semibold">Item<select className={field} value={item} onChange={(event) => { setItem(event.target.value as KitItem); setSize(""); }}>{(Object.keys(KIT_ITEMS) as KitItem[]).map((key) => <option key={key} value={key}>{KIT_ITEMS[key].label}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold">Size<select className={field} value={size} onChange={(event) => setSize(event.target.value)} required><option value="">Choose a size</option>{KIT_ITEMS[item].sizes.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label className="block text-sm font-semibold">Quantity<input className={field} type="number" min={1} max={5} step={1} required value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label></div>
    <label className="block text-sm font-semibold">Note <span className={`font-normal ${muted}`}>(optional)</span><textarea className={field} rows={3} maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} /></label>
    <button className={command} disabled={!childId || !size || quantity < 1 || quantity > 5}>{ICONS.doc}Send Request</button>
  </form>;
}