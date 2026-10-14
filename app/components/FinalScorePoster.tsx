"use client";

import { useEffect, useRef, useState } from "react";
import { toBlob, toPng } from "html-to-image";
import { useClub } from "./ClubProvider";

interface GoalEvent {
  id: string;
  scorerId: string;
  assistId: string;
}

interface Match {
  team: string;
  opponent: string;
  date: string;
  home: boolean;
  goals: GoalEvent[];
  opponentGoals: number;
}

interface Player {
  id: string;
  name: string;
}

const POSTER_W = 1080;
const POSTER_H = 1440;

export default function FinalScorePoster({
  match,
  teamName,
  players,
}: {
  match: Match;
  teamName: string;
  players: Player[];
}) {
  const club = useClub();
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(0.3);
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !open) return;
    const fit = () => setScale(frame.clientWidth / POSTER_W);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.url);
    };
  }, [image]);

  const firstName = (id: string) => {
    const name = players.find((player) => player.id === id)?.name;
    return name?.trim().split(/\s+/)[0] || "Removed player";
  };

  async function makeImage() {
    const node = posterRef.current;
    if (!node) return;
    setMaking(true);
    setError(null);
    try {
      const options = { width: POSTER_W, height: POSTER_H, pixelRatio: 1, cacheBust: true };
      await toPng(node, options);
      const blob = await toBlob(node, options);
      if (!blob) throw new Error("No image");
      const file = new File([blob], `final-score-${match.team}-${match.date}.png`, {
        type: "image/png",
      });
      setImage({ url: URL.createObjectURL(blob), file });
    } catch {
      setError("Could not make the image. Please try again.");
    } finally {
      setMaking(false);
    }
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const url = URL.createObjectURL(file);
      try {
        const source = new Image();
        source.src = url;
        await source.decode();
        const ratio = Math.min(1, 1600 / Math.max(source.naturalWidth, source.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(source.naturalWidth * ratio);
        canvas.height = Math.round(source.naturalHeight * ratio);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not resize photo");
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        setPhoto(canvas.toDataURL("image/jpeg", 0.86));
        setImage(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      setError("Could not open that photo. Please try another.");
    }
  }

  async function shareImage() {
    if (!image) return;
    try {
      await navigator.share({ files: [image.file], title: "Final Score" });
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setError("Could not share the image. You can download it instead.");
    }
  }

  const ourTeam = { name: teamName, score: match.goals.length };
  const opposition = { name: match.opponent, score: match.opponentGoals };
  const homeTeam = match.home ? ourTeam : opposition;
  const awayTeam = match.home ? opposition : ourTeam;
  const canShare =
    !!image &&
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [image.file] });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setImage(null);
          setError(null);
          setOpen(true);
        }}
        className="mt-3 w-full cursor-pointer rounded-xl bg-green-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500"
      >
        Create Final Score poster
      </button>

      {open && (
        <div
          className="themed fixed inset-0 z-[80] overflow-y-auto bg-black/75 px-3 py-6 sm:px-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="final-score-title"
        >
          <div className="mx-auto max-w-xl">
            <div className="mb-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-lg dark:bg-[#1c1c1e]">
              <h2 id="final-score-title" className="font-bold text-gray-900 dark:text-gray-50">
                Final Score poster
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Final Score poster"
                className="cursor-pointer rounded-full px-3 py-1 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div
              ref={frameRef}
              className="no-dark w-full overflow-hidden rounded-xl shadow-xl"
              style={{ height: POSTER_H * scale }}
            >
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  width: POSTER_W,
                }}
              >
                <Poster
                  ref={posterRef}
                  club={club}
                  date={match.date}
                  teamName={teamName}
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  goals={match.goals}
                  firstName={firstName}
                  photo={photo}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
                <p className="mb-1 text-sm font-bold text-gray-900 dark:text-gray-50">
                  Match photo <span className="font-medium text-gray-400">Optional</span>
                </p>
                <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                  The photo stays on this device and is only included in the poster you make.
                </p>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer text-sm font-semibold text-green-700 dark:text-green-400">
                    {photo ? "Change photo" : "Add a photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        void choosePhoto(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {photo && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setImage(null);
                      }}
                      className="cursor-pointer text-sm font-semibold text-red-600 dark:text-red-400"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
              {error && (
                <p className="rounded-xl bg-white p-3 text-sm text-red-600 dark:bg-[#1c1c1e] dark:text-red-400">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={makeImage}
                disabled={making}
                className="w-full cursor-pointer rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {making ? "Making the image…" : image ? "Make the image again" : "Make the image"}
              </button>
              {image && (
                <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
                  <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                    Your poster is ready to share or download.
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={`Final score: ${homeTeam.name} ${homeTeam.score}, ${awayTeam.name} ${awayTeam.score}`}
                    className="w-full rounded-lg"
                  />
                  <div className="mt-3 flex gap-2">
                    {canShare && (
                      <button
                        type="button"
                        onClick={shareImage}
                        className="flex-1 cursor-pointer rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700"
                      >
                        Share
                      </button>
                    )}
                    <a
                      href={image.url}
                      download={image.file.name}
                      className="flex-1 rounded-xl border border-green-600 py-2.5 text-center text-sm font-bold text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-400/15"
                    >
                      Download
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Poster({
  ref,
  club,
  date,
  teamName,
  homeTeam,
  awayTeam,
  goals,
  firstName,
  photo,
}: {
  ref: React.Ref<HTMLDivElement>;
  club: ReturnType<typeof useClub>;
  date: string;
  teamName: string;
  homeTeam: { name: string; score: number };
  awayTeam: { name: string; score: number };
  goals: GoalEvent[];
  firstName: (id: string) => string;
  photo: string | null;
}) {
  const matchDate = new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: POSTER_W,
        height: POSTER_H,
        overflow: "hidden",
        background: "var(--club-night)",
        color: "white",
        fontFamily: "var(--font-poster-body, system-ui), sans-serif",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo ?? "/poster/brush-background.jpg"}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: POSTER_W,
          height: POSTER_H,
          objectFit: "cover",
          filter: photo ? "none" : "var(--club-brush-filter)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,.58) 0%, rgba(0,0,0,.34) 32%, rgba(0,0,0,.9) 65%, var(--club-night) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 28,
          left: -22,
          width: 380,
          height: 28,
          background: "var(--club-bright)",
          transform: "rotate(-3deg)",
          boxShadow: "0 10px 0 var(--club-night)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 112,
          right: -20,
          width: 340,
          height: 24,
          background: "var(--club-bright)",
          transform: "rotate(-3deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "48px 58px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div style={{ width: "100%", display: "flex", justifyContent: "flex-end", height: 125 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={club.crest.src}
            alt=""
            width={138}
            height={125}
            style={{ objectFit: "contain", filter: "drop-shadow(0 5px 10px rgba(0,0,0,.6))" }}
          />
        </div>
        <div
          style={{
            width: "100%",
            marginTop: 320,
            padding: "15px 0 18px",
            fontFamily: "var(--font-poster, Impact), sans-serif",
            fontSize: 112,
            lineHeight: 1,
            color: "white",
            textShadow: "4px 5px 0 #000",
            borderTop: "5px solid white",
            borderBottom: "5px solid white",
            letterSpacing: 4,
          }}
        >
          FULL-TIME
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 27,
            fontWeight: 700,
            color: "white",
            textShadow: "0 2px 8px #000",
          }}
        >
          {matchDate}
        </div>

        <div
          style={{
            width: "100%",
            marginTop: 26,
            padding: "20px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            borderRadius: 20,
            background: "rgba(0,0,0,.55)",
          }}
        >
          <TeamScore name={homeTeam.name} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              fontFamily: "var(--font-poster, Impact), sans-serif",
              fontSize: 100,
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            <span>{homeTeam.score}</span>
            <span style={{ color: "var(--club-bright)", fontSize: 65 }}>–</span>
            <span>{awayTeam.score}</span>
          </div>
          <TeamScore name={awayTeam.name} />
        </div>

        <div style={{ width: "100%", marginTop: 38, textAlign: "left" }}>
          <div
            style={{
              fontFamily: "var(--font-poster, Impact), sans-serif",
              fontSize: teamName.length > 18 ? 36 : 48,
              color: "var(--club-bright)",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            {teamName} Goals &amp; Assists
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 9,
              marginTop: 14,
            }}
          >
            {goals.length === 0 ? (
              <div style={goalRowStyle}>No goals scored</div>
            ) : (
              goals.map((goal) => (
                <div key={goal.id} style={goalRowStyle}>
                  <span style={{ flex: 1 }}>
                    {goal.scorerId ? firstName(goal.scorerId) : "Scorer not recorded"}
                  </span>
                  <span style={{ color: "var(--club-bright)", fontWeight: 800, marginRight: 18 }}>
                    GOAL
                  </span>
                  {goal.assistId && (
                    <span style={{ color: "#d1d5db", fontSize: 25 }}>
                      Assist: {firstName(goal.assistId)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: "auto",
            paddingTop: 28,
            width: "100%",
            borderTop: "2px solid rgba(255,255,255,.2)",
            color: "#d1d5db",
            fontSize: 26,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 4,
          }}
        >
          {club.fullName}
        </div>
      </div>
    </div>
  );
}

function TeamScore({ name }: { name: string }) {
  return (
    <div
      style={{
        width: 220,
        minWidth: 0,
        fontSize: 24,
        lineHeight: 1.1,
        fontWeight: 800,
        textTransform: "uppercase",
        overflowWrap: "anywhere",
      }}
    >
      {name}
    </div>
  );
}

const goalRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  minHeight: 62,
  padding: "12px 18px",
  borderRadius: 14,
  background: "rgba(0,0,0,.56)",
  fontSize: 30,
  fontWeight: 700,
};
