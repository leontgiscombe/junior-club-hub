"use client";

// Coach Admin → Settings: reset a team's Financial Admin password. Each team's
// records are encrypted with its own password, so a reset is done here in the
// browser (lib/financeCrypto.ts):
//   - with the team's recovery code, the records are kept;
//   - without it, they can't be opened by anyone, so they're deleted and the
//     team starts again with a new recovery code.
import { useState } from "react";
import type { Team } from "@/lib/clubSettings";
import { newFinanceAuth, openWithRecoveryCode, type FinanceAuth } from "@/lib/financeCrypto";

export default function FinancePasswords({ adminKey, teams }: { adminKey: string; teams: Team[] }) {
  const [team, setTeam] = useState("");
  const [code, setCode] = useState("");
  const [noCode, setNoCode] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);

  const teamName = teams.find((t) => t.slug === team)?.name ?? "the team";

  async function reset() {
    setMessage(null);
    setNewCode(null);
    if (!team) return setMessage({ ok: false, text: "Choose the team first." });
    if (password.length < 8) return setMessage({ ok: false, text: "The new password needs at least 8 characters." });
    if (password !== password2) return setMessage({ ok: false, text: "The two passwords don't match." });
    if (!noCode && !code.trim()) {
      return setMessage({ ok: false, text: "Enter the team's recovery code, or tick the box if you don't have it." });
    }
    if (noCode && !confirm(`This permanently deletes ${teamName}'s Financial Admin records (players, payments and spending) and starts the team again. Carry on?`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/finance/team?id=${encodeURIComponent(team)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Couldn't load the team — check you're online");
      const current = ((await res.json()) as { auth: FinanceAuth | null }).auth;

      let built: Awaited<ReturnType<typeof newFinanceAuth>>;
      if (noCode || !current) {
        built = await newFinanceAuth(password);
      } else {
        if (!current.wrapRec) {
          throw new Error(
            `${teamName} doesn't have a recovery code yet (it's made the next time someone unlocks it). Without one, tick the box to start the team again.`,
          );
        }
        const dataKey = await openWithRecoveryCode(current, code);
        if (!dataKey) throw new Error("That recovery code isn't right for this team.");
        built = await newFinanceAuth(password, { dataKey, auth: current });
      }

      const saved = await fetch(`/api/finance/reset?id=${encodeURIComponent(team)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ auth: built.auth, keep: !(noCode || !current) }),
      });
      const data = await saved.json().catch(() => ({}));
      if (!saved.ok) throw new Error(data.error ?? "That didn't work");

      setMessage({
        ok: true,
        text: built.recoveryCode
          ? `${teamName} has a new password and starts again with no records. Share the password with whoever looks after its subs.`
          : `${teamName}'s password is reset and all its records are kept. Share the new password with whoever looks after its subs.`,
      });
      if (built.recoveryCode) setNewCode(built.recoveryCode);
      setCode("");
      setPassword("");
      setPassword2("");
      setNoCode(false);
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "That didn't work" });
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400";
  return (
    <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="font-extrabold text-gray-900">💷 Financial Admin Passwords</h2>
      <p className="mt-1 text-sm text-gray-500">
        Forgotten a team&apos;s Financial Admin password? Reset it here with the team&apos;s recovery
        code and keep all its records. The code was shown when the team was set up, and can be
        remade in Financial Admin → Settings by anyone who knows the password.
      </p>

      <label className="mt-4 block">
        <span className="text-sm font-bold text-gray-800">Team</span>
        <select value={team} onChange={(e) => setTeam(e.target.value)} className={input}>
          <option value="">Choose the team…</option>
          {teams.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block">
        <span className="text-sm font-bold text-gray-800">Recovery code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={noCode}
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className={`${input} font-mono disabled:bg-gray-50 disabled:opacity-50`}
        />
      </label>
      <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={noCode} onChange={(e) => setNoCode(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-red-600" />
        <span>
          I don&apos;t have the recovery code — <strong className="text-red-700">delete this team&apos;s records</strong> and
          start again (you can re-import a backup export afterwards).
        </span>
      </label>

      <label className="mt-3 block">
        <span className="text-sm font-bold text-gray-800">New team password</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters" autoComplete="new-password" className={input} />
        <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="New password again" autoComplete="new-password" className={`${input} mt-2`} />
      </label>

      <button
        onClick={reset}
        disabled={busy || !team || password.length < 8}
        className={`mt-3 cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 ${noCode ? "bg-red-600 hover:bg-red-700" : "bg-gray-900 hover:bg-black"}`}
      >
        {busy ? "Resetting…" : noCode ? "Delete Records & Reset" : "Reset Password"}
      </button>

      {message && (
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      )}
      {newCode && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-bold">The team&apos;s new recovery code — save it somewhere safe now:</p>
          <p className="mt-2 select-all rounded-lg bg-white px-3 py-2 text-center font-mono text-base font-bold tracking-wider">{newCode}</p>
          <p className="mt-2 text-xs">It won&apos;t be shown again. Keep it apart from the password.</p>
        </div>
      )}
    </section>
  );
}
