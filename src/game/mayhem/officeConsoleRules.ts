/** Night 5 desk console: pure task progression rules (5 tasks). */
export type ConsoleTask = "power" | "code" | "simon" | "wire" | "surge";
export const CONSOLE_TASKS: ConsoleTask[] = ["power", "code", "simon", "wire", "surge"];
export const TASK_ROUNDS: Record<ConsoleTask, number> = { power: 1, code: 10, simon: 7, wire: 12, surge: 1 };

export type ConsoleProgress = { task: number; round: number; done: boolean };
export const startConsole = (): ConsoleProgress => ({ task: 0, round: 0, done: false });

/** Finish one round; move to the next task when its rounds are complete. */
export function completeRound(p: ConsoleProgress): ConsoleProgress {
  if (p.done) return p;
  const round = p.round + 1;
  if (round < TASK_ROUNDS[CONSOLE_TASKS[p.task]]) return { ...p, round };
  const task = p.task + 1;
  return task >= CONSOLE_TASKS.length ? { task: p.task, round, done: true } : { task, round: 0, done: false };
}

export type CodeRound = { options: string[]; answer: number; hintPos: number };

/** Four orderings of the same 4 digits; the hint digit at hintPos matches only the answer. */
export function makeCodeRound(rand: () => number = Math.random): CodeRound {
  const digits: number[] = [];
  while (digits.length < 4) { const d = Math.floor(rand() * 10); if (!digits.includes(d)) digits.push(d); }
  const shuffle = () => { const a = [...digits]; for (let i = 3; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.join(""); };
  const hintPos = Math.floor(rand() * 4);
  const correct = shuffle();
  const options = [correct];
  let guard = 0;
  while (options.length < 4 && guard++ < 500) {
    const s = shuffle();
    if (!options.includes(s) && s[hintPos] !== correct[hintPos]) options.push(s);
  }
  for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
  return { options, answer: options.indexOf(correct), hintPos };
}

export const SIMON_BUTTONS = 6;
/** Round r (0-based) of 7 shows a sequence of r + 3 flashes. */
export function makeSimonSequence(round: number, rand: () => number = Math.random): number[] {
  return Array.from({ length: round + 3 }, () => Math.floor(rand() * SIMON_BUTTONS));
}

/** Surge charge: holding E fills ~25%/s, each tap adds 4%. */
export const SURGE_HOLD_PER_SEC = 25;
export const SURGE_TAP = 4;
export const addSurge = (pct: number, amount: number) => Math.min(100, pct + amount);
