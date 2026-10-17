"use client";

import Image from "next/image";
import { useState } from "react";
import { ICONS, ToolTabs, useScreens } from "../../components/SettingsUI";
import { command, muted, PreviewFrame, PreviewRow, surface } from "../PreviewUI";

const LESSONS = [
  { id: "passing", title: "Pass and move", category: "Passing", minutes: 4, steps: ["Look up before the ball reaches you.", "Open your body so you can see your next pass.", "Pass to your teammate's back foot.", "Move into a new space after your pass."] },
  { id: "defending", title: "Defend together", category: "Defending", minutes: 3, steps: ["The nearest player slows the attacker down.", "A teammate covers the space behind.", "Stay close enough to help each other.", "Win the ball, then look for a safe pass."] },
  { id: "positions", title: "Find your space", category: "Positions", minutes: 5, steps: ["Spread out when your team has the ball.", "Stay close enough to offer a passing option.", "Check where your teammates are before you move.", "Recover towards your own goal when the ball is lost."] },
];
const CHALLENGES = ["20 passes with each foot", "Dribble through five gates", "10 controlled first touches"];
const QUESTIONS = [
  { question: "What should you do after making a pass?", answers: ["Stand and watch", "Move into a new space", "Follow the ball everywhere"], correct: 1, explanation: "Moving creates another passing option for your teammate." },
  { question: "Your teammate moves towards an attacker. How can you help?", answers: ["Cover the space behind them", "Stand beside the attacker", "Stay by the other goal"], correct: 0, explanation: "Cover gives your team a second chance if the first defender is beaten." },
  { question: "Before you receive the ball, what helps most?", answers: ["Looking only at the ball", "Standing still", "Checking over your shoulder"], correct: 2, explanation: "A quick look helps you spot space, opponents and your next pass." },
];

function Pitch({ phase }: { phase: string }) {
  const attackers = phase === "attack";
  return <svg viewBox="0 0 360 220" role="img" aria-label={attackers ? "Players spreading out to support an attack" : "Players offering passing options while building from defence"} className="block w-full rounded-lg">
    <rect width="360" height="220" fill="#237848" /><path d="M0 44h360M0 132h360" stroke="#2a8551" strokeWidth="44" />
    <g fill="none" stroke="#e0f2e6" strokeWidth="1.5" opacity=".7"><rect x="12" y="12" width="336" height="196" rx="2" /><path d="M180 12v196M12 65h48v90H12m336-90h-48v90h48" /><circle cx="180" cy="110" r="30" /></g>
    <g fill="#fff" stroke="#155c38" strokeWidth="3"><circle cx="40" cy="110" r="12" /><circle cx={attackers ? 130 : 100} cy="65" r="12" /><circle cx={attackers ? 130 : 100} cy="155" r="12" /><circle cx={attackers ? 245 : 190} cy="45" r="12" /><circle cx={attackers ? 245 : 190} cy="175" r="12" /><circle cx={attackers ? 305 : 270} cy="110" r="12" /></g>
    <path d={attackers ? "M142 65Q195 30 230 45" : "M52 110Q85 75 86 70"} fill="none" stroke="#facc15" strokeWidth="3" strokeDasharray="6 5" />
    <circle cx={attackers ? 130 : 40} cy={attackers ? 65 : 110} r="6" fill="#facc15" stroke="#fff" strokeWidth="2" />
  </svg>;
}

