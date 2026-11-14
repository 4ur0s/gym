import type { Exercise, Group, Unit, WorkSet } from '../db/types'
import { addDays } from './dates'

type SetLike = Pick<WorkSet, 'weight' | 'reps' | 'rir'>

export const round1 = (n: number) => Math.round(n * 10) / 10
/** Round to the exercise weight step (e.g. 2.5 kg) */
export const roundTo = (n: number, step: number) => (step > 0 ? round1(Math.round(n / step) * step) : round1(n))

/** Estimated one-rep max, Epley with reps in reserve: w × (1 + (reps + RIR) / 30) */
export function e1rm(weight: number, reps: number, rir: number | null = 0): number {
  if (weight <= 0 || reps <= 0) return 0
  return round1(weight * (1 + (reps + (rir ?? 0)) / 30))
}

/** Single number used for progress curves: e1RM for weighted lifts, reps/seconds otherwise */
export function score(set: SetLike, unit: Unit): number {
  if (unit === 'kg') return set.weight > 0 ? e1rm(set.weight, set.reps, set.rir) : set.reps
  return set.reps
}

export const bestScore = (sets: SetLike[], unit: Unit) => sets.reduce((m, s) => Math.max(m, score(s, unit)), 0)

export type Advice =
  | { kind: 'new'; text: string }
  | { kind: 'up'; weight?: number; text: string }
  | { kind: 'hold'; text: string }

const repWord = (unit: Unit) => (unit === 'sec' ? 'сек' : 'повторы')

/** Double progression: every set at the top of the range with RIR ≤ 2 → add one weight step */
export function progression(ex: Exercise, sets: SetLike[]): Advice {
  if (!sets.length) return { kind: 'new', text: `Подбери вес на ${ex.repMin}–${ex.repMax}` }
  const allTop = sets.every((s) => s.reps >= ex.repMax && (s.rir == null || s.rir <= 2))
  if (allTop) {
    if (ex.unit === 'kg') {
      const w = Math.max(...sets.map((s) => s.weight))
      const next = roundTo(w + ex.step, ex.step)
      return { kind: 'up', weight: next, text: `В следующий раз ${fmtW(next)} кг` }
    }
    return { kind: 'up', text: ex.unit === 'sec' ? `Верх взят — добавь ${ex.step} сек` : 'Верх взят — добавь подход или вес' }
  }
  const minReps = Math.min(...sets.map((s) => s.reps))
  return { kind: 'hold', text: `Держим вес, добирай ${repWord(ex.unit)} до ${ex.repMax} (сейчас ${minReps})` }
}

/** Numbers to pre-fill today's sets from the last session */
export function prefill(ex: Exercise, last: SetLike[]): SetLike[] {
  const adv = progression(ex, last)
  return Array.from({ length: ex.sets }, (_, i) => {
    const base = last[i] ?? last[last.length - 1]
    if (!base) return { weight: 0, reps: ex.repMin, rir: null }
    if (adv.kind === 'up' && adv.weight) return { weight: adv.weight, reps: ex.repMin, rir: base.rir }
    return { weight: base.weight, reps: base.reps, rir: base.rir }
  })
}

export interface SessionPoint { date: string; best: number }

/** Plateau: the best of the last 4 weeks is not above the best before them (needs ≥2 sessions in the window) */
export function isPlateau(sessions: SessionPoint[], weeks = 4): boolean {
  if (sessions.length < 3) return false
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted[sorted.length - 1].date
  const cutoff = addDays(last, -weeks * 7)
  const before = sorted.filter((s) => s.date <= cutoff)
  const window = sorted.filter((s) => s.date > cutoff)
  if (!before.length || window.length < 2) return false
  return Math.max(...window.map((s) => s.best)) <= Math.max(...before.map((s) => s.best))
}

/** Hard sets (RIR ≤ 3 or unknown) per muscle group */
export function hardSetsByGroup(sets: (SetLike & { done?: boolean; group: Group })[]): Record<Group, number> {
  const out: Record<Group, number> = { chest: 0, back: 0, legs: 0, delts: 0, arms: 0, core: 0 }
  for (const s of sets) if (s.done !== false && (s.rir == null || s.rir <= 3)) out[s.group]++
  return out
}
export const VOLUME_TARGET = 10

export const fmtW = (w: number) => (Number.isInteger(w) ? String(w) : String(round1(w)).replace('.', '.'))
export function fmtSet(s: SetLike, unit: Unit, withRir = false): string {
  const base = unit === 'kg' ? `${fmtW(s.weight)} × ${s.reps}` : unit === 'sec' ? `${s.reps} с` : s.weight > 0 ? `+${fmtW(s.weight)} × ${s.reps}` : `${s.reps}`
  return withRir && s.rir != null ? `${base} · RIR ${s.rir}` : base
}
