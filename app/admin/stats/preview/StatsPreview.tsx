"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ICONS, TopBar, useScreens } from "../../../components/SettingsUI";

type Player = { id: string; name: string; position: string; appearances: number; goals: number; assists: number; awards: number };
type Award = { id: string; title: string; open: boolean; ballots: number };
const INITIAL_PLAYERS: Player[] = [
  { id: "alex", name: "Alex M.", position: "Midfielder", appearances: 12, goals: 8, assists: 6, awards: 3 },
  { id: "blake", name: "Blake T.", position: "Forward", appearances: 11, goals: 12, assists: 3, awards: 2 },
  { id: "casey", name: "Casey J.", position: "Defender", appearances: 12, goals: 2, assists: 4, awards: 4 },
  { id: "drew", name: "Drew P.", position: "Goalkeeper", appearances: 10, goals: 0, assists: 1, awards: 2 },
  { id: "ellis", name: "Ellis R.", position: "Midfielder", appearances: 9, goals: 4, assists: 5, awards: 1 },
  { id: "frankie", name: "Frankie S.", position: "Defender", appearances: 11, goals: 1, assists: 2, awards: 1 },
  { id: "george", name: "George W.", position: "Forward", appearances: 8, goals: 6, assists: 2, awards: 2 },
];
const INITIAL_AWARDS: Award[] = [
  { id: "parents", title: "Parents' Player of the Season", open: true, ballots: 14 },
  { id: "improved", title: "Most Improved", open: true, ballots: 12 },
  { id: "spirit", title: "Team Spirit", open: false, ballots: 16 },
];
const TEAMS = [{ id: "lions", name: "Lions U10", opponent: "Riverside Juniors", recent: ["W", "W", "D", "L", "W"] }, { id: "tigers", name: "Tigers U11", opponent: "Parkside United", recent: ["W", "L", "W", "D", "W"] }];
const field = "min-h-11 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#1c1c1e]";
const muted = "text-gray-500 dark:text-gray-400";
const surface = "rounded-lg bg-white shadow-sm dark:bg-[#1c1c1e]";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40";
const tabs = ["Team", "Players", "Awards"] as const;

function Chevron() { return <span aria-hidden="true" className="shrink-0 text-xl text-gray-400">›</span>; }