export default function TrainingPreview() {
  const { screen, open, close } = useScreens("/preview/training");
  const view = screen === "practice" || screen === "progress" ? screen : "learn";
  const lesson = LESSONS.find((entry) => screen === `lesson-${entry.id}`);
  const [completed, setCompleted] = useState<string[]>([]);
  const [challenges, setChallenges] = useState([true, false, false]);
  const [phase, setPhase] = useState("build");
  const [question, setQuestion] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [best, setBest] = useState(2);
  const quiz = screen === "quiz";
  const current = QUESTIONS[question];
  const challengeCount = challenges.filter(Boolean).length;

  function startQuiz() { setQuestion(0); setAnswer(null); setScore(0); setFinished(false); open("quiz"); }
  function nextQuestion() {
    if (question === QUESTIONS.length - 1) { setFinished(true); setBest(Math.max(best, score)); }
    else { setQuestion(question + 1); setAnswer(null); }
  }

  return <PreviewFrame title={lesson?.title ?? (quiz ? "How We Play Quiz" : "Training Hub")} area="training" onBack={lesson || quiz ? close : undefined}>
    {lesson ? <section className="space-y-5">
      <p className={`text-sm ${muted}`}>{lesson.category} · {lesson.minutes} min · Lions U10</p>
      <Pitch phase={phase} />
      <div role="group" aria-label="Phase of play" className="grid grid-cols-2 gap-2">{[{ id: "build", title: "Build-up" }, { id: "attack", title: "Attack" }].map((option) => <button key={option.id} aria-pressed={phase === option.id} onClick={() => setPhase(option.id)} className={`min-h-11 rounded-lg border text-sm font-semibold ${phase === option.id ? "border-green-700 bg-green-50 text-green-800 dark:bg-green-400/10 dark:text-green-300" : "border-gray-200 dark:border-white/15"}`}>{option.title}</button>)}</div>
      <ol className="space-y-4">{lesson.steps.map((step, index) => <li key={step} className="flex items-start gap-3 text-sm leading-relaxed"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green-100 text-xs font-bold text-green-800 dark:bg-green-400/15 dark:text-green-300">{index + 1}</span>{step}</li>)}</ol>
      <button className={command} onClick={() => setCompleted(completed.includes(lesson.id) ? completed.filter((id) => id !== lesson.id) : [...completed, lesson.id])}>{ICONS.doc}{completed.includes(lesson.id) ? "Lesson Complete" : "Mark Lesson Complete"}</button>
    </section> : quiz ? finished ? <section className="py-6 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">{ICONS.crest}</span>
      <h2 className="mt-4 text-2xl font-bold">Quiz complete</h2><p className="mt-3 text-4xl font-bold tabular-nums">{score}<span className={`text-xl font-normal ${muted}`}> / {QUESTIONS.length}</span></p>
      <p className={`mt-2 text-sm ${muted}`}>Personal best: {best} / {QUESTIONS.length}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3"><button className={command} onClick={startQuiz}>Try Again</button><button className="min-h-11 px-3 text-sm font-semibold" onClick={() => open("progress")}>View Progress</button></div>
    </section> : <section>
      <div className={`mb-4 flex justify-between text-xs font-semibold ${muted}`}><span>How we play</span><span>{question + 1} of {QUESTIONS.length}</span></div>
      <progress value={question + (answer !== null ? 1 : 0)} max={QUESTIONS.length} aria-label="Quiz progress" className="mb-5 h-2 w-full accent-green-700" />
      <h2 className="mb-5 text-xl font-bold leading-snug">{current.question}</h2>
      <div className="space-y-3">{current.answers.map((text, index) => <button key={text} disabled={answer !== null} aria-pressed={answer === index} onClick={() => { setAnswer(index); if (index === current.correct) setScore(score + 1); }} className={`min-h-14 w-full rounded-lg border p-4 text-left text-sm font-semibold ${answer !== null && index === current.correct ? "border-green-600 bg-green-50 text-green-900 dark:bg-green-400/10 dark:text-green-200" : answer === index ? "border-red-400 bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-200" : "border-gray-200 bg-white dark:border-white/15 dark:bg-[#1c1c1e]"}`}>{text}</button>)}</div>
      {answer !== null && <div className="mt-5"><p role="status" className="mb-4 text-sm leading-relaxed">{current.explanation}</p><button className={command} onClick={nextQuestion}>{question === QUESTIONS.length - 1 ? "Finish Quiz" : "Next Question"}</button></div>}
    </section> : <>
      <div className="mb-5 flex items-center gap-3"><Image src="/club-crest.png" alt="Club crest" width={44} height={44} className="h-11 w-11 object-contain" /><div><h1 className="text-xl font-bold">Alex&apos;s training</h1><p className={`text-xs ${muted}`}>Lions U10 · 7v7</p></div></div>
      <ToolTabs label="Training preview views" tabs={[{ id: "learn", label: "Learn" }, { id: "practice", label: "Practice" }, { id: "progress", label: "Progress" }]} value={view} onChange={open} panelId="training-preview-panel" />
      <section id="training-preview-panel" role="tabpanel" aria-label={view}>
        {view === "learn" && <>
          <h2 className="mb-3 text-lg font-bold">How we play</h2>
          <div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{LESSONS.map((entry) => <PreviewRow key={entry.id} title={entry.title} detail={`${entry.category} · ${entry.minutes} min`} icon={ICONS.doc} onClick={() => { setPhase("build"); open(`lesson-${entry.id}`); }}>{completed.includes(entry.id) && <span className="text-xs font-semibold text-green-700 dark:text-green-400">Complete</span>}</PreviewRow>)}</div>
          <div className="mt-6 border-t border-gray-200 pt-4 dark:border-white/15"><p className={`text-xs font-semibold uppercase ${muted}`}>This week&apos;s focus</p><h3 className="mt-2 text-base font-bold">Pass. Move. Make space.</h3><p className={`mt-2 text-sm leading-relaxed ${muted}`}>Offer your teammate another option as soon as the ball leaves your foot.</p></div>
        </>}
        {view === "practice" && <>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Weekly challenges</h2><span className="text-sm font-semibold tabular-nums text-green-700 dark:text-green-400">{challengeCount} / {CHALLENGES.length}</span></div>
          <div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}>{CHALLENGES.map((challenge, index) => <label key={challenge} className="flex min-h-16 cursor-pointer items-center gap-3 p-4 text-sm font-semibold"><input type="checkbox" checked={challenges[index]} onChange={(event) => setChallenges(challenges.map((done, position) => position === index ? event.target.checked : done))} className="h-5 w-5 shrink-0 accent-green-700" />{challenge}</label>)}</div>
          <h2 className="mb-3 mt-6 text-lg font-bold">Test yourself</h2><div className={surface}><PreviewRow title="How We Play Quiz" detail="3 questions · Beginner" icon={ICONS.help} onClick={startQuiz} /></div>
        </>}
        {view === "progress" && <>
          <h2 className="mb-4 text-lg font-bold">Your progress</h2>
          <dl className="grid grid-cols-3 gap-3 border-y border-gray-200 py-5 dark:border-white/15">{[{ label: "Lessons", value: `${completed.length}/${LESSONS.length}` }, { label: "Challenges", value: `${challengeCount}/${CHALLENGES.length}` }, { label: "Quiz best", value: `${best}/${QUESTIONS.length}` }].map((stat) => <div key={stat.label}><dt className={`text-xs ${muted}`}>{stat.label}</dt><dd className="mt-2 text-2xl font-bold tabular-nums">{stat.value}</dd></div>)}</dl>
          <h3 className="mb-3 mt-6 text-sm font-semibold">Next steps</h3><div className={`${surface} divide-y divide-gray-100 dark:divide-white/10`}><PreviewRow title="Continue learning" detail={`${LESSONS.length - completed.length} lessons remaining`} icon={ICONS.doc} onClick={() => open("learn")} /><PreviewRow title="Weekly challenges" detail={`${CHALLENGES.length - challengeCount} remaining this week`} icon={ICONS.crest} onClick={() => open("practice")} /></div>
        </>}
      </section>
    </>}
  </PreviewFrame>;
}