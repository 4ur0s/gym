import type { Exercise, Group, InBody, Measurement, WorkSet, Workout } from '../db/types'
import { GROUPS } from '../db/types'
import { fmtDotted, fmtMinutes, fmtWeekRange, parseDate } from './dates'
import { fmtW, hardSetsByGroup, VOLUME_TARGET } from './training'

const WD = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']

const LABELS: Record<string, string> = {
  weight: 'вес', waist: 'талия', chest: 'грудь', shoulders: 'плечи', biceps: 'бицепс',
  forearm: 'предплечье', hips: 'бёдра', thigh: 'бедро', calf: 'голень', neck: 'шея',
}

export interface WeekData {
  monday: string
  workouts: Workout[]
  sets: WorkSet[]
  exercises: Map<string, Exercise>
  records: Set<string>
  plateaus: string[]
  measurements: Measurement[]
  inbody: InBody[]
}

function exerciseLine(ex: Exercise | undefined, es: WorkSet[], isRecord: boolean): string {
  const unit = ex?.unit ?? 'kg'
  const sameW = es.every((s) => s.weight === es[0].weight)
  let body: string
  if (unit === 'kg' || es[0].weight > 0) {
    const p = unit === 'kg' ? '' : '+'
    body = sameW
      ? `${p}${fmtW(es[0].weight)}×${es.map((s) => s.reps).join(',')}`
      : es.map((s) => `${p}${fmtW(s.weight)}×${s.reps}`).join(', ')
  } else {
    body = es.map((s) => s.reps).join(',') + (unit === 'sec' ? ' с' : '')
  }
  const rirs = [...new Set(es.map((s) => s.rir).filter((r) => r != null))]
  const rir = rirs.length ? ` rir${rirs.join('-')}` : ''
  return `${ex?.name ?? '?'} ${body}${rir}${isRecord ? ' ↑ рекорд' : ''}`
}

export function weekText(d: WeekData, weekNo: number): string {
  const lines: string[] = []
  const done = d.workouts.filter((w) => w.status === 'done').sort((a, b) => a.date.localeCompare(b.date))
  lines.push(`Неделя ${weekNo} (${fmtWeekRange(d.monday)}), тренировок: ${done.length}`)

  for (const w of done) {
    const dur = w.finishedAt && !w.imported ? ` · ${fmtMinutes(w.finishedAt - w.startedAt)}` : ''
    lines.push('', `${WD[parseDate(w.date).getDay()]} ${fmtDotted(w.date)} · ${w.templateName}${dur}`)
    const ws = d.sets.filter((s) => s.workoutId === w.id && s.done).sort((a, b) => a.idx - b.idx)
    const order: string[] = []
    for (const s of ws) if (!order.includes(s.exerciseId)) order.push(s.exerciseId)
    for (const exId of order) {
      const es = ws.filter((s) => s.exerciseId === exId)
      lines.push(exerciseLine(d.exercises.get(exId), es, es.some((s) => d.records.has(s.id))))
    }
  }

  const body: string[] = []
  const lastM = [...d.measurements].sort((a, b) => b.date.localeCompare(a.date))[0]
  if (lastM) {
    body.push(Object.entries(lastM.values).map(([k, v]) => `${LABELS[k] ?? k} ${v}`).join(' · ') + ` (${fmtDotted(lastM.date)})`)
  }
  for (const ib of d.inbody) {
    body.push(`InBody ${fmtDotted(ib.date)}: вес ${ib.weight ?? '—'} · SMM ${ib.smm ?? '—'} · жир ${ib.fatPct ?? '—'}%`)
  }
  if (body.length) lines.push('', 'Тело: ' + body.join('; '))

  const vol = hardSetsByGroup(
    d.sets
      .filter((s) => s.done && d.exercises.has(s.exerciseId))
      .map((s) => ({ ...s, group: d.exercises.get(s.exerciseId)!.group as Group })),
  )
  lines.push('', 'Подходы: ' + GROUPS.map((g) => `${g.label.toLowerCase()} ${vol[g.id]}${vol[g.id] < VOLUME_TARGET ? ' (мало)' : ''}`).join(' · '))
  if (d.plateaus.length) lines.push('Плато: ' + d.plateaus.join(', '))
  return lines.join('\n')
}
