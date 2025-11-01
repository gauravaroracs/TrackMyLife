"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Settings, GripVertical } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

/**
 * COPY NOTE (Next.js): add `"use client";` at the very top of your page file.
 * `npm i recharts lucide-react`
 */

// ---------- Config: your birthday & target age ----------
const BIRTHDATE = new Date("2000-09-12T00:00:00");
const TARGET_AGE = 90; // years

// ---------- Types ----------
type Section = "Studies" | "Personal Life";

type Track = {
  id: string;
  label: string;
  section: Section;
  weekSpan: number; // how many recent weeks to show in the rail window
  weeklyTarget?: number; // optional, for analytics later
  logs: string[]; // ISO dates of check-ins (e.g., "2025-11-01")
};

// ---------- Seed data from your sketch ----------
const seedTracks: Track[] = [
  { id: "intro-llm", label: "Intro to LLM", section: "Studies", weekSpan: 8, logs: [] },
  { id: "sdms", label: "SDMS", section: "Studies", weekSpan: 8, logs: [] },
  { id: "pgm", label: "PGM", section: "Studies", weekSpan: 8, logs: [] },
  { id: "crypto", label: "Intro to Crypto", section: "Studies", weekSpan: 8, logs: [] },
  { id: "german-a2", label: "German A2", section: "Studies", weekSpan: 8, logs: [] },
  { id: "content-workout", label: "Content Creation + Workout", section: "Personal Life", weekSpan: 8, logs: [] },
  { id: "guitar", label: "Guitar", section: "Personal Life", weekSpan: 8, logs: [] },
  { id: "eng-speaking", label: "Eng speaking", section: "Personal Life", weekSpan: 8, logs: [] },
  { id: "dance", label: "Dance", section: "Personal Life", weekSpan: 8, logs: [] },
];

// ---------- Storage ----------
const STORE_KEY = "life_timeline_state_v1";

function loadTracks(): Track[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return seedTracks;
    const parsed = JSON.parse(raw) as Track[];
    return parsed.map((t) => ({ ...t, logs: Array.isArray(t.logs) ? t.logs : [] }));
  } catch {
    return seedTracks;
  }
}

function saveTracks(tracks: Track[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(tracks));
}

// ---------- Time helpers ----------
const DAY_MS = 24 * 60 * 60 * 1000;
function dayIndex(d: Date) { return Math.floor(d.getTime() / DAY_MS); }
function weekOfLife(d: Date, birth: Date) {
  return Math.floor((dayIndex(d) - dayIndex(birth)) / 7);
}
function dateFromWeekAndDow(birth: Date, week: number, dow: number) {
  const startIdx = dayIndex(birth) + week * 7 + dow; // 0..6
  return new Date(startIdx * DAY_MS);
}

function diffYMD(from: Date, to: Date) {
  // Simple Y/M/D diff (to >= from)
  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(to.getFullYear(), to.getMonth(), 0).getDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

function timeToNewYear(now: Date) {
  const target = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
  const ms = target.getTime() - now.getTime();
  const sec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  return { days, hours, minutes, seconds };
}

function useNow(tickMs = 1000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), tickMs); return () => clearInterval(id); }, [tickMs]);
  return now;
}

// 1% better per day curve
function useOnePercentSeries(days = 21) {
  return useMemo(() => {
    const out: { day: number; progress: number }[] = [];
    let value = 1;
    for (let d = 0; d < days; d++) {
      if (d > 0) value *= 1.01;
      out.push({ day: d + 1, progress: Number(value.toFixed(4)) });
    }
    return out;
  }, [days]);
}

