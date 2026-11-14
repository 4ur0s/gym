import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { IconAdjustmentsHorizontal, IconCheck, IconPlayerPlay, IconPlus } from '@tabler/icons-react'
import { db } from '../db/db'
import { useAnalytics, type Analytics } from '../db/analytics'
import { addSet, finishWorkout, deleteWorkout, nextTemplate, setSkipped, startWorkout } from '../db/queries'
import { groupColor, type Exercise, type Template, type WorkSet, type Workout } from '../db/types'
import { fmtLong, today } from '../logic/dates'
import { fmtSet, progression, score } from '../logic/training'
import { NumField } from '../components/NumField'
import { useNav } from '../components/nav'

export function WorkoutScreen() {
  const a = useAnalytics()
  const nav = useNav()
  if (!a) return <main className="screen" />
  return (
    <main className="screen">
      <div className="topbar">
        <span className="eyebrow">{fmtLong(a.active?.date ?? today())}</span>
        <button className="icon-btn" aria-label="Шаблоны" onClick={() => nav.push({ t: 'templates' })}>
          <IconAdjustmentsHorizontal size={22} stroke={1.8} />
        </button>
      </div>
      {a.active ? <ActiveWorkout a={a} workout={a.active} /> : <PreStart a={a} />}
    </main>
  )
}

const scheme = (ex: Exercise) =>
  `${ex.sets} × ${ex.repMin}–${ex.repMax}${ex.unit === 'sec' ? ' с' : ''} · RIR ${ex.rirMin === ex.rirMax ? ex.rirMin : `${ex.rirMin}–${ex.rirMax}`}`

const lastSets = (a: Analytics, exId: string) => {
  const s = a.stats.get(exId)?.sessions
  return s?.[s.length - 1]?.sets ?? []
}

