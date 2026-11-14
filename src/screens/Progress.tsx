import { useState } from 'react'
import { useAnalytics, orderedExerciseIds, type Analytics, type ExStats } from '../db/analytics'
import { GROUPS, groupColor } from '../db/types'
import { addDays, fmtMinutes, fmtShort, today, weekStart } from '../logic/dates'
import { fmtSet, hardSetsByGroup, progression, round1, VOLUME_TARGET } from '../logic/training'
import { LineChart, Sparkline } from '../components/charts'
import { PageShell, useNav } from '../components/nav'

const WEEK_TARGET = 3

const valueLabel = (s: ExStats) => (s.ex.unit === 'kg' ? 'расчётный максимум, кг' : s.ex.unit === 'sec' ? 'лучший подход, сек' : 'лучший подход, повт')
const signed = (n: number) => (n > 0 ? `+${round1(n)}` : `${round1(n)}`)

export function ProgressScreen() {
  const a = useAnalytics()
  const nav = useNav()
  if (!a) return <main className="screen" />
  const monday = weekStart(today())
  const weekW = a.workouts.filter((w) => w.date >= monday)
  const weekIds = new Set(weekW.map((w) => w.id))
  const weekSets = a.sets.filter((s) => weekIds.has(s.workoutId))
  const records = weekSets.filter((s) => a.records.has(s.id)).length
  const time = weekW.reduce((t, w) => t + (w.finishedAt && !w.imported ? w.finishedAt - w.startedAt : 0), 0)
  const vol = hardSetsByGroup(weekSets.filter((s) => a.exercises.has(s.exerciseId)).map((s) => ({ ...s, group: a.exercises.get(s.exerciseId)!.group })))
  const inTemplates = new Set(a.templates.flatMap((t) => t.groups.flat()))
  const all = orderedExerciseIds(a).filter((id) => a.stats.has(id))
  const ids = all.filter((id) => inTemplates.has(id))
  const old = all.filter((id) => !inTemplates.has(id))
  const row = (id: string) => {
    const s = a.stats.get(id)!
    const color = groupColor(s.ex.group)
    const delta = s.current - s.first
    return (
      <button className="row" key={id} style={{ width: '100%' }} onClick={() => nav.push({ t: 'exercise', id })}>
        <div className="row-main">
          <div className="row-title" style={{ fontWeight: 600 }}>{s.ex.name}</div>
          <div className="small"><span style={{ color }}>{s.ex.muscle}</span>{s.plateau && inTemplates.has(id) && <span className="warn"> · плато 4 нед</span>}</div>
        </div>
        <Sparkline values={s.points.slice(-12).map((p) => p.best)} color={color} />
        <div style={{ textAlign: 'right', minWidth: 52 }}>
          <div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{round1(s.current)}</div>
          <div className={`num small ${delta > 0 ? 'up' : 'muted'}`} style={{ fontSize: 10 }}>{s.sessions.length > 1 ? signed(delta) : 'новое'}</div>
        </div>
      </button>
    )
  }

  return (
    <main className="screen">
      <h1 className="screen-title">Прогресс</h1>
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 600 }}>Эта неделя</span>
          <span className="muted small">{weekW.length} из {WEEK_TARGET} тренировок</span>
        </div>
        <div className="stat-row">
          <div><div className="num">{records}</div><div className="muted small">рекордов</div></div>
          <div><div className="num">{time ? fmtMinutes(time) : '—'}</div><div className="muted small">в зале</div></div>
          <div><div className="num">{weekSets.length}</div><div className="muted small">подходов</div></div>
        </div>
        {GROUPS.map((g) => (
          <div className="vol-row" key={g.id}>
            <span>{g.label}</span>
            <span className="bar"><span style={{ width: `${Math.min(vol[g.id] / 16, 1) * 100}%`, background: g.color }} /></span>
            <span className={`num${vol[g.id] < VOLUME_TARGET ? ' warn' : ''}`} style={{ textAlign: 'right', fontWeight: 500 }}>{vol[g.id]}</span>
          </div>
        ))}
        <p className="muted small" style={{ marginTop: 8 }}>Тяжёлые подходы (RIR ≤ 3), цель — от {VOLUME_TARGET} на группу</p>
      </div>

      <p className="section-label">Упражнения</p>
      <div className="card">
        {ids.length === 0 && <div className="empty">Здесь появятся упражнения после первой тренировки</div>}
        {ids.map(row)}
      </div>
      {old.length > 0 && <>
        <p className="section-label">Старые упражнения</p>
        <div className="card">{old.map(row)}</div>
      </>}
    </main>
  )
}

const PERIODS = [{ id: 30, label: 'Месяц' }, { id: 91, label: '3 мес' }, { id: 0, label: 'Всё' }]

export function ExerciseDetail({ id }: { id: string }) {
  const a = useAnalytics()
  const [period, setPeriod] = useState(0)
  if (!a) return null
  const s = a.stats.get(id)
  const ex = a.exercises.get(id)
  if (!ex) return null
  return (
    <PageShell back="Прогресс">
      <div className="small" style={{ color: groupColor(ex.group) }}>{ex.muscle}</div>
      <h1 className="screen-title">{ex.name}</h1>
      {!s ? <div className="empty">Ещё нет записей</div> : <Detail a={a} s={s} period={period} setPeriod={setPeriod} />}
    </PageShell>
  )
}

function Detail({ s, period, setPeriod }: { a: Analytics; s: ExStats; period: number; setPeriod: (n: number) => void }) {
  const color = groupColor(s.ex.group)
  const from = period ? addDays(today(), -period) : ''
  const pts = s.points.filter((p) => p.date >= from).map((p) => ({ date: p.date, value: round1(p.best) }))
  const last = s.sessions[s.sessions.length - 1]
  const adv = progression(s.ex, last.sets)
  return (
    <>
      <div className="stat-row">
        <div><div className="muted small">{valueLabel(s)}</div><div className="num" style={{ fontSize: 26 }}>{round1(s.current)}</div></div>
        <div><div className="muted small">с начала</div><div className={`num ${s.current - s.first > 0 ? 'up' : ''}`} style={{ fontSize: 26 }}>{signed(s.current - s.first)}</div></div>
      </div>
      <div className="chips" style={{ marginBottom: 8 }}>
        {PERIODS.map((p) => <button key={p.id} className="chip" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
      </div>
      <LineChart points={pts} color={color} />
      {s.plateau && <p className="warn small" style={{ marginTop: 6 }}>Плато: 4 недели без роста. Можно сменить схему повторов или вариацию упражнения.</p>}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row"><span className="muted">Лучший подход</span><span className="num small">{s.bestSet ? fmtSet(s.bestSet, s.ex.unit, true) : '—'}</span></div>
        {s.ex.unit === 'kg' && <div className="row"><span className="muted">Рекорд веса</span><span className="num small">{s.maxWeight} кг</span></div>}
        <div className="row"><span className="muted">Дальше</span><span className={`small ${adv.kind === 'up' ? 'up' : ''}`} style={{ textAlign: 'right', fontWeight: 600 }}>{adv.text}</span></div>
      </div>
      <p className="section-label">Последние тренировки</p>
      <div className="card">
        {[...s.sessions].reverse().slice(0, 8).map((sess) => (
          <div className="row" key={sess.workout.id}>
            <span className="muted small">{fmtShort(sess.workout.date)}</span>
            <span className="num small" style={{ textAlign: 'right' }}>{sess.sets.map((x) => fmtSet(x, s.ex.unit)).join(' · ')}</span>
          </div>
        ))}
      </div>
    </>
  )
}