// ---------- UI: Track Row (check-in driven) ----------
function TrackRow({
  track,
  currentWeek,
  onCommit,
}: {
  track: Track;
  currentWeek: number;
  onCommit: (id: string, isoDate: string) => void;
}) {
  const totalTicks = track.weekSpan * 7; // days shown in the window
  const startWeek = Math.max(0, currentWeek - track.weekSpan + 1); // last N weeks including current
  const railRef = useRef<HTMLDivElement | null>(null);

  // derive current position from latest log in window (fallback to end of window today)
  const latestLogInWindow = useMemo(() => {
    const startDayIdx = dayIndex(dateFromWeekAndDow(BIRTHDATE, startWeek, 0));
    const endDayIdx = startDayIdx + totalTicks - 1;
    const latest = track.logs
      .map((s) => new Date(s))
      .filter((d) => {
        const idx = dayIndex(d);
        return idx >= startDayIdx && idx <= endDayIdx;
      })
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return latest;
  }, [track.logs, startWeek, totalTicks]);

  const todayPos = useMemo(() => {
    const dow = (dayIndex(new Date()) - dayIndex(BIRTHDATE)) % 7; // 0..6
    const relativeWeek = currentWeek - startWeek; // 0..(weekSpan-1)
    return relativeWeek * 7 + dow; // falls within window
  }, [currentWeek, startWeek]);

  const derivedPos = useMemo(() => {
    if (!latestLogInWindow) return Math.min(totalTicks - 1, Math.max(0, todayPos));
    const w = weekOfLife(latestLogInWindow, BIRTHDATE) - startWeek; // 0..weekSpan-1
    const dow = (dayIndex(latestLogInWindow) - dayIndex(BIRTHDATE)) % 7; // 0..6
    return Math.max(0, Math.min(totalTicks - 1, w * 7 + dow));
  }, [latestLogInWindow, startWeek, totalTicks, todayPos]);

  const [livePos, setLivePos] = useState<number>(derivedPos);
  React.useEffect(() => setLivePos(derivedPos), [derivedPos]);

  function pxToPosition(container: HTMLDivElement, px: number) {
    const padding = 8;
    const w = container.clientWidth - padding * 2;
    const step = w / (totalTicks - 1);
    const clamped = Math.max(padding, Math.min(container.clientWidth - padding, px));
    const pos = Math.round((clamped - padding) / step);
    return Math.max(0, Math.min(totalTicks - 1, pos));
  }

  function onPointerDown(e: React.PointerEvent) {
    const el = railRef.current; if (!el) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const move = (evt: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      setLivePos(pxToPosition(el, x));
    };
    const up = (evt: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const pos = pxToPosition(el, x);
      const week = Math.floor(pos / 7);
      const dow = pos % 7;
      const realWeek = startWeek + week;
      const date = dateFromWeekAndDow(BIRTHDATE, realWeek, dow);
      const iso = date.toISOString().slice(0, 10);
      onCommit(track.id, iso);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const week = Math.floor(livePos / 7) + 1; // 1-based inside window
  const day = (livePos % 7) + 1;
  const realWeek = startWeek + (week - 1);
  const date = dateFromWeekAndDow(BIRTHDATE, realWeek, day - 1);

  return (
    <div className="flex items-start gap-4 w-full py-4">
      <div className="w-52 shrink-0 flex items-center gap-2 text-base font-medium text-neutral-900 pt-1">
        <GripVertical className="w-4 h-4 text-neutral-400" />
        <span>{track.label}</span>
      </div>
      <div className="flex-1">
        <div className="relative group" ref={railRef} onPointerDown={onPointerDown}>
          {/* Rail */}
          <div className="h-2 rounded-full bg-neutral-200 transition-shadow group-hover:shadow-[0_0_0_4px_rgba(79,70,229,0.08)]" />
          {/* Week separators */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: track.weekSpan + 1 }).map((_, i) => (
              <div key={i} className="border-r border-neutral-300/60 flex-1" />
            ))}
          </div>
          {/* Day ticks */}
          <div className="absolute inset-x-2 inset-y-0 flex items-center justify-between pointer-events-none">
            {Array.from({ length: totalTicks }).map((_, i) => (
              <div key={i} className="w-px h-3 bg-neutral-300/70" />
            ))}
          </div>
          {/* Draggable human marker + tooltip */}
          <HumanMarker railRef={railRef} pos={livePos} total={totalTicks} tooltip={date.toDateString()} />
        </div>
        {/* W · D indicator under the slider */}
        <div className="mt-1 text-[11px] text-neutral-700 text-center">
          <span className="inline-block px-2 py-0.5 rounded-full border border-neutral-200 bg-neutral-50 font-mono tabular-nums">
            W{week} · D{day}
          </span>
        </div>
      </div>
    </div>
  );
}

function HumanMarker({ railRef, pos, total, tooltip }: { railRef: React.RefObject<HTMLDivElement | null>; pos: number; total: number; tooltip: string; }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const el = railRef.current; if (!el) return;
    const padding = 8;
    const w = el.clientWidth - padding * 2;
    const step = w / (total - 1);
    setLeft(padding + step * pos);
  }, [pos, railRef, total]);

  return (
    <div className="absolute -top-6" style={{ left: left - 10 }} aria-label="You">
      {/* human silhouette in accent color */}
      <div title={tooltip} className="transition-transform hover:scale-105">
        <svg width="20" height="24" viewBox="0 0 24 24" role="img">
          <circle cx="12" cy="6" r="3" className="fill-indigo-600" />
          <rect x="11" y="9" width="2" height="6" className="fill-indigo-600" />
          <path d="M6 12 L12 11 L18 12" className="stroke-indigo-600" strokeWidth="2" fill="none" />
          <path d="M9 23 L12 18 L15 23" className="stroke-indigo-600" strokeWidth="2" fill="none" />
        </svg>
      </div>
      <div className="w-0.5 h-3 bg-indigo-600 mx-auto" />
    </div>
  );
}

