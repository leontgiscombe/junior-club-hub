"use client";

import { useState } from "react";
import { ICONS, ToolTabs, useScreens } from "../../components/SettingsUI";
import { command, field, muted, PreviewFrame, PreviewRow, surface } from "../PreviewUI";

type Child = { id: string; name: string; team: string; approved: boolean };
type Profile = { name: string; phone: string };
const TEAMS = [{ id: "lions", name: "Lions U10" }, { id: "tigers", name: "Tigers U11" }];
const TAB_OPTIONS = [{ id: "Home", icon: ICONS.grid }, { id: "Training", icon: ICONS.team }, { id: "Kit", icon: ICONS.shirt }, { id: "Results", icon: ICONS.crest }, { id: "Account", icon: ICONS.person }];

export default function AccountPreview() {
  const { screen, open, close } = useScreens("/preview/account");
  const [profile, setProfile] = useState<Profile>({ name: "Jordan Taylor", phone: "07700 900123" });
  const [children, setChildren] = useState<Child[]>([{ id: "alex", name: "Alex Taylor", team: "lions", approved: true }, { id: "sam", name: "Sam Taylor", team: "tigers", approved: false }]);
  const [appearance, setAppearance] = useState("Match phone");
  const [notifications, setNotifications] = useState(true);
  const [tabs, setTabs] = useState(["Home", "Training", "Kit"]);
  const [passkeys, setPasskeys] = useState([{ id: "iphone", label: "iPhone", added: "12 Oct 2026" }]);
  const [notice, setNotice] = useState("");
  const view = screen === "preferences" || screen === "security" ? screen : "family";
  const child = children.find((entry) => screen === `child-${entry.id}`);
  const detail = !!child || ["new-child", "details", "appearance", "notifications", "tabs"].includes(screen);
  const title = child?.name ?? ({ "new-child": "Add Child", details: "Your Details", appearance: "Appearance", notifications: "Notifications", tabs: "Tab Bar" }[screen] || "Your Account");
  const initials = profile.name.trim().split(/\s+/).map((part) => part.slice(0, 1)).slice(0, 2).join("");

  function navigate(next: string) { setNotice(""); open(next); }
  function returnToList() { setNotice(""); close(); }

  return <PreviewFrame title={title} area="account" onBack={detail ? returnToList : undefined}>
    {notice && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-400/10 dark:text-green-200">{notice}</p>}
    {child || screen === "new-child" ? <ChildEditor key={child?.id ?? "new"} child={child ?? null} onSave={(next) => {
      setChildren(child ? children.map((entry) => entry.id === child.id ? next : entry) : [...children, { ...next, id: crypto.randomUUID() }]);
      close(); setNotice("Child saved in preview.");
    }} onRemove={child ? () => { setChildren(children.filter((entry) => entry.id !== child.id)); close(); setNotice("Child removed from preview."); } : undefined} />
      : screen === "details" ? <ProfileEditor key={profile.name} profile={profile} onSave={(next) => { setProfile(next); close(); setNotice("Details saved in preview."); }} />
        : screen === "appearance" ? <section>
          <h2 className="mb-3 text-lg font-bold">Colour mode</h2>
          <div role="group" aria-label="Colour mode" className="grid grid-cols-3 gap-2">{["Match phone", "Light", "Dark"].map((option) => <button key={option} aria-pressed={appearance === option} onClick={() => setAppearance(option)} className={`min-h-12 rounded-lg border px-2 text-sm font-semibold ${appearance === option ? "border-green-700 bg-green-50 text-green-800 dark:bg-green-400/10 dark:text-green-200" : "border-gray-200 dark:border-white/15"}`}>{option}</button>)}</div>
          <div className="no-dark mt-6 rounded-lg border p-5" style={{ backgroundColor: appearance === "Dark" ? "#18181b" : "#fff", color: appearance === "Dark" ? "#fafafa" : "#18181b", borderColor: appearance === "Dark" ? "#3f3f46" : "#e5e7eb" }}>
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-green-700 text-xs font-bold text-white">{initials}</span><div><p className="text-sm font-semibold">{profile.name}</p><p className="text-xs opacity-60">Family account</p></div></div>
            <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm" style={{ borderColor: appearance === "Dark" ? "#3f3f46" : "#e5e7eb" }}><span>Your children</span><span>{children.length}</span></div>
          </div>
        </section>
          : screen === "notifications" ? <section className={`${surface} p-4`}>
            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4"><span className="flex items-center gap-3 text-sm font-semibold"><span className="text-green-700 dark:text-green-400">{ICONS.bell}</span>Phone notifications</span><input type="checkbox" checked={notifications} onChange={(event) => setNotifications(event.target.checked)} className="h-5 w-5 shrink-0 accent-green-700" /></label>
            <p className={`mt-2 text-sm ${muted}`}>{notifications ? "Season awards alerts on" : "Season awards alerts off"}</p>
          </section>
            : screen === "tabs" ? <section>
              <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Your tabs</h2><span className={`text-sm tabular-nums ${muted}`}>{tabs.length} / 4</span></div>
              <div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{TAB_OPTIONS.map((option) => <label key={option.id} className="flex min-h-16 items-center gap-3 p-4 text-sm font-semibold"><span className="text-green-700 dark:text-green-400">{option.icon}</span><span className="flex-1">{option.id}</span><input type="checkbox" checked={tabs.includes(option.id)} disabled={option.id === "Home" || (tabs.length === 4 && !tabs.includes(option.id))} onChange={(event) => setTabs(event.target.checked ? [...tabs, option.id] : tabs.filter((tab) => tab !== option.id))} className="h-5 w-5 accent-green-700 disabled:opacity-40" /></label>)}</div>
              <div className={`${surface} mt-5 flex justify-around gap-1 px-2 py-3`} aria-label="Selected tab bar">{tabs.map((tab) => <span key={tab} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-green-700 dark:text-green-400">{TAB_OPTIONS.find((option) => option.id === tab)?.icon}<span className="text-[11px] font-semibold">{tab}</span></span>)}</div>
            </section>
              : <>
                <div className="mb-5 flex items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-green-700 text-sm font-bold text-white">{initials}</span><div className="min-w-0"><h1 className="break-words text-xl font-bold">{profile.name}</h1><p className={`break-all text-xs ${muted}`}>jordan@example.test</p></div></div>
                <ToolTabs label="Account preview views" tabs={[{ id: "family", label: "Family" }, { id: "preferences", label: "Preferences" }, { id: "security", label: "Security" }]} value={view} onChange={navigate} panelId="account-preview-panel" />
                <section id="account-preview-panel" role="tabpanel" aria-label={view}>
                  {view === "family" && <>
                    <div className={`${surface} mb-6`}><PreviewRow title="Your details" detail={profile.phone} icon={ICONS.person} onClick={() => navigate("details")} /></div>
                    <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Your children</h2><button className="min-h-11 px-2 text-sm font-semibold text-green-700 dark:text-green-400" onClick={() => navigate("new-child")}>Add Child</button></div>
                    <div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{children.map((entry) => <PreviewRow key={entry.id} title={entry.name} detail={TEAMS.find((team) => team.id === entry.team)?.name ?? "No team selected"} icon={ICONS.child} onClick={() => navigate(`child-${entry.id}`)}>{!entry.approved && <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Pending</span>}</PreviewRow>)}</div>
                    {!children.length && <p className={`py-6 text-center text-sm ${muted}`}>No children added.</p>}
                    <div className="mt-6 border-t border-gray-200 pt-4 dark:border-white/15"><p className={`text-xs font-semibold uppercase ${muted}`}>Your club</p><p className="mt-2 text-sm font-semibold">Riverside Juniors</p><p className={`mt-1 text-xs ${muted}`}>Parent · Approved member</p></div>
                  </>}
                  {view === "preferences" && <div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}><PreviewRow title="Appearance" detail={appearance} icon={ICONS.palette} onClick={() => navigate("appearance")} /><PreviewRow title="Notifications" detail={notifications ? "On for this phone" : "Off for this phone"} icon={ICONS.bell} onClick={() => navigate("notifications")} /><PreviewRow title="Tab bar" detail={tabs.join(", ")} icon={ICONS.grid} onClick={() => navigate("tabs")} /></div>}
                  {view === "security" && <>
                    <h2 className="mb-3 text-lg font-bold">Passkeys</h2><div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{passkeys.map((passkey) => <div key={passkey.id} className="flex min-h-18 items-center gap-3 p-4"><span className="text-green-700 dark:text-green-400">{ICONS.key}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{passkey.label}</span><span className={`mt-1 block text-xs ${muted}`}>Added {passkey.added}</span></span><button title={`Remove ${passkey.label} passkey`} aria-label={`Remove ${passkey.label} passkey`} onClick={() => { setPasskeys(passkeys.filter((entry) => entry.id !== passkey.id)); setNotice("Passkey removed from preview."); }} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-red-700 dark:text-red-400">{ICONS.bin}</button></div>)}</div>
                    {!passkeys.length && <p className={`py-5 text-sm ${muted}`}>No passkeys in this preview.</p>}
                    <button className={`${command} mt-4`} onClick={() => { setPasskeys([...passkeys, { id: crypto.randomUUID(), label: "Sample device", added: "just now" }]); setNotice("Passkey added in preview."); }}>{ICONS.key}Add Passkey</button>
                    <div className="mt-6 border-t border-gray-200 pt-4 dark:border-white/15"><h3 className="text-sm font-semibold">Sign-in email</h3><p className={`mt-2 text-sm ${muted}`}>jordan@example.test</p></div>
                  </>}
                </section>
              </>}
  </PreviewFrame>;
}

function ProfileEditor({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void }) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave({ name: name.trim(), phone: phone.trim() }); }}>
    <label className="block text-sm font-semibold">Your name<input autoComplete="off" className={field} value={name} required maxLength={60} onChange={(event) => setName(event.target.value)} /></label>
    <label className="block text-sm font-semibold">Mobile number<input type="tel" autoComplete="off" className={field} value={phone} required maxLength={24} onChange={(event) => setPhone(event.target.value)} /></label>
    <button className={command} disabled={!name.trim() || !phone.trim()}>{ICONS.doc}Save Details</button>
  </form>;
}

function ChildEditor({ child, onSave, onRemove }: { child: Child | null; onSave: (child: Child) => void; onRemove?: () => void }) {
  const [name, setName] = useState(child?.name ?? "");
  const [team, setTeam] = useState(child?.team ?? "");
  const [confirm, setConfirm] = useState(false);
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave({ id: child?.id ?? "new", name: name.trim(), team, approved: child?.approved ?? false }); }}>
    <label className="block text-sm font-semibold">Child&apos;s name<input autoComplete="off" className={field} required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label className="block text-sm font-semibold">{child?.approved ? "Current team" : "Requested team"}<select className={field} disabled={child?.approved} value={team} onChange={(event) => setTeam(event.target.value)}><option value="">No team selected</option>{TEAMS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
    <p className={`text-xs ${muted}`}>{child?.approved ? "Approved squad player" : "Awaiting coach approval"}</p>
    <button className={command} disabled={!name.trim()}>{ICONS.doc}Save Child</button>
    {onRemove && <div className="border-t border-gray-200 pt-4 dark:border-white/15">{confirm ? <div className="space-y-3"><p role="alert" className="text-sm font-semibold">Remove {child?.name} from the preview?</p><div className="flex gap-3"><button type="button" onClick={onRemove} className="min-h-11 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white">Confirm Removal</button><button type="button" className={`min-h-11 px-3 text-sm font-semibold ${muted}`} onClick={() => setConfirm(false)}>Cancel</button></div></div> : <button type="button" onClick={() => setConfirm(true)} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">{ICONS.bin}Remove Child</button>}</div>}
  </form>;
}