export default function StatsPreview() {
  const { screen, open, close } = useScreens("/admin/stats/preview");
  const [teamId, setTeamId] = useState("lions");
  const [season, setSeason] = useState("2026/27");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");
  const [rosters, setRosters] = useState<Record<string, Player[]>>({});
  const [awardSets, setAwardSets] = useState<Record<string, Award[]>>({});
  const [activeSets, setActiveSets] = useState<Record<string, boolean>>({});
  const [recorded, setRecorded] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState("");
  const context = `${teamId}:${season}`;
  const team = TEAMS.find((option) => option.id === teamId)!;
  const squad = rosters[context] ?? INITIAL_PLAYERS.map((player, index) => ({ ...player, goals: Math.max(0, player.goals - (teamId === "tigers" ? index % 3 : 0)), appearances: season === "2025/26" ? 18 : player.appearances }));
  const topScorer = squad.reduce((best, entry) => entry.goals > best.goals ? entry : best, squad[0]);
  const awards = awardSets[context] ?? INITIAL_AWARDS;
  const active = activeSets[context] ?? false;
  const player = screen.startsWith("player-") ? squad.find((entry) => entry.id === screen.slice(7)) : null;
  const award = screen.startsWith("award-") ? awards.find((entry) => entry.id === screen.slice(6)) : null;
  const detail = !!player || !!award || screen === "match" || screen === "season";
  const selectedTab = player ? "Players" : award ? "Awards" : screen === "players" ? "Players" : screen === "awards" ? "Awards" : "Team";
  const heading = player?.name ?? award?.title ?? (screen === "match" ? "Match Details" : screen === "season" ? "Season Management" : "Stats Tracker");
  const listed = squad.filter((entry) => `${entry.name} ${entry.position}`.toLowerCase().includes(query.toLowerCase())).sort((first, second) => sort === "goals" ? second.goals - first.goals : sort === "appearances" ? second.appearances - first.appearances : first.name.localeCompare(second.name));

  function changeContext(nextTeam: string, nextSeason: string) {
    setTeamId(nextTeam); setSeason(nextSeason); setQuery(""); setNotice("");
  }
  function returnToList() { setNotice(""); close(); }
  function updateAward(next: Award) {
    setAwardSets({ ...awardSets, [context]: awards.map((entry) => entry.id === next.id ? next : entry) });
  }

  return <div className="themed min-h-screen bg-[#f2f2f7] text-gray-900 dark:bg-black dark:text-gray-50">
    <TopBar title={heading} {...(detail ? { onBack: returnToList } : { href: "/admin" })} />
    <main className="mx-auto max-w-2xl px-4 pb-12 pt-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200"><span className="h-2 w-2 rounded-full bg-amber-500" />Preview · Sample data</span>
        <Link href="/admin/stats" className="text-xs font-semibold text-green-700 underline underline-offset-4 dark:text-green-400">Current tracker</Link>
      </div>
      {!detail && <>
        <div className="mb-4 flex items-center gap-3">
          <Image src="/club-crest.png" alt="Club crest" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
          <label className="min-w-0 flex-1"><span className="sr-only">Team</span><select value={teamId} onChange={(event) => changeContext(event.target.value, season)} className={field}>{TEAMS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
          <label className="w-28 shrink-0"><span className="sr-only">Season</span><select value={season} onChange={(event) => changeContext(teamId, event.target.value)} className={field}><option>2026/27</option><option>2025/26</option></select></label>
        </div>
        <div role="tablist" aria-label="Stats views" className="mb-6 grid grid-cols-3 border-b border-gray-200 dark:border-white/15">
          {tabs.map((tab) => <button key={tab} type="button" role="tab" id={`preview-tab-${tab}`} aria-controls="preview-panel" aria-selected={selectedTab === tab} tabIndex={selectedTab === tab ? 0 : -1} onClick={() => { open(tab.toLowerCase()); setNotice(""); }} onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const current = tabs.indexOf(tab);
            const index = event.key === "Home" ? 0 : event.key === "End" ? 2 : (current + (event.key === "ArrowRight" ? 1 : -1) + 3) % 3;
            open(tabs[index].toLowerCase()); document.getElementById(`preview-tab-${tabs[index]}`)?.focus();
          }} className={`min-h-12 border-b-2 text-sm font-semibold ${selectedTab === tab ? "border-green-700 text-green-700 dark:border-green-400 dark:text-green-400" : `border-transparent ${muted}`}`}>{tab}</button>)}
        </div>
      </>}
      {notice && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-400/10 dark:text-green-200">{notice}</p>}
      {player ? <PlayerDetails key={`${context}:${player.id}`} player={player} onSave={(next) => { setRosters({ ...rosters, [context]: squad.map((entry) => entry.id === next.id ? next : entry) }); setNotice("Saved in preview."); }} />
        : award ? <section>
          <div className="mb-6 flex items-center justify-between gap-3"><p className={`text-sm ${muted}`}>{award.ballots} parent ballots</p><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-green-700" checked={award.open} onChange={(event) => updateAward({ ...award, open: event.target.checked })} />Voting open</label></div>
          <h2 className="mb-3 text-lg font-bold">Results</h2>
          <div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{[...squad].sort((first, second) => second.awards - first.awards).slice(0, 3).map((entry, index) => <div key={entry.id} className="flex items-center gap-3 p-4"><span className={`w-5 text-sm ${muted}`}>{index + 1}</span><span className="flex-1 text-sm font-semibold">{entry.name}</span><span className="text-right text-sm font-bold tabular-nums">{[46.7, 33.3, 20][index]}%<span className={`block text-xs font-normal ${muted}`}>{[28, 20, 12][index]} points</span></span></div>)}</div>
        </section>
          : screen === "match" ? <section className="space-y-5">
            <div className="border-b border-gray-200 pb-5 dark:border-white/15"><p className={`text-xs font-semibold uppercase ${muted}`}>Saturday 17 October · 10:00</p><h2 className="mt-2 text-xl font-bold">{team.name} v {team.opponent}</h2><p className={`mt-1 text-sm ${muted}`}>Home · Meadow Lane</p></div>
            <dl className="grid grid-cols-2 gap-4"><div><dt className={`text-xs ${muted}`}>Competition</dt><dd className="mt-1 text-sm font-semibold">Junior League</dd></div><div><dt className={`text-xs ${muted}`}>Squad</dt><dd className="mt-1 text-sm font-semibold">{squad.length} players available</dd></div></dl>
            <button className={button} onClick={() => { setRecorded({ ...recorded, [context]: true }); setNotice("Match marked ready in preview."); }}>{ICONS.doc}{recorded[context] ? "Match Ready" : "Mark Match Ready"}</button>
          </section>
            : screen === "season" ? <section>
              <p className={`mb-5 text-sm ${muted}`}>{team.name} · {season}</p>
              <div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{[{ label: "Export player stats", icon: ICONS.share, action: () => {
                const csv = ["Player,Appearances,Goals,Assists", ...squad.map((entry) => `${entry.name},${entry.appearances},${entry.goals},${entry.assists}`)].join("\n");
                const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `sample-${teamId}-stats.csv`; anchor.click(); URL.revokeObjectURL(url); setNotice("Sample stats exported.");
              } }, { label: "Season summary", icon: ICONS.doc, action: () => setNotice(`${team.name}: 12 matches, 8 wins, 2 draws, 2 losses. Sample season only.`) }].map((item) => <button key={item.label} className="flex min-h-16 w-full items-center gap-3 px-4 text-left text-sm font-semibold" onClick={item.action}><span className="text-green-700 dark:text-green-400">{item.icon}</span><span className="flex-1">{item.label}</span><Chevron /></button>)}</div>
            </section>
              : <div id="preview-panel" role="tabpanel" aria-labelledby={`preview-tab-${selectedTab}`}>
                {selectedTab === "Team" && <>
                  <div className="mb-6 flex items-end justify-between"><div><p className={`text-xs font-semibold uppercase ${muted}`}>Season overview</p><h2 className="mt-1 text-2xl font-bold">{team.name}</h2></div><span className={`text-sm ${muted}`}>{squad.length} players</span></div>
                  <dl className="mb-6 grid grid-cols-4 gap-2 border-y border-gray-200 py-4 dark:border-white/15">{[{ label: "Played", value: 12 }, { label: "Won", value: teamId === "lions" ? 8 : 7 }, { label: "Drawn", value: teamId === "lions" ? 2 : 3 }, { label: "Lost", value: 2 }].map((stat) => <div key={stat.label}><dt className={`text-xs ${muted}`}>{stat.label}</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</dd></div>)}</dl>
                  <div className="mb-6 flex items-center justify-between"><h3 className="text-sm font-semibold">Recent form</h3><div className="flex gap-1.5">{team.recent.map((result, index) => <span key={index} aria-label={result === "W" ? "Win" : result === "D" ? "Draw" : "Loss"} className={`grid h-8 w-8 place-items-center rounded-md text-xs font-bold ${result === "W" ? "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-300" : result === "D" ? "bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-300" : "bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-300"}`}>{result}</span>)}</div></div>
                  <h3 className="mb-2 text-sm font-semibold">Next match</h3>
                  <button onClick={() => open("match")} className={`${surface} mb-6 flex w-full items-center gap-3 p-4 text-left`}><span className="text-green-700 dark:text-green-400">{ICONS.doc}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">v {team.opponent}</span><span className={`mt-1 block text-xs ${muted}`}>Sat 17 Oct · 10:00 · Home</span></span><Chevron /></button>
                  <h3 className="mb-2 text-sm font-semibold">At a glance</h3>
                  <div className="grid grid-cols-2 gap-x-4 border-y border-gray-200 py-4 dark:border-white/15"><div><p className={`text-xs ${muted}`}>Goals scored</p><p className="mt-1 text-xl font-bold">{squad.reduce((sum, entry) => sum + entry.goals, 0)}</p></div><div><p className={`text-xs ${muted}`}>Top scorer</p><button onClick={() => open(`player-${topScorer.id}`)} className="mt-1 text-sm font-semibold text-green-700 underline underline-offset-4 dark:text-green-400">{topScorer.name}</button></div></div>
                  <button onClick={() => open("season")} className={`mt-5 flex min-h-11 w-full items-center justify-between text-sm font-semibold ${muted}`}>Season management<Chevron /></button>
                </>}
                {selectedTab === "Players" && <>
                  <div className="mb-4 flex gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Search players</span><input type="search" placeholder="Search players" value={query} onChange={(event) => setQuery(event.target.value)} className={field} /></label><label className="w-32"><span className="sr-only">Sort players</span><select value={sort} onChange={(event) => setSort(event.target.value)} className={field}><option value="name">Name</option><option value="goals">Goals</option><option value="appearances">Appearances</option></select></label></div>
                  <div className={`mb-2 flex justify-between px-4 text-xs ${muted}`}><span>{listed.length} player{listed.length === 1 ? "" : "s"}</span><span>Goals / Assists</span></div>
                  <div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{listed.map((entry) => <button key={entry.id} onClick={() => { setNotice(""); open(`player-${entry.id}`); }} className="flex min-h-19 w-full items-center gap-3 px-4 py-3 text-left"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green-50 text-sm font-bold text-green-800 dark:bg-green-400/10 dark:text-green-300">{entry.name.slice(0, 1)}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{entry.name}</span><span className={`block text-xs ${muted}`}>{entry.position}</span></span><span className="shrink-0 text-sm font-semibold tabular-nums">{entry.goals} <span className={`mx-1 font-normal ${muted}`}>/</span> {entry.assists}</span><Chevron /></button>)}</div>
                  {listed.length === 0 && <p role="status" className={`py-8 text-center text-sm ${muted}`}>No players found.</p>}
                </>}
                {selectedTab === "Awards" && <>
                  <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Season awards</h2><p className={`mt-1 text-xs ${muted}`}>{active ? "Visible to parents" : "Hidden from parents"}</p></div><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" aria-label="Activate awards for parents" checked={active} onChange={(event) => setActiveSets({ ...activeSets, [context]: event.target.checked })} className="h-5 w-5 accent-green-700" />Active</label></div>
                  <div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{awards.map((entry) => <button key={entry.id} onClick={() => open(`award-${entry.id}`)} className="flex min-h-20 w-full items-center gap-3 p-4 text-left"><span className="shrink-0 text-amber-700 dark:text-amber-400">{ICONS.crest}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{entry.title}</span><span className={`mt-1 block text-xs ${muted}`}>{entry.open ? "Voting open" : "Voting closed"} · {entry.ballots} ballots</span></span><Chevron /></button>)}</div>
                </>}
              </div>}
    </main>
  </div>;
}

function PlayerDetails({ player, onSave }: { player: Player; onSave: (player: Player) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(player);
  return <section>
    <div className="mb-6 flex items-center gap-4"><span className="grid h-16 w-16 place-items-center rounded-full bg-green-100 text-xl font-bold text-green-800 dark:bg-green-400/10 dark:text-green-300">{player.name.slice(0, 1)}</span><div><h2 className="text-2xl font-bold">{player.name}</h2><p className={`mt-1 text-sm ${muted}`}>{player.position}</p></div></div>
    <dl className="mb-6 grid grid-cols-2 gap-5 border-y border-gray-200 py-5 dark:border-white/15">{[{ label: "Appearances", value: player.appearances }, { label: "Goals", value: player.goals }, { label: "Assists", value: player.assists }, { label: "Awards", value: player.awards }].map((stat) => <div key={stat.label}><dt className={`text-xs ${muted}`}>{stat.label}</dt><dd className="mt-1 text-3xl font-bold tabular-nums">{stat.value}</dd></div>)}</dl>
    {editing ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave(draft); setEditing(false); }}>
      <h3 className="text-sm font-semibold">Correct season totals</h3>
      <div className="grid grid-cols-2 gap-3">{(["appearances", "goals", "assists", "awards"] as const).map((key) => <label key={key} className="text-xs font-semibold capitalize">{key}<input type="number" required min={0} max={999} step={1} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })} className={`${field} mt-1`} /></label>)}</div>
      <div className="flex gap-3"><button className={button}>{ICONS.doc}Save Changes</button><button type="button" className={`min-h-11 px-3 text-sm font-semibold ${muted}`} onClick={() => setEditing(false)}>Cancel</button></div>
    </form> : <button className={button} onClick={() => { setDraft(player); setEditing(true); }}>{ICONS.doc}Correct Stats</button>}
  </section>;
}