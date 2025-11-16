"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Flame,
  Flag,
  GripVertical,
  Mountain,
  Sparkles,
  Trophy,
  BookOpen,
  HeartHandshake,
  Plus,
  Settings,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// OPTIONAL: if you want confetti, install canvas-confetti
// import confetti from "canvas-confetti";

/* ------------------------------------------------------------------ */
/* Types & constants                                                  */
/* ------------------------------------------------------------------ */

type Section = "Studies" | "Personal Life";

type TaskTemplate = {
  id: string;
  label: string;
};

type DayState = {
  completedTasks: string[];
  note?: string;
};

type Goal = {
  id: string;
  label: string;
  section: Section;
  tasks: TaskTemplate[];
  days: DayState[]; // length 7
};

type WeekSummary = {
  id: string;
  startISO: string;
  endISO: string;
  totalCompletedTasks: number;
  totalPossibleTasks: number;
  bestGoalId: string | null;
  bestGoalLabel: string | null;
  bestGoalCompletion: number;
};

type TrackerState = {
  weekStartISO: string;
  goals: Goal[];
  history: WeekSummary[];
};

type HabitPoint = {
  dayLabel: string;
  real: number;
  projected: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const NUM_DAYS = 7;
const STORAGE_KEY = "TRACK_MY_LIFE_V3";

/* ------------------------------------------------------------------ */
/* Time helpers                                                       */
/* ------------------------------------------------------------------ */

function dayIndex(date: Date) {
  return Math.floor(date.getTime() / DAY_MS);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function diffInDays(a: Date, b: Date) {
  return dayIndex(a) - dayIndex(b);
}

/* ------------------------------------------------------------------ */
/* Seed data                                                          */
/* ------------------------------------------------------------------ */

function emptyDay(): DayState {
  return { completedTasks: [], note: "" };
}

function emptyDays(): DayState[] {
  return Array.from({ length: NUM_DAYS }, () => emptyDay());
}

const seedGoals: Goal[] = [
  {
    id: "intro-llm",
    label: "Intro to LLM",
    section: "Studies",
    tasks: [
      { id: "llm-notes", label: "Review lecture notes" },
      { id: "llm-ex", label: "Solve 2 practice questions" },
      { id: "llm-reading", label: "Read 5 pages" },
      { id: "llm-video", label: "Watch 10 min recap" },
    ],
    days: emptyDays(),
  },
  {
    id: "sdms",
    label: "SDMS",
    section: "Studies",
    tasks: [
      { id: "sdms-reading", label: "Read 3 pages of script" },
      { id: "sdms-quiz", label: "Do 5 quiz questions" },
      { id: "sdms-notes", label: "Organise notes" },
    ],
    days: emptyDays(),
  },
  {
    id: "pgm",
    label: "PGM",
    section: "Studies",
    tasks: [
      { id: "pgm-slides", label: "Scan slides 10 min" },
      { id: "pgm-problem", label: "Attempt 1 problem" },
      { id: "pgm-solution", label: "Check 1 solution" },
    ],
    days: emptyDays(),
  },
  {
    id: "crypto",
    label: "Intro to Crypto",
    section: "Studies",
    tasks: [
      { id: "crypto-topic", label: "Read 1 topic" },
      { id: "crypto-summary", label: "Write 3 bullet summary" },
    ],
    days: emptyDays(),
  },
  {
    id: "german-a2",
    label: "German A2",
    section: "Studies",
    tasks: [
      { id: "german-vocab", label: "Learn 5 new words" },
      { id: "german-speak", label: "Speak 5 min" },
      { id: "german-grammar", label: "One grammar exercise" },
    ],
    days: emptyDays(),
  },
  {
    id: "content-workout",
    label: "Content Creation + Workout",
    section: "Personal Life",
    tasks: [
      { id: "content-idea", label: "Brainstorm 3 ideas" },
      { id: "content-draft", label: "Draft 1 post/reel" },
      { id: "workout-20", label: "20 min workout" },
      { id: "walk-steps", label: "5k steps" },
    ],
    days: emptyDays(),
  },
  {
    id: "guitar",
    label: "Guitar",
    section: "Personal Life",
    tasks: [
      { id: "guitar-chords", label: "Practice chords 10 min" },
      { id: "guitar-song", label: "Play 1 full song" },
      { id: "guitar-metronome", label: "5 min with metronome" },
    ],
    days: emptyDays(),
  },
  {
    id: "eng-speaking",
    label: "Eng speaking",
    section: "Personal Life",
    tasks: [
      { id: "eng-shadow", label: "Shadow 5 min video" },
      { id: "eng-record", label: "Record 2 min monologue" },
      { id: "eng-words", label: "Learn 5 new phrases" },
    ],
    days: emptyDays(),
  },
];

/* ------------------------------------------------------------------ */
/* Storage helpers                                                    */
/* ------------------------------------------------------------------ */

function defaultState(): TrackerState {
  return {
    weekStartISO: todayISO(),
    goals: seedGoals,
    history: [],
  };
}

function loadState(): TrackerState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return JSON.parse(raw) as TrackerState;
  } catch {
    return defaultState();
  }
}