// ---------- Page ----------
export default function LifeTimeline() {
  const now = useNow();
  const ny = timeToNewYear(now);
  const ninetieth = useMemo(() => new Date(BIRTHDATE.getFullYear() + TARGET_AGE, BIRTHDATE.getMonth(), BIRTHDATE.getDate()), []);
  const lifeLeft = ninetieth > now ? diffYMD(now, ninetieth) : { years: 0, months: 0, days: 0 };
  const lifeRatio = Math.min(1, Math.max(0, (now.getTime() - BIRTHDATE.getTime()) / (ninetieth.getTime() - BIRTHDATE.getTime())));
  const currentWeek = weekOfLife(now, BIRTHDATE);

  // tracks state with load/save
  const [tracks, setTracks] = useState<Track[]>(loadTracks());
  useEffect(() => { if (tracks.length) saveTracks(tracks); }, [tracks]);

  const studies = tracks.filter((t) => t.section === "Studies");
  const personal = tracks.filter((t) => t.section === "Personal Life");

  function commitCheckIn(id: string, isoDate: string) {
    setTracks((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      if (t.logs.includes(isoDate)) return t;
      const next = { ...t, logs: [...t.logs, isoDate].sort() };
      return next;
    }));
  }

  function addGoal() {
    const name = prompt("Goal name?");
    if (!name) return;
    const sectionInput = prompt("Section: Studies or Personal Life?", "Personal Life");
    const section: Section = (sectionInput === "Studies" ? "Studies" : "Personal Life");
    const weekSpan = Number(prompt("How many recent weeks to show?", "8") || 8);
    const id = name.toLowerCase().replace(/\s+/g, "-");
    setTracks((prev) => [...prev, { id, label: name, section, weekSpan, logs: [] }]);
  }

  const series = useOnePercentSeries(21);
  const birthStr = BIRTHDATE.toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" });

  // simple top ruler for the visible window (uses the longest weekSpan among tracks)
  const maxSpan = Math.max(1, ...tracks.map((t) => t.weekSpan));
  const rulerWeeks = Array.from({ length: maxSpan }, (_, i) => currentWeek - maxSpan + 1 + i);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div className="text-2xl md:text-3xl font-semibold tracking-tight">Track My Life — Bird&apos;s‑Eye</div>
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-200 text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100" onClick={addGoal}><Plus className="w-4 h-4" /> Add Goal</button>
              <button className="p-2 rounded-xl border border-neutral-300 hover:bg-neutral-50" aria-label="Settings"><Settings className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="text-xs text-neutral-600 mt-1">
            Born <span className="font-medium">{birthStr}</span> — <span className="font-medium">{lifeLeft.years}y {lifeLeft.months}m {lifeLeft.days}d</span> left to age {TARGET_AGE}. &nbsp;•&nbsp; New Year in: <span className="font-medium">{ny.days}d {ny.hours}h {ny.minutes}m {ny.seconds}s</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-10">
        {/* Life master bar */}
        <section className="space-y-2">
          <div className="relative h-3 rounded-full bg-neutral-200">
            <div className="absolute inset-y-0 left-0 rounded-full bg-neutral-900" style={{ width: `${(lifeRatio * 100).toFixed(2)}%` }} />
          </div>
          {/* Age/Week ruler for current window */}
          {tracks.length > 0 && (
            <div className="flex justify-between text-[11px] text-neutral-500">
              {rulerWeeks.map((w) => (
                <span key={w} className="tabular-nums">W{w}</span>
              ))}
            </div>
          )}
        </section>

        {/* Studies */}
        <Section title="STUDIES">
          {studies.map((t) => (
            <TrackRow key={t.id} track={t} currentWeek={currentWeek} onCommit={commitCheckIn} />
          ))}
        </Section>

        {/* Personal Life */}
        <Section title="PERSONAL LIFE">
          {personal.map((t) => (
            <TrackRow key={t.id} track={t} currentWeek={currentWeek} onCommit={commitCheckIn} />
          ))}
        </Section>

        {/* Power of Habits Chart */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Power of habits — +1% every day</h3>
          <div className="w-full h-56 border border-neutral-200 rounded-2xl p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} label={{ value: "Days", position: "insideBottomRight", offset: -6 }} />
                <YAxis tick={{ fontSize: 12 }} label={{ value: "Progress (x)", angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Line type="monotone" dataKey="progress" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-neutral-200 pt-4">
      <h2 className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
