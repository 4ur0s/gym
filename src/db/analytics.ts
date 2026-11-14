import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { Exercise, InBody, Measurement, Template, WorkSet, Workout } from './types'
import { bestScore, isPlateau, score, type SessionPoint } from '../logic/training'

export interface ExSession { workout: Workout; sets: WorkSet[]; best: number }

export interface ExStats {
  ex: Exercise
  sessions: ExSession[]
  points: SessionPoint[]
  plateau: boolean
  current: number
  first: number
  bestSet?: WorkSet
  maxWeight: number
}

export interface Analytics {
  exercises: Map<string, Exercise>
  templates: Template[]
  workouts: Workout[] // done, oldest first
  active?: Workout
  sets: WorkSet[] // done sets of done workouts
  stats: Map<string, ExStats>
  records: Set<string>
  measurements: Measurement[]
  inbody: InBody[]
}

export function buildAnalytics(
  exercises: Exercise[], templates: Template[], workouts: Workout[], sets: WorkSet[], measurements: Measurement[], inbody: InBody[],
): Analytics {
  const exMap = new Map(exercises.map((e) => [e.id, e]))
  const done = workouts.filter((w) => w.status === 'done').sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt)
  const doneIds = new Set(done.map((w) => w.id))
  const doneSets = sets.filter((s) => s.done && doneIds.has(s.workoutId))
  const wById = new Map(done.map((w) => [w.id, w]))

  const byEx = new Map<string, Map<string, WorkSet[]>>()
  for (const s of doneSets) {
    const m = byEx.get(s.exerciseId) ?? new Map<string, WorkSet[]>()
    m.set(s.workoutId, [...(m.get(s.workoutId) ?? []), s])
    byEx.set(s.exerciseId, m)
  }

  const stats = new Map<string, ExStats>()
  const records = new Set<string>()
  for (const [exId, m] of byEx) {
    const ex = exMap.get(exId)
    if (!ex) continue
    const sessions: ExSession[] = [...m.entries()]
      .map(([wid, ss]) => ({ workout: wById.get(wid)!, sets: ss.sort((a, b) => a.idx - b.idx), best: bestScore(ss, ex.unit) }))
      .sort((a, b) => a.workout.date.localeCompare(b.workout.date) || a.workout.startedAt - b.workout.startedAt)
    let prevBest = 0
    let bestSet: WorkSet | undefined
    let maxWeight = 0
    sessions.forEach((sess, i) => {
      for (const s of sess.sets) {
        const sc = score(s, ex.unit)
        if (i > 0 && sc > prevBest && (!bestSet || sc > score(bestSet, ex.unit))) records.add(s.id)
        if (!bestSet || sc > score(bestSet, ex.unit)) bestSet = s
        maxWeight = Math.max(maxWeight, s.weight)
      }
      prevBest = Math.max(prevBest, sess.best)
    })
    const points = sessions.map((s) => ({ date: s.workout.date, best: s.best }))
    stats.set(exId, {
      ex, sessions, points, plateau: isPlateau(points), bestSet, maxWeight,
      current: sessions[sessions.length - 1]?.best ?? 0, first: sessions[0]?.best ?? 0,
    })
  }

  return {
    exercises: exMap,
    templates: [...templates].sort((a, b) => a.order - b.order),
    workouts: done,
    active: workouts.find((w) => w.status === 'active'),
    sets: doneSets,
    stats,
    records,
    measurements: [...measurements].sort((a, b) => a.date.localeCompare(b.date)),
    inbody: [...inbody].sort((a, b) => a.date.localeCompare(b.date)),
  }
}

export function useAnalytics(): Analytics | undefined {
  return useLiveQuery(async () => {
    const [ex, t, w, s, m, ib] = await Promise.all([
      db.exercises.toArray(), db.templates.toArray(), db.workouts.toArray(), db.sets.toArray(),
      db.measurements.toArray(), db.inbody.toArray(),
    ])
    return buildAnalytics(ex, t, w, s, m, ib)
  })
}

/** Exercises in the order they appear in templates, then the rest */
export function orderedExerciseIds(a: Analytics): string[] {
  const seen: string[] = []
  for (const t of a.templates) for (const g of t.groups) for (const id of g) if (!seen.includes(id)) seen.push(id)
  for (const id of a.stats.keys()) if (!seen.includes(id)) seen.push(id)
  return seen
}
