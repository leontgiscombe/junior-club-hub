"use client";

import { useEffect, useState } from "react";
import { AWARD_VOTERS, VOTERS_LABEL, nomineesFor, votersOf, type AwardSlot, type AwardVoters, type SeasonAward, type SeasonAwardsData, type SeasonAwardView } from "@/lib/seasonAwards";
import { accountKey, rememberCoachKey } from "./coachKey";
import { ICONS, ToolTabs, TopBar, useScreens } from "./SettingsUI";

const panel = "rounded-lg bg-white p-4 shadow-sm dark:bg-[#1c1c1e]";
const field = "mt-1 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base dark:border-white/20 dark:bg-[#1c1c1e]";
const command = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-50";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-white/20";

async function requestData(admin: boolean, key: string): Promise<SeasonAwardsData> {
  const response = await fetch(admin ? "/api/awards/admin" : "/api/awards", {
    cache: "no-store", headers: admin ? { "x-coach-key": key } : {},
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Awards could not be loaded.");
  return data;
}

export default function SeasonAwards({ admin = false }: { admin?: boolean }) {
  const { screen, open, switchTo, close } = useScreens(admin ? "/admin/awards" : "/awards");
  const selectedId = admin ? screen.startsWith("award-") ? screen.slice(6) : screen.startsWith("result-") ? screen.slice(7) : "" : "";
  const view = screen === "results" || screen.startsWith("result-") ? "results" : screen === "visibility" ? "visibility" : "awards";
  const [data, setData] = useState<SeasonAwardsData | null>(null);
  const [key, setKey] = useState("");
  const [password, setPassword] = useState("");
  const [login, setLogin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [team, setTeam] = useState("");
  const [season, setSeason] = useState("");
  const [editing, setEditing] = useState<SeasonAwardView | "new" | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const credential = admin ? new URLSearchParams(window.location.search).get("key") || await accountKey() || "" : "";
        if (cancelled) return;
        setKey(credential);
        if (admin && !credential) { setLogin(true); return; }
        const next = await requestData(admin, credential);
        if (!cancelled) {
          setData(next);
          setSeason(next.season);
          setTeam(next.teams[0]?.slug ?? "");
          if (admin) rememberCoachKey(credential);
        }
      } catch (failure) {
        if (!cancelled) {
          setError(failure instanceof Error ? failure.message : "Awards could not be loaded.");
          if (admin) setLogin(true);
        }
      } finally { if (!cancelled) setLoading(false); }
    }
    void start();
    return () => { cancelled = true; };
  }, [admin]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const next = await requestData(true, password);
      rememberCoachKey(password);
      setKey(password);
      setPassword("");
      setData(next);
      setSeason(next.season);
      setTeam(next.teams[0]?.slug ?? "");
      setLogin(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not sign in.");
    } finally { setSaving(false); }
  }

  async function mutate(body: unknown, success: string): Promise<boolean> {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(admin ? "/api/awards/admin" : "/api/awards", {
        method: "POST", headers: { "Content-Type": "application/json", ...(admin ? { "x-coach-key": key } : {}) }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "That could not be saved.");
      setMessage(success);
      setData(await requestData(admin, key));
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not connect. Please try again.");
      return false;
    } finally { setSaving(false); }
  }

  const seasons = data ? [...new Set([data.season, ...data.awards.map((award) => award.season)])] : [];
  const awards = data?.awards.filter((award) => award.team === team && award.season === season) ?? [];
  return (
    <div className={`themed ${admin ? "" : "wp-page"} relative isolate min-h-screen bg-[#f2f2f7] text-gray-900 dark:bg-black dark:text-gray-50`}>
      {admin && (selectedId || editing) ? <TopBar title={editing ? editing === "new" ? "New Award" : "Edit Award" : awards.find((award) => award.id === selectedId)?.title || "Award Details"} onBack={() => { setEditing(null); close(); }} /> : <TopBar title="End of Season Awards" href={admin ? "/admin" : "/"} />}
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-5">
        {loading && <p className="wp-text" role="status">Loading awards...</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
        {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">{message}</p>}
        {login && <form onSubmit={signIn} className={`${panel} space-y-3`}>
          <label className="block text-sm font-semibold">Coach password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className={field} /></label>
          <button className={command} disabled={saving}>Open Awards</button>
        </form>}
        {!loading && !data && !login && <button className={`${secondary} bg-white dark:bg-[#1c1c1e]`} onClick={() => window.location.reload()}>Retry</button>}
        {data && <>
          {!selectedId && !editing && <div className={`${admin ? "" : panel} flex flex-wrap items-end gap-3`}>
            <label className="min-w-0 flex-1 text-sm font-semibold">Team<select className={field} value={team} onChange={(event) => { setTeam(event.target.value); setEditing(null); }} disabled={saving}>
              {data.teams.map((option) => <option key={option.slug} value={option.slug}>{option.name}</option>)}
            </select></label>
            <label className="min-w-0 flex-1 text-sm font-semibold">Season<select className={field} value={season} onChange={(event) => { setSeason(event.target.value); setEditing(null); }} disabled={saving}>
              {seasons.map((option) => <option key={option} value={option}>{option}</option>)}
            </select></label>
          </div>}
          {admin && !selectedId && !editing && <ToolTabs label="Award views" tabs={[{ id: "awards", label: "Awards" }, { id: "results", label: "Results" }, { id: "visibility", label: "Visibility" }]} value={view} onChange={switchTo} />}
          {admin && view === "visibility" && season === data.season && <div className={panel}>
            <label className="flex min-h-11 items-center gap-3 font-semibold"><input type="checkbox" className="h-5 w-5 shrink-0 accent-green-700" checked={data.activeTeams.includes(team)} disabled={saving || !team} onChange={(event) => void mutate({ action: "activate", team, active: event.target.checked }, event.target.checked ? "Awards activated for parents." : "Awards hidden from parents.")} />Activate awards for parents</label>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{data.activeTeams.includes(team) ? "Visible to parents" : "Hidden from parents"}</p>
          </div>}
          {admin && view === "visibility" && season !== data.season && <p className="wp-text py-6 text-center text-sm">Past-season voting is closed.</p>}
          {admin && view === "awards" && !selectedId && !editing && season === data.season && <button className={`${command} self-start`} disabled={saving || !team} onClick={() => { setEditing("new"); open("new"); }}>Add Award</button>}
          {admin && editing && <AwardEditor key={editing === "new" ? `new-${team}` : editing.id} award={editing === "new" ? null : editing} team={team} allowOpen={season === data.season} saving={saving} onCancel={() => { setEditing(null); close(); }} onSave={async (award) => { if (await mutate({ action: "save", award }, "Award saved.")) { setEditing(null); close(); } }} />}
          {!editing && (!admin || view !== "visibility") && awards.length === 0 && <p className="wp-text py-4 text-center text-sm">{admin ? "No awards for this team and season." : "No awards are available for your team yet."}</p>}
          {!editing && (!admin || view !== "visibility") && awards.filter((award) => !selectedId || award.id === selectedId).map((award) => admin && !selectedId ? <button key={award.id} onClick={() => open(`${view === "results" ? "result" : "award"}-${award.id}`)} className={`${panel} flex min-h-20 w-full items-center gap-3 text-left`}><span className="shrink-0 text-amber-700 dark:text-amber-400">{ICONS.crest}</span><span className="min-w-0 flex-1"><span className="block break-words font-semibold">{award.title}</span><span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{status(award, data.season)}</span></span><span aria-hidden="true" className="text-gray-400">›</span></button> : admin ? <section key={award.id} className={`${panel} space-y-4`} aria-label={award.title}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h2 className="break-words text-lg font-bold">{award.title}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{status(award, data.season)}</p></div>
              {view !== "results" && <button className={secondary} title={`Edit ${award.title}`} disabled={saving} onClick={() => { setEditing({ ...award, open: award.open && award.season === data.season }); open("edit"); }}>Edit</button>}
            </div>
            {award.description && <p className="whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-gray-300">{award.description}</p>}
            {votersOf(award) === "coaches" && <p className="text-sm text-gray-500 dark:text-gray-400">The coaches choose the winner, so it isn&apos;t on the parents&apos; ballot.</p>}
            {view !== "results" && <div className="flex flex-wrap items-center gap-3">
              {votersOf(award) !== "coaches" && <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-green-700" checked={award.open && award.season === data.season} disabled={saving || award.season !== data.season} onChange={(event) => void mutate({ action: "save", award: { ...award, open: event.target.checked } }, event.target.checked ? "Voting opened." : "Voting closed.")} />Voting open</label>}
              <button className={`${secondary} ml-auto text-red-700 dark:text-red-400`} title={`Delete ${award.title}`} aria-label={`Delete ${award.title}`} disabled={saving} onClick={async () => { if (window.confirm(`Delete "${award.title}" and all its ballots? This cannot be undone.`) && await mutate({ action: "delete", id: award.id }, "Award deleted.")) close(); }}>{ICONS.bin}</button>
            </div>}
            {view === "results" && votersOf(award) !== "coaches" && <AwardResults award={award} />}
          </section> : (award.slots ?? []).map((slot) => <AwardVote key={`${award.id}-${slot.forPlayer?.id ?? "me"}`} award={award} slot={slot} saving={saving} onSave={(choices) => mutate({ id: award.id, choices, ...(slot.forPlayer ? { forPlayer: slot.forPlayer.id } : {}) }, slot.forPlayer ? `${first(slot.forPlayer.name)}'s ballot has been saved.` : "Your ballot has been saved.")} />))}
        </>}
      </main>
    </div>
  );
}

/** The line under an award's name for coaches: who votes, and how voting's going. */
function status(award: SeasonAwardView, season: string) {
  const voters = votersOf(award);
  if (voters === "coaches") return "Coaches decide";
  return `${voters === "players" ? "Players vote" : "Parents vote"} · ${award.open && award.season === season ? "Voting open" : "Voting closed"} · ${award.ballotCount ?? 0} ballots`;
}

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

function AwardEditor({ award, team, allowOpen, saving, onSave, onCancel }: {
  award: SeasonAwardView | null; team: string; allowOpen: boolean; saving: boolean;
  onSave: (award: Partial<SeasonAward>) => Promise<void>; onCancel: () => void;
}) {
  const [title, setTitle] = useState(award?.title ?? "");
  const [description, setDescription] = useState(award?.description ?? "");
  const [open, setOpen] = useState(award?.open ?? false);
  const [voters, setVoters] = useState<AwardVoters>(award ? votersOf(award) : "parents");
  // ballots already cast were cast as one kind of voter
  const locked = !!award?.ballotCount;
  return <form className={`${panel} space-y-3`} onSubmit={(event) => { event.preventDefault(); void onSave({ ...(award ? { id: award.id } : {}), team, title, description, open: voters !== "coaches" && open, voters }); }}>
    <h2 className="text-lg font-bold">{award ? "Edit Award" : "New Award"}</h2>
    <label className="block text-sm font-semibold">Award name<input className={field} required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} disabled={saving} /></label>
    <label className="block text-sm font-semibold">Description<textarea className={field} rows={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} disabled={saving} /></label>
    <label className="block text-sm font-semibold">Who votes<select className={field} value={voters} onChange={(event) => setVoters(event.target.value as AwardVoters)} disabled={saving || locked}>
      {AWARD_VOTERS.map((option) => <option key={option} value={option}>{VOTERS_LABEL[option]}</option>)}
    </select></label>
    <p className="-mt-1 text-sm text-gray-500 dark:text-gray-400">{locked
      ? "Ballots are in, so this can't change now."
      : voters === "players"
        ? "Each player gets one ballot, filled in by their parent. They can't vote for themselves."
        : voters === "parents"
          ? "Each parent gets one ballot of their own."
          : "Not on the parents' ballot — the coaches choose the winner."}</p>
    {voters !== "coaches" && <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-green-700" checked={open} onChange={(event) => setOpen(event.target.checked)} disabled={saving || !allowOpen} />Voting open</label>}
    <div className="flex gap-3"><button className={command} disabled={saving || !title.trim()}>{ICONS.doc}{saving ? "Saving..." : "Save Award"}</button><button type="button" className={secondary} disabled={saving} onClick={onCancel}>Cancel</button></div>
  </form>;
}

function AwardVote({ award, slot, saving, onSave }: { award: SeasonAwardView; slot: AwardSlot; saving: boolean; onSave: (choices: string[]) => Promise<boolean> }) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const ballot = slot.ballot;
  const choices = draft ?? ballot?.choices ?? [];
  const changed = JSON.stringify(choices) !== JSON.stringify(ballot?.choices ?? []);
  // a players' award: this child's vote, cast by their parent, and not for themselves
  const child = slot.forPlayer ? first(slot.forPlayer.name) : "";
  const nominees = nomineesFor(award, slot.forPlayer?.id);
  const saved = ballot ? `Ballot submitted${child && ballot.by ? ` by ${ballot.by}` : ""} on ${new Date(ballot.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "";
  const labels = ["1st choice", "2nd choice (optional)", "3rd choice (optional)"];
  return <form className={`${panel} space-y-4`} onSubmit={async (event) => { event.preventDefault(); if (await onSave(choices)) setDraft(null); }}>
    <div><h2 className="break-words text-lg font-bold">{award.title}{child && <span className="font-semibold text-gray-500 dark:text-gray-400"> · {child}&apos;s vote</span>}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{award.open ? (saved || "Voting open") : "Voting closed"}</p></div>
    {child && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">Vote for {child}: who would {child} pick? Ask them, and fill it in for them. {child} gets one vote, so if another parent has voted for {child} already, saving replaces it.</p>}
    {award.description && <p className="whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-gray-300">{award.description}</p>}
    {labels.slice(0, Math.min(3, nominees.length)).map((label, index) => <label key={label} className="block text-sm font-semibold">{label}
      <select className={field} value={choices[index] ?? ""} disabled={saving || !award.open || (index > 0 && !choices[index - 1])} required={index === 0} onChange={(event) => { const next = choices.slice(0, index); if (event.target.value) next.push(event.target.value); setDraft(next); }}>
        <option value="">{index === 0 ? "Choose a player" : "No choice"}</option>
        {nominees.map((player) => <option key={player.id} value={player.id} disabled={choices.some((choice, position) => position !== index && choice === player.id)}>{player.name}</option>)}
      </select>
    </label>)}
    {award.open && <button className={command} disabled={saving || !choices.length || !changed}>{ICONS.doc}{saving ? "Saving..." : ballot ? "Update Ballot" : child ? `Submit ${child}'s Ballot` : "Submit Ballot"}</button>}
  </form>;
}

function AwardResults({ award }: { award: SeasonAwardView }) {
  if (!award.standings?.length) return <p className="text-sm text-gray-500 dark:text-gray-400">No ballots submitted.</p>;
  return <div className="overflow-x-auto">
    <table className="w-full text-left text-sm tabular-nums">
      <caption className="pb-3 text-left text-sm font-semibold">Results · Share of weighted points (%)</caption>
      <thead><tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400"><th scope="col" className="py-2 pr-2">Rank / Player</th><th scope="col" className="p-2 text-right">1st</th><th scope="col" className="p-2 text-right">2nd</th><th scope="col" className="p-2 text-right">3rd</th><th scope="col" className="p-2 text-right">Points</th><th scope="col" className="py-2 pl-2 text-right">%</th></tr></thead>
      <tbody>{award.standings.map((standing) => <tr key={standing.playerId} className="border-b border-gray-100 last:border-0 dark:border-white/10">
        <th scope="row" className="min-w-24 py-3 pr-2 font-medium"><span className="mr-2 text-gray-500 dark:text-gray-400">{standing.rank}.</span>{award.nominees.find((player) => player.id === standing.playerId)?.name ?? "Former player"}</th>
        <td className="p-2 text-right">{standing.first}</td><td className="p-2 text-right">{standing.second}</td><td className="p-2 text-right">{standing.third}</td><td className="p-2 text-right font-bold">{standing.points}</td><td className="py-3 pl-2 text-right font-bold">{standing.percentage.toFixed(1)}%</td>
      </tr>)}</tbody>
    </table>
  </div>;
}