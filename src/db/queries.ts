import { db, uid } from './db'
import type { Exercise, Template, WorkSet, Workout } from './types'
import { today } from '../logic/dates'
import { prefill } from '../logic/training'

export interface Session { workout: Workout; sets: WorkSet[] }

/** Finished sessions of one exercise, oldest first */
export async function exerciseSessions(exerciseId: string): Promise<Session[]> {
  const sets = (await db.sets.where('exerciseId').equals(exerciseId).toArray()).filter((s) => s.done)
  const byWorkout = new Map<string, WorkSet[]>()
  for (const s of sets) byWorkout.set(s.workoutId, [...(byWorkout.get(s.workoutId) ?? []), s])
  const workouts = await db.workouts.bulkGet([...byWorkout.keys()])
  return workouts
    .filter((w): w is Workout => !!w && w.status === 'done')
    .map((w) => ({ workout: w, sets: byWorkout.get(w.id)!.sort((a, b) => a.idx - b.idx) }))
    .sort((a, b) => a.workout.date.localeCompare(b.workout.date) || a.workout.startedAt - b.workout.startedAt)
}

export async function lastSession(exerciseId: string): Promise<Session | undefined> {
  const all = await exerciseSessions(exerciseId)
  return all[all.length - 1]
}

export async function orderedTemplates(): Promise<Template[]> {
  return db.templates.orderBy('order').toArray()
}

/** Templates go in turn: A, Б, A, Б… (gives the 2-week A/Б/A — Б/A/Б rotation) */
export async function nextTemplate(): Promise<Template | undefined> {
  const templates = await orderedTemplates()
  if (!templates.length) return undefined
  const done = await db.workouts.where('status').equals('done').toArray()
  const last = done.filter((w) => !w.imported || true).sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt)[0]
  if (!last) return templates[0]
  const i = templates.findIndex((t) => t.id === last.templateId)
  return templates[(i + 1) % templates.length] ?? templates[0]
}

export async function startWorkout(template: Template): Promise<string> {
  const id = uid()
  const date = today()
  const exIds = template.groups.flat()
  const exercises = (await db.exercises.bulkGet(exIds)).filter((e): e is Exercise => !!e)
  const sets: WorkSet[] = []
  for (const [order, ex] of exercises.entries()) {
    const last = await lastSession(ex.id)
    prefill(ex, last?.sets ?? []).forEach((p, i) =>
      sets.push({ id: uid(), workoutId: id, exerciseId: ex.id, date, idx: order * 100 + i, weight: p.weight, reps: p.reps, rir: p.rir, done: false }))
  }
  await db.transaction('rw', db.workouts, db.sets, async () => {
    await db.workouts.add({ id, date, templateId: template.id, templateName: template.name, startedAt: Date.now(), status: 'active' })
    await db.sets.bulkAdd(sets)
  })
  return id
}

export async function finishWorkout(id: string) {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    const undone = await db.sets.where('workoutId').equals(id).filter((s) => !s.done).primaryKeys()
    await db.sets.bulkDelete(undone)
    const left = await db.sets.where('workoutId').equals(id).count()
    if (left === 0) await db.workouts.delete(id)
    else await db.workouts.update(id, { status: 'done', finishedAt: Date.now() })
  })
}

export async function deleteWorkout(id: string) {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    await db.sets.where('workoutId').equals(id).delete()
    await db.workouts.delete(id)
  })
}

export async function addSet(workoutId: string, exerciseId: string) {
  const existing = await db.sets.where('workoutId').equals(workoutId).filter((s) => s.exerciseId === exerciseId).toArray()
  const last = existing.sort((a, b) => a.idx - b.idx)[existing.length - 1]
  const w = await db.workouts.get(workoutId)
  await db.sets.add({ id: uid(), workoutId, exerciseId, date: w?.date ?? today(), idx: (last?.idx ?? -1) + 1, weight: last?.weight ?? 0, reps: last?.reps ?? 0, rir: last?.rir ?? null, done: false })
}