function PreStart({ a }: { a: Analytics }) {
  const suggested = useLiveQuery(() => nextTemplate(), [a.workouts.length])
  const [chosen, setChosen] = useState<string>()
  const t = a.templates.find((x) => x.id === (chosen ?? suggested?.id)) ?? a.templates[0]
  if (!t) return <div className="empty">Создай шаблон тренировки через кнопку справа сверху</div>
  const count = t.groups.flat().length
  return (
    <>
      <h1 className="screen-title">{t.name}</h1>
      {a.templates.length > 1 && (
        <div className="chips" style={{ marginBottom: 12 }}>
          {a.templates.map((x) => (
            <button key={x.id} className="chip" aria-pressed={x.id === t.id} onClick={() => setChosen(x.id)}>
              {x.name}{x.id === suggested?.id ? ' · по очереди' : ''}
            </button>
          ))}
        </div>
      )}
      <p className="muted small" style={{ marginBottom: 12 }}>{count} упражнений</p>
      <button className="btn btn-primary" onClick={() => startWorkout(t)} disabled={!count}>
        <IconPlayerPlay size={18} aria-hidden /> Начать тренировку
      </button>
      <div style={{ marginTop: 14 }}>
        {t.groups.map((g, gi) => (
          <div className="card" key={gi}>
            {g.length > 1 && <div className="superset-label"><span>Суперсет</span></div>}
            {g.map((id) => {
              const ex = a.exercises.get(id)
              if (!ex) return null
              const last = lastSets(a, id)
              return (
                <div className="row" key={id}>
                  <span className="dot" style={{ background: groupColor(ex.group) }} />
                  <div className="row-main">
                    <div className="row-title">{ex.name}</div>
                    <div className="small"><span style={{ color: groupColor(ex.group) }}>{ex.muscle}</span><span className="muted"> · {scheme(ex)}</span></div>
                  </div>
                  <span className="num small" style={{ fontWeight: 700 }}>{last[0] ? fmtSet(last[0], ex.unit) : '—'}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

function ActiveWorkout({ a, workout }: { a: Analytics; workout: Workout }) {
  const sets = useLiveQuery(() => db.sets.where('workoutId').equals(workout.id).toArray(), [workout.id]) ?? []
  const template = a.templates.find((t) => t.id === workout.templateId)
  const [openId, setOpenId] = useState<string>()

  const groups = useMemo(() => buildGroups(template, sets), [template, sets])
  const byEx = useMemo(() => {
    const m = new Map<string, WorkSet[]>()
    for (const s of [...sets].sort((x, y) => x.idx - y.idx)) m.set(s.exerciseId, [...(m.get(s.exerciseId) ?? []), s])
    return m
  }, [sets])

  const skipped = new Set(workout.skipped ?? [])
  const firstUndone = groups.flat().find((id) => !skipped.has(id) && (byEx.get(id) ?? []).some((s) => !s.done))
  const current = openId ?? firstUndone

  const finish = async () => {
    const undone = sets.filter((s) => !s.done && !skipped.has(s.exerciseId)).length
    if (undone && !confirm(`Не отмечено подходов: ${undone}. Они не сохранятся. Закончить?`)) return
    await finishWorkout(workout.id)
  }
  const cancel = async () => {
    if (confirm('Удалить эту тренировку целиком?')) await deleteWorkout(workout.id)
  }

  return (
    <>
      <h1 className="screen-title">{workout.templateName}</h1>
      {groups.map((g, gi) => (
        <div className="card" key={gi}>
          {g.length > 1 && <div className="superset-label"><span>Суперсет</span></div>}
          {g.map((id) => {
            const ex = a.exercises.get(id)
            if (!ex) return null
            return (
              <ExerciseBlock key={id} ex={ex} a={a} sets={byEx.get(id) ?? []} workoutId={workout.id}
                skipped={skipped.has(id)} onSkip={(v) => { setSkipped(workout, id, v); if (v) setOpenId(undefined) }}
                open={current === id} onToggle={() => setOpenId(current === id ? '__none' : id)} />
            )
          })}
        </div>
      ))}
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-outline" onClick={finish}>Закончить тренировку</button>
        <button className="btn btn-danger" onClick={cancel}>Удалить тренировку</button>
      </div>
    </>
  )
}

function buildGroups(t: Template | undefined, sets: WorkSet[]): string[][] {
  const present = new Set(sets.map((s) => s.exerciseId))
  const groups = (t?.groups ?? []).map((g) => g.filter((id) => present.has(id))).filter((g) => g.length)
  const listed = new Set(groups.flat())
  for (const id of present) if (!listed.has(id)) groups.push([id])
  return groups
}

function ExerciseBlock({ ex, a, sets, workoutId, open, onToggle, skipped, onSkip }: {
  ex: Exercise; a: Analytics; sets: WorkSet[]; workoutId: string; open: boolean; onToggle: () => void
  skipped: boolean; onSkip: (skip: boolean) => void
}) {
  const color = groupColor(ex.group)
  const prev = lastSets(a, ex.id)
  const prevBest = a.stats.get(ex.id)?.sessions.reduce((m, s) => Math.max(m, s.best), 0) ?? 0
  const doneSets = sets.filter((s) => s.done)
  const allDone = sets.length > 0 && doneSets.length === sets.length

  let hint: { text: string; up: boolean } | null = null
  if (allDone) {
    const adv = progression(ex, doneSets)
    hint = { text: adv.kind === 'up' ? `↑ ${adv.text}` : adv.text, up: adv.kind === 'up' }
  } else if (prev.length) {
    const adv = progression(ex, prev)
    hint = adv.kind === 'up'
      ? { text: `↑ Новый вес${adv.weight ? `: ${adv.weight} кг` : ''} — в прошлый раз верх взят`, up: true }
      : { text: `Цель: ${ex.repMax}${ex.unit === 'sec' ? ' с' : ''} во всех подходах`, up: false }
  }

  return (
    <div style={{ opacity: (allDone || skipped) && !open ? 0.55 : 1 }} className="ex-block">
      <button className="ex-head" onClick={onToggle}>
        <span className="dot" style={{ background: color }} />
        <span className="row-main">
          <span className="row-title" style={{ display: 'block', fontWeight: open ? 600 : 500 }}>{ex.name}</span>
          <span className="small" style={{ color }}>{ex.muscle}</span>
          {open && <span className="small muted"> · {scheme(ex)}</span>}
        </span>
        {skipped
          ? <span className="small muted">не делал</span>
          : allDone
          ? <IconCheck size={18} color="var(--up)" aria-label="Готово" />
          : <span className="num small" style={{ fontWeight: 700 }}>{doneSets.length} / {sets.length}</span>}
      </button>
      {open && skipped && (
        <div className="ex-open">
          <button className="link small" onClick={() => onSkip(false)}>Вернуть упражнение</button>
        </div>
      )}
      {open && !skipped && (
        <div className="ex-open">
          {ex.note && <p className="ex-note">{ex.note}</p>}
          <div className="set-grid set-head"><span /><span>было</span><span>{ex.unit === 'kg' ? 'кг' : '+кг'}</span><span>{ex.unit === 'sec' ? 'сек' : 'повт'}</span><span>RIR</span><span /></div>
          {sets.map((s, i) => {
            const isRecord = s.done && prevBest > 0 && score(s, ex.unit) > prevBest
            return (
              <div className="set-grid" key={s.id}>
                <span className="muted small">{i + 1}</span>
                <span className="num muted" style={{ fontSize: 11, fontWeight: 500 }}>
                  {prev.length ? fmtSet(prev[i] ?? prev[prev.length - 1], ex.unit) : '—'}
                </span>
                <NumField className={`field${s.done ? ' done' : ''}`} value={s.weight} ariaLabel="Вес" onCommit={(v) => db.sets.update(s.id, { weight: v ?? 0 })} />
                <NumField className={`field${s.done ? ' done' : ''}`} value={s.reps} ariaLabel="Повторы" onCommit={(v) => db.sets.update(s.id, { reps: Math.round(v ?? 0) })} />
                <NumField className={`field${s.done ? ' done' : ''}`} value={s.rir} allowEmpty placeholder="–" ariaLabel="RIR" onCommit={(v) => db.sets.update(s.id, { rir: v })} />
                <button className={`check${s.done ? ' on' : ''}`} style={s.done ? { background: color } : undefined}
                  aria-label={s.done ? 'Снять отметку' : 'Подход сделан'} onClick={() => db.sets.update(s.id, { done: !s.done })}>
                  {s.done && <IconCheck size={16} stroke={2.5} />}
                </button>
                {isRecord && <span className="small up" style={{ gridColumn: '3 / -1', fontWeight: 600 }}>рекорд</span>}
              </div>
            )
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <button className="link small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => addSet(workoutId, ex.id)}>
              <IconPlus size={14} aria-hidden /> подход
            </button>
            {doneSets.length === 0 && <button className="small muted" style={{ fontWeight: 600 }} onClick={() => onSkip(true)}>Не делал</button>}
          </div>
          {hint && <p className={`hint${hint.up ? ' up' : ' muted'}`}>{hint.text}</p>}
        </div>
      )}
    </div>
  )
}

/** Ticking duration for the tab bar */
export function useElapsed(startedAt?: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!startedAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startedAt])
  return startedAt ? now - startedAt : 0
}
