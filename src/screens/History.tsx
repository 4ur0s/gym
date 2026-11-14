import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { IconCopy, IconCheck, IconDatabase, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { useAnalytics, type Analytics } from '../db/analytics'
import { getSetting } from '../db/db'
import { deleteWorkout } from '../db/queries'
import { exportBackup, importBackup, markExported, shareOrDownload } from '../db/backup'
import type { Workout } from '../db/types'
import { addDays, daysBetween, fmtMinutes, fmtShort, fmtWeekRange, weekStart } from '../logic/dates'
import { fmtSet } from '../logic/training'
import { weekText } from '../logic/weekExport'
import { PageShell, useNav } from '../components/nav'

interface Week { monday: string; no: number; workouts: Workout[] }

function weeksOf(a: Analytics): Week[] {
  if (!a.workouts.length) return []
  const first = weekStart(a.workouts[0].date)
  const map = new Map<string, Workout[]>()
  for (const w of a.workouts) { const m = weekStart(w.date); map.set(m, [...(map.get(m) ?? []), w]) }
  return [...map.entries()].sort((x, y) => y[0].localeCompare(x[0]))
    .map(([monday, workouts]) => ({ monday, workouts, no: Math.round(daysBetween(first, monday) / 7) + 1 }))
}

export function buildWeekText(a: Analytics, week: Week) {
  const end = addDays(week.monday, 6)
  const ids = new Set(week.workouts.map((w) => w.id))
  return weekText({
    monday: week.monday,
    workouts: week.workouts,
    sets: a.sets.filter((s) => ids.has(s.workoutId)),
    exercises: a.exercises,
    records: a.records,
    plateaus: [...a.stats.values()].filter((s) => s.plateau && !s.ex.archived).map((s) => s.ex.name),
    measurements: a.measurements.filter((m) => m.date >= week.monday && m.date <= end),
    inbody: a.inbody.filter((m) => m.date >= week.monday && m.date <= end),
  }, week.no)
}

export function HistoryScreen() {
  const a = useAnalytics()
  const nav = useNav()
  const lastExport = useLiveQuery(() => getSetting<number>('lastExport', 0))
  const [open, setOpen] = useState<string>()
  const [copied, setCopied] = useState<string>()
  if (!a) return <main className="screen" />
  const weeks = weeksOf(a)
  const openWeek = open ?? weeks[0]?.monday
  const backupDays = lastExport ? Math.floor((Date.now() - lastExport) / 86400000) : null

  const copy = async (w: Week) => {
    await navigator.clipboard.writeText(buildWeekText(a, w))
    setCopied(w.monday)
    nav.toast('Скопировано — вставь в чат')
    setTimeout(() => setCopied(undefined), 2000)
  }

  return (
    <main className="screen">
      <div className="topbar" style={{ marginBottom: 0 }}>
        <h1 className="screen-title" style={{ margin: 0 }}>История</h1>
        <button className="icon-btn" aria-label="Данные и резервная копия" onClick={() => nav.push({ t: 'data' })}><IconDatabase size={21} stroke={1.8} /></button>
      </div>
      {a.workouts.length > 0 && (backupDays == null || backupDays >= 7) && (
        <button className="card card-pad small" style={{ width: '100%', marginTop: 12, color: 'var(--warn)' }} onClick={() => nav.push({ t: 'data' })}>
          {backupDays == null ? 'Резервной копии ещё нет — сохрани данные в файл' : `Резервная копия была ${backupDays} дн. назад — обнови`}
        </button>
      )}
      <div style={{ marginTop: 14 }}>
        {weeks.length === 0 && <div className="empty">Здесь появятся тренировки по неделям</div>}
        {weeks.map((w) => (
          <div className="card" key={w.monday}>
            <div className="row">
              <button className="row-main" onClick={() => setOpen(openWeek === w.monday ? '__none' : w.monday)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {openWeek === w.monday ? <IconChevronDown size={16} color="var(--text-2)" /> : <IconChevronRight size={16} color="var(--text-2)" />}
                <span>
                  <span style={{ fontWeight: 600, display: 'block' }}>Неделя {w.no}</span>
                  <span className="muted small">{fmtWeekRange(w.monday)} · {w.workouts.length} из 3</span>
                </span>
              </button>
              <button className="link small" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => copy(w)}>
                {copied === w.monday ? <IconCheck size={16} /> : <IconCopy size={16} />} Скопировать
              </button>
            </div>
            {openWeek === w.monday && [...w.workouts].reverse().map((wo) => <WorkoutRow key={wo.id} a={a} w={wo} />)}
          </div>
        ))}
      </div>
    </main>
  )
}

function WorkoutRow({ a, w }: { a: Analytics; w: Workout }) {
  const [open, setOpen] = useState(false)
  const sets = a.sets.filter((s) => s.workoutId === w.id).sort((x, y) => x.idx - y.idx)
  const records = sets.filter((s) => a.records.has(s.id)).length
  const order: string[] = []
  for (const s of sets) if (!order.includes(s.exerciseId)) order.push(s.exerciseId)
  const meta = [w.finishedAt && !w.imported ? fmtMinutes(w.finishedAt - w.startedAt) : null, records ? `рекордов: ${records}` : null].filter(Boolean).join(' · ')
  return (
    <div style={{ borderTop: '0.5px solid var(--separator)' }}>
      <button className="row" style={{ width: '100%' }} onClick={() => setOpen(!open)}>
        <span><span style={{ fontWeight: 500 }}>{w.templateName}</span><span className="muted small"> · {fmtShort(w.date)}</span></span>
        <span className="muted small">{meta}</span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px' }}>
          {order.map((id) => {
            const ex = a.exercises.get(id)
            const es = sets.filter((s) => s.exerciseId === id)
            return (
              <div key={id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '3px 0' }}>
                <span>{ex?.name ?? id}</span>
                <span className="num" style={{ textAlign: 'right' }}>{es.map((s) => fmtSet(s, ex?.unit ?? 'kg')).join(' · ')}</span>
              </div>
            )
          })}
          <button className="btn-danger small" style={{ marginTop: 8 }} onClick={() => confirm('Удалить эту тренировку?') && deleteWorkout(w.id)}>Удалить тренировку</button>
        </div>
      )}
    </div>
  )
}

export function DataPage() {
  const nav = useNav()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const doExport = async () => {
    setBusy(true)
    try {
      const { file } = await exportBackup()
      await shareOrDownload(file)
      await markExported()
      nav.toast('Копия сохранена')
    } catch { /* cancelled */ } finally { setBusy(false) }
  }
  const doImport = async (f: File) => {
    try { nav.toast(await importBackup(await f.text())) } catch (e) { alert((e as Error).message) }
  }
  return (
    <PageShell back="История">
      <h1 className="screen-title">Данные</h1>
      <p className="muted small" style={{ marginBottom: 12 }}>
        Все тренировки хранятся только на этом телефоне. Сохраняй копию в файл раз в неделю — например, в «Файлы» или себе в Telegram. Если удалить иконку или сменить телефон, данные вернутся из этого файла.
      </p>
      <button className="btn btn-primary" disabled={busy} onClick={doExport}>Сохранить копию в файл</button>
      <button className="btn btn-outline" onClick={() => input.current?.click()}>Загрузить из файла</button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = '' }} />
      <p className="muted small" style={{ marginTop: 10 }}>Загрузка добавляет записи из файла к текущим. Так же загружается перенесённая история с июля.</p>
    </PageShell>
  )
}