function saveState(state: TrackerState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ------------------------------------------------------------------ */
/* Progress + visual helpers                                          */
/* ------------------------------------------------------------------ */

// Option C mapping: #tasks -> step within that day
function stepForDay(tasksCompleted: number, totalTasks: number): number {
  if (tasksCompleted <= 0) return 0;
  if (tasksCompleted >= totalTasks) return 1.0; // giant leap
  if (tasksCompleted >= 4) return 0.8;
  if (tasksCompleted >= 2) return 0.5;
  return 0.2;
}

// Sum all daily steps (max 7 blocks)
function totalBlocks(goal: Goal): number {
  const totalTasks = goal.tasks.length;
  const blocks = goal.days.reduce((sum, day) => {
    const c = day.completedTasks.length;
    return sum + stepForDay(c, totalTasks);
  }, 0);
  return Math.min(NUM_DAYS, Number(blocks.toFixed(2)));
}

function completionPct(goal: Goal): number {
  return (totalBlocks(goal) / NUM_DAYS) * 100;
}

// streak = consecutive days from latest (right side) with any tasks
function streakDays(goal: Goal): number {
  let streak = 0;
  for (let i = NUM_DAYS - 1; i >= 0; i--) {
    if (goal.days[i].completedTasks.length > 0) streak += 1;
    else break;
  }
  return streak;
}

// dormancy: no tasks in last 2 days
function isDormant(goal: Goal): boolean {
  for (let i = NUM_DAYS - 1; i >= NUM_DAYS - 2 && i >= 0; i--) {
    if (goal.days[i].completedTasks.length > 0) return false;
  }
  return true;
}

// row tint based on completion %
function rowTintClass(pct: number): string {
  if (pct === 0) return "bg-gradient-to-r from-red-50 via-orange-50 to-amber-50";
  if (pct <= 40)
    return "bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50";
  if (pct <= 70)
    return "bg-gradient-to-r from-emerald-50 via-green-50 to-emerald-100";
  if (pct < 100)
    return "bg-gradient-to-r from-green-50 via-emerald-100 to-lime-100";
  return "bg-gradient-to-r from-green-100 via-emerald-200 to-yellow-100";
}

// figure stage by pct
function figureStage(pct: number): 1 | 2 | 3 | 4 {
  if (pct < 30) return 1;
  if (pct < 60) return 2;
  if (pct < 85) return 3;
  return 4;
}

// build 7-day real vs projected series
function buildHabitSeries(goals: Goal[]): HabitPoint[] {
  let cumulativeReal = 0;
  let projected = 1;
  const points: HabitPoint[] = [];

  for (let i = 0; i < NUM_DAYS; i++) {
    const completedToday = goals.reduce(
      (sum, g) => sum + g.days[i].completedTasks.length,
      0
    );
    cumulativeReal += completedToday;
    if (i > 0) projected *= 1.01;

    points.push({
      dayLabel: `D${i + 1}`,
      real: cumulativeReal,
      projected: Number(projected.toFixed(2)),
    });
  }
  return points;
}

// quote by overall completion
function quoteForCompletion(overallPct: number): string {
  if (overallPct === 0)
    return "Every hero starts at level 1. Tiny steps count.";
  if (overallPct < 30)
    return "Small consistent moves beat random big efforts.";
  if (overallPct < 60)
    return "You’re building momentum. Keep the streak alive.";
  if (overallPct < 90)
    return "You’re in the growth zone. One more block each day.";
  return "You’re on fire. Protect this streak like treasure.";
}

/* ------------------------------------------------------------------ */
/* UI Components                                                      */
/* ------------------------------------------------------------------ */

// Evolving stick person climbing a mountain
function StickFigure({
  pct,
  blocks,
  dormant,
  justHitHundred,
}: {
  pct: number;
  blocks: number;
  dormant: boolean;
  justHitHundred: boolean;
}) {
  const stage = figureStage(pct);

  const xRatio = Math.min(1, blocks / NUM_DAYS); // 0..1
  const yRatio = xRatio; // climb upwards as you progress

  const bottomPx = 6 + yRatio * 32;

  const baseColor = dormant ? "#9ca3af" : "#4f46e5";
  const glowColor = "#a3e635";

  const scale = 0.9 + (stage - 1) * 0.15;

  const heroGlow =
    stage === 4
      ? {
          filter: "drop-shadow(0 0 6px rgba(190, 242, 100, 0.9))",
        }
      : {};

  const animationClass = justHitHundred
    ? "animate-bounce"
    : dormant
    ? "animate-pulse"
    : "transition-transform duration-500 ease-in-out";

  return (
    <div
      className={`absolute ${animationClass}`}
      style={{
        left: `${xRatio * 100}%`,
        bottom: bottomPx,
        transform: "translateX(-50%)",
        ...heroGlow,
      }}
    >
      <svg width={30} height={36} viewBox="0 0 24 24">
        {/* head */}
        <circle
          cx="12"
          cy="5"
          r={stage >= 3 ? 3.1 : 2.6}
          fill={stage === 4 ? glowColor : baseColor}
        />
        {/* body */}
        <line
          x1="12"
          y1="8"
          x2="12"
          y2="15"
          stroke={baseColor}
          strokeWidth={stage >= 3 ? 2.4 : 1.8}
          strokeLinecap="round"
        />
        {/* arms */}
        <line
          x1="7"
          y1="11"
          x2="12"
          y2="9.5"
          stroke={baseColor}
          strokeWidth={stage >= 3 ? 2.2 : 1.6}
          strokeLinecap="round"
        />
        <line
          x1="17"
          y1="11"
          x2="12"
          y2="9.5"
          stroke={baseColor}
          strokeWidth={stage >= 3 ? 2.2 : 1.6}
          strokeLinecap="round"
        />
        {/* legs */}
        <line
          x1="9"
          y1="23"
          x2="12"
          y2="15"
          stroke={baseColor}
          strokeWidth={stage >= 3 ? 2.2 : 1.6}
          strokeLinecap="round"
        />
        <line
          x1="15"
          y1="23"
          x2="12"
          y2="15"
          stroke={baseColor}
          strokeWidth={stage >= 3 ? 2.2 : 1.6}
          strokeLinecap="round"
        />

        {/* cape for stage 3+ */}
        {stage >= 3 && (
          <path
            d="M12 10 L7 15 L7 18 L12 15 Z"
            fill={stage === 4 ? glowColor : "#a5b4fc"}
            opacity={stage === 4 ? 0.9 : 0.7}
          />
        )}
      </svg>
      <div
        style={{ transform: `scale(${scale})` }}
        className="origin-bottom"
      ></div>
    </div>
  );
}

function MountainBackground() {
  return (
    <svg
      className="absolute inset-x-0 bottom-0 h-16 w-full text-neutral-200"
      viewBox="0 0 200 60"
      preserveAspectRatio="none"
    >
      <path
        d="M0 50 L30 40 L60 35 L90 25 L120 15 L150 10 L180 5 L200 0 L200 60 L0 60 Z"
        fill="currentColor"
        opacity={0.4}
      />
    </svg>
  );
}

function GoalRow({
  goal,
  onOpenModal,
  justHitHundred,
}: {
  goal: Goal;
  onOpenModal: () => void;
  justHitHundred: boolean;
}) {
  const pct = completionPct(goal);
  const blocks = totalBlocks(goal);
  const streak = streakDays(goal);
  const dormant = isDormant(goal);
  const rowTint = rowTintClass(pct);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-neutral-200 ${rowTint} shadow-sm hover:shadow-md transition-shadow duration-300`}
    >
      <MountainBackground />

      <div className="relative px-4 py-3 flex gap-4 items-start">
        {/* name & streak */}
        <button
          onClick={onOpenModal}
          className="flex items-start gap-2 text-left w-64 shrink-0 group"
        >
          <GripVertical className="w-4 h-4 mt-1 text-neutral-400 group-hover:text-neutral-600" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-neutral-900">
                {goal.label}
              </span>
              {pct === 100 && (
                <Trophy className="w-4 h-4 text-amber-500 drop-shadow-sm" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-neutral-600 font-mono">
                Streak: {streak}d
              </span>
              {streak >= 3 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-orange-600 font-semibold">
                  <Flame className="w-3 h-3" />
                  On fire
                </span>
              )}
            </div>
          </div>
        </button>

        {/* main track */}
        <div className="flex-1 relative">
          {/* checkpoints bar */}
          <div className="relative h-8 mt-1">
            {/* base line */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-white/70 border border-neutral-200/80" />

            {/* 7 day ticks */}
            <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex justify-between">
              {Array.from({ length: NUM_DAYS }).map((_, i) => (
                <div
                  key={i}
                  className="w-px h-3 bg-neutral-300/80"
                />
              ))}
            </div>

            {/* 25/50/75% dotted checkpoints */}
            <div className="absolute inset-x-4 top-[80%] flex justify-between pointer-events-none">
              {[0.25, 0.5, 0.75].map((ratio) => (
                <div
                  key={ratio}
                  className="w-px h-2 border-l border-dashed border-neutral-400/60"
                  style={{ marginLeft: `${ratio * 100}%` }}
                />
              ))}
            </div>

            {/* flags at day 3 & 7 */}
            <Flag
              className="absolute w-3 h-3 text-neutral-500"
              style={{ left: `${(2 / (NUM_DAYS - 1)) * 100}%`, top: -8 }}
            />
            <Flag
              className="absolute w-4 h-4 text-emerald-600"
              style={{ right: 0, top: -10 }}
            />

            {/* stick figure */}
            <StickFigure
              pct={pct}
              blocks={blocks}
              dormant={dormant}
              justHitHundred={justHitHundred}
            />
          </div>

          {/* day labels */}
          <div className="mt-1 flex justify-between text-[10px] text-neutral-600">
            {Array.from({ length: NUM_DAYS }).map((_, i) => (
              <span key={i}>Day {i + 1}</span>
            ))}
          </div>

          {/* completion + pct */}
          <div className="mt-1 text-[11px] text-neutral-700 flex gap-3 items-center">
            <span className="font-mono">
              {blocks.toFixed(1)} / {NUM_DAYS} blocks
            </span>
            <span className="font-mono">{pct.toFixed(0)}%</span>
            {pct >= 50 && pct < 100 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                <Sparkles className="w-3 h-3" />
                Halfway hero
              </span>
            )}
            {dormant && (
              <span className="text-xs text-red-500">
                No progress for 2+ days
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Daily check-in modal ---------------------------------- */

function DailyCheckinModal({
  goals,
  dayIndex,
  onClose,
  onToggleTask,
  onUpdateNote,
}: {
  goals: Goal[];
  dayIndex: number;
  onClose: () => void;
  onToggleTask: (goalId: string, taskId: string, dayIndex: number) => void;
  onUpdateNote: (goalId: string, dayIndex: number, note: string) => void;
}) {
  const dayLabel = `Day ${dayIndex + 1}`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-neutral-200 p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Today&apos;s Check-in
            </h2>
            <p className="text-xs text-neutral-500">{dayLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {goals.map((g) => (
            <div
              key={g.id}
              className="rounded-xl border border-neutral-200/80 bg-neutral-50/60 px-3 py-2"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-neutral-800">
                  {g.label}
                </span>
                <span className="text-[11px] text-neutral-500 font-mono">
                  {g.days[dayIndex].completedTasks.length} / {g.tasks.length} tasks
                </span>
              </div>

              <ul className="space-y-1">
                {g.tasks.map((t) => {
                  const checked = g.days[dayIndex].completedTasks.includes(t.id);
                  return (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-indigo-600"
                        checked={checked}
                        onChange={() => onToggleTask(g.id, t.id, dayIndex)}
                      />
                      <span
                        className={
                          checked
                            ? "line-through text-neutral-400"
                            : "text-neutral-800"
                        }
                      >
                        {t.label}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <textarea
                className="mt-2 w-full rounded-lg border border-neutral-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Add quick note (e.g., Studied 2 hours, felt tired)..."
                value={g.days[dayIndex].note ?? ""}
                onChange={(e) => onUpdateNote(g.id, dayIndex, e.target.value)}
              />
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-neutral-500">
          Tip: Even completing one tiny task keeps your streak alive. Small
          blocks compound into big progress.
        </p>
      </div>
    </div>
  );
}

/* ---------- Weekly summary modal ---------------------------------- */

function WeekSummaryModal({
  state,
  onStartNewWeek,
}: {
  state: TrackerState;
  onStartNewWeek: () => void;
}) {
  const { weekStartISO, goals } = state;

  const allTasks = goals.reduce(
    (sum, g) => sum + g.tasks.length * NUM_DAYS,
    0
  );
  const completedTasks = goals.reduce(
    (sum, g) =>
      sum +
      g.days.reduce(
        (inner, d) => inner + d.completedTasks.length,
        0
      ),
    0
  );

  const bestGoal = goals
    .map((g) => ({ g, pct: completionPct(g) }))
    .sort((a, b) => b.pct - a.pct)[0];

  const overallPct = allTasks ? (completedTasks / allTasks) * 100 : 0;

  const start = new Date(weekStartISO);
  const end = new Date(start.getTime() + (NUM_DAYS - 1) * DAY_MS);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-emerald-200 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-emerald-500" />
          <h2 className="text-base font-semibold text-neutral-900">
            Week Complete 🎉
          </h2>
        </div>
        <p className="text-xs text-neutral-500 mb-3">
          {start.toLocaleDateString()} – {end.toLocaleDateString()}
        </p>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Total tasks completed</span>
            <span className="font-mono">{completedTasks}</span>
          </div>
          <div className="flex justify-between">
            <span>Overall completion</span>
            <span className="font-mono">{overallPct.toFixed(0)}%</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span>Best habit</span>
            {bestGoal ? (
              <span className="font-medium flex items-center gap-1">
                {bestGoal.g.label}
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="font-mono text-xs">
                  {bestGoal.pct.toFixed(0)}%
                </span>
              </span>
            ) : (
              <span className="font-mono text-xs">—</span>
            )}
          </div>
        </div>

        <button
          onClick={onStartNewWeek}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold py-2 hover:bg-emerald-700"
        >
          Start New Week
        </button>

        <p className="mt-2 text-[11px] text-neutral-500 text-center">
          Your progress is saved as a card. New week, same mission: move your
          little heroes forward.
        </p>
      </div>
    </div>
  );
}

/* ---------- History card ------------------------------------------ */

function LastWeekCard({ summary }: { summary: WeekSummary }) {
  const start = new Date(summary.startISO);
  const end = new Date(summary.endISO);
  return (
    <div className="mt-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-800">
            Last week recap
          </span>
          <Sparkles className="w-3 h-3 text-emerald-500" />
        </div>
        <p className="text-[11px] text-neutral-500">
          {start.toLocaleDateString()} – {end.toLocaleDateString()}
        </p>
      </div>
      <div className="text-right">
        <div className="font-mono">
          {summary.totalCompletedTasks}/{summary.totalPossibleTasks} tasks
        </div>
        {summary.bestGoalLabel && (
          <div className="text-[11px] text-neutral-600 flex items-center justify-end gap-1">
            <Trophy className="w-3 h-3 text-amber-500" />
            <span>
              {summary.bestGoalLabel} ({summary.bestGoalCompletion.toFixed(0)}%)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                          */
/* ------------------------------------------------------------------ */

export default function TrackMyLifePage() {
  const [state, setState] = useState<TrackerState>(() => loadState());
  const [showCheckin, setShowCheckin] = useState(false);
  const [showWeekSummary, setShowWeekSummary] = useState(false);
  const [lastCompletionByGoal, setLastCompletionByGoal] = useState<
    Record<string, number>
  >({});

  // current day index in this week (0..6)
  const today = new Date();
  const weekStart = new Date(state.weekStartISO);
  const diff = diffInDays(today, weekStart);
  const dayIndex = Math.max(0, Math.min(NUM_DAYS - 1, diff));

  const weekFinished = diff >= NUM_DAYS;

  useEffect(() => {
    if (weekFinished) setShowWeekSummary(true);
  }, [weekFinished]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    saveState(state);
  }, [state]);

  const goals = state.goals;

  const overallCompletion = useMemo(() => {
    const totalBlocksAll = goals.reduce(
      (sum, g) => sum + totalBlocks(g),
      0
    );
    return (totalBlocksAll / (NUM_DAYS * goals.length)) * 100;
  }, [goals]);

  const habitSeries = useMemo(() => buildHabitSeries(goals), [goals]);

  // detect newly completed 100% for celebration
  useEffect(() => {
    const map: Record<string, number> = {};
    for (const g of goals) {
      map[g.id] = completionPct(g);
    }

    const justHitIds = Object.keys(map).filter((id) => {
      const prev = lastCompletionByGoal[id] ?? 0;
      return prev < 100 && map[id] === 100;
    });

    if (justHitIds.length > 0) {
      // OPTIONAL confetti:
      // confetti({ particleCount: 80, spread: 60, origin: { y: 0.3 } });
      // (or trigger sound here)
    }

    setLastCompletionByGoal(map);
  }, [goals, lastCompletionByGoal]);

  function updateState(updater: (prev: TrackerState) => TrackerState) {
    setState((prev) => updater(prev));
  }

  function handleToggleTask(goalId: string, taskId: string, dIndex: number) {
    updateState((prev) => {
      const nextGoals = prev.goals.map((g) => {
        if (g.id !== goalId) return g;
        const days = g.days.map((day, idx) => {
          if (idx !== dIndex) return day;
          const completed = new Set(day.completedTasks);
          if (completed.has(taskId)) completed.delete(taskId);
          else completed.add(taskId);
          return { ...day, completedTasks: Array.from(completed) };
        });
        return { ...g, days };
      });
      return { ...prev, goals: nextGoals };
    });
  }

  function handleUpdateNote(goalId: string, dIndex: number, note: string) {
    updateState((prev) => {
      const nextGoals = prev.goals.map((g) => {
        if (g.id !== goalId) return g;
        const days = g.days.map((day, idx) =>
          idx === dIndex ? { ...day, note } : day
        );
        return { ...g, days };
      });
      return { ...prev, goals: nextGoals };
    });
  }

  function handleStartNewWeek() {
    const start = new Date(state.weekStartISO);
    const end = new Date(start.getTime() + (NUM_DAYS - 1) * DAY_MS);

    const totalPossible = state.goals.reduce(
      (sum, g) => sum + g.tasks.length * NUM_DAYS,
      0
    );
    const totalCompleted = state.goals.reduce(
      (sum, g) =>
        sum +
        g.days.reduce(
          (inner, d) => inner + d.completedTasks.length,
          0
        ),
      0
    );

    const bestGoal = state.goals
      .map((g) => ({ g, pct: completionPct(g) }))
      .sort((a, b) => b.pct - a.pct)[0];

    const summary: WeekSummary = {
      id: `${state.weekStartISO}`,
      startISO: state.weekStartISO,
      endISO: end.toISOString().slice(0, 10),
      totalCompletedTasks: totalCompleted,
      totalPossibleTasks: totalPossible,
      bestGoalId: bestGoal?.g.id ?? null,
      bestGoalLabel: bestGoal?.g.label ?? null,
      bestGoalCompletion: bestGoal?.pct ?? 0,
    };

    const newWeekStart = todayISO();

    setState({
      weekStartISO: newWeekStart,
      goals: state.goals.map((g) => ({
        ...g,
        days: emptyDays(),
      })),
      history: [...state.history, summary],
    });

    setShowWeekSummary(false);
  }

  const studies = goals.filter((g) => g.section === "Studies");
  const personal = goals.filter((g) => g.section === "Personal Life");
  const lastWeek = state.history[state.history.length - 1];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-neutral-50/80 backdrop-blur border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 flex items-center justify-center shadow-md text-white">
              <Mountain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
                  Track My Life
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-200">
                  <Sparkles className="w-3 h-3" />
                  7-Day Habit Journey
                </span>
              </div>
              <p className="text-[11px] text-neutral-500">
                Make your tiny stick hero stronger every day.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCheckin(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-indigo-700 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Today&apos;s Check-in
            </button>
            <button className="p-2 rounded-xl border border-neutral-300 hover:bg-neutral-100">
              <Settings className="w-4 h-4 text-neutral-500" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-4 space-y-6">
        {/* Quote + overall progress */}
        <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <p className="text-xs text-neutral-700 max-w-md">
              {quoteForCompletion(overallCompletion)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-500">This week progress</div>
            <div className="text-lg font-mono font-semibold">
              {overallCompletion.toFixed(0)}%
            </div>
            <div className="text-[11px] text-neutral-500">
              Day {dayIndex + 1} of 7
            </div>
          </div>
        </section>

        {lastWeek && <LastWeekCard summary={lastWeek} />}

        {/* Studies */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-white shadow-sm">
              <BookOpen className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600">
              Studies
            </h2>
          </div>
          <div className="space-y-3">
            {studies.map((g) => (
              <GoalRow
                key={g.id}
                goal={g}
                onOpenModal={() => setShowCheckin(true)}
                justHitHundred={
                  (lastCompletionByGoal[g.id] ?? 0) < 100 &&
                  completionPct(g) === 100
                }
              />
            ))}
          </div>
        </section>

        {/* Personal life */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-sm">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600">
              Personal Life
            </h2>
          </div>
          <div className="space-y-3">
            {personal.map((g) => (
              <GoalRow
                key={g.id}
                goal={g}
                onOpenModal={() => setShowCheckin(true)}
                justHitHundred={
                  (lastCompletionByGoal[g.id] ?? 0) < 100 &&
                  completionPct(g) === 100
                }
              />
            ))}
          </div>
        </section>

        {/* 7-day trend graph */}
        <section>
          <h3 className="text-xs font-semibold text-neutral-700 mb-1">
            7-Day Trend — Real vs Projected
          </h3>
          <div className="w-full h-52 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={habitSeries}
                margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="real"
                  name="Real tasks"
                  stroke="#111827"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  name="Projected (+1%/day)"
                  stroke="#4f46e5"
                  strokeDasharray="4 2"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>

      {/* Modals */}
      {showCheckin && !weekFinished && (
        <DailyCheckinModal
          goals={goals}
          dayIndex={dayIndex}
          onClose={() => setShowCheckin(false)}
          onToggleTask={handleToggleTask}
          onUpdateNote={handleUpdateNote}
        />
      )}

      {showWeekSummary && (
        <WeekSummaryModal state={state} onStartNewWeek={handleStartNewWeek} />
      )}
    </div>
  );
}