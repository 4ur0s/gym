import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { IconChevronRight, IconPlus, IconTrash, IconArrowUp, IconArrowDown } from '@tabler/icons-react'
import { db, measureFields, setSetting, uid } from '../db/db'
import { useAnalytics, type Analytics } from '../db/analytics'
import { DEFAULT_MEASURE_FIELDS, type InBody, type MeasureField } from '../db/types'
import { fmtDayMonth, today } from '../logic/dates'
import { round1 } from '../logic/training'
import { Sparkline } from '../components/charts'
import { NumField } from '../components/NumField'
import { PageShell, useNav } from '../components/nav'

type Point = { date: string; value: number }

function series(a: Analytics, key: string): Point[] {
  const m = new Map<string, number>()
  if (key === 'weight') for (const ib of a.inbody) if (ib.weight) m.set(ib.date, ib.weight)
  for (const x of a.measurements) if (x.values[key] != null) m.set(x.date, x.values[key])
  if (key === 'fatPct' || key === 'smm') for (const ib of a.inbody) if (ib[key] != null) m.set(ib.date, ib[key]!)
  return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([date, value]) => ({ date, value }))
}

const TILES = [
  { key: 'weight', label: 'Вес', unit: 'кг', color: 'var(--g-back)', goodUp: true },
  { key: 'waist', label: 'Талия', unit: 'см', color: 'var(--g-core)', goodUp: false },
  { key: 'fatPct', label: 'Жир', unit: '%', color: 'var(--g-delts)', goodUp: false },
  { key: 'smm', label: 'Мышцы', unit: 'кг', color: 'var(--g-legs)', goodUp: true },
]

export function BodyScreen() {
  const a = useAnalytics()
  const fields = useLiveQuery(measureFields) ?? DEFAULT_MEASURE_FIELDS
  const nav = useNav()
  if (!a) return <main className="screen" />
  const lastIb = a.inbody[a.inbody.length - 1]
  return (
    <main className="screen">
      <div className="topbar" style={{ marginBottom: 0 }}>
        <h1 className="screen-title" style={{ margin: 0 }}>Тело</h1>
        <button className="icon-btn filled" aria-label="Записать замер" onClick={() => nav.push({ t: 'measure' })}><IconPlus size={20} stroke={2.2} /></button>
      </div>
      <div className="tiles" style={{ marginTop: 14 }}>
        {TILES.map((t) => {
          const s = series(a, t.key)
          const last = s[s.length - 1]
          const delta = s.length > 1 ? round1(last.value - s[0].value) : null
          const good = delta != null && delta !== 0 && (delta > 0) === t.goodUp
          return (
            <div className="tile" key={t.key}>
              <div className="small" style={{ color: t.color, fontWeight: 600 }}>{t.label}</div>
              <div style={{ marginTop: 4 }}><span className="num" style={{ fontSize: 20, fontWeight: 800 }}>{last ? last.value : '—'}</span> <span className="muted small">{t.unit}</span></div>
              <div className={`num small ${good ? 'up' : 'muted'}`} style={{ fontSize: 10, margin: '2px 0 6px' }}>
                {delta == null ? (last ? fmtDayMonth(last.date) : 'нет данных') : delta === 0 ? 'без изменений' : `${delta > 0 ? '+' : ''}${delta} с ${fmtDayMonth(s[0].date)}`}
              </div>
              <Sparkline values={s.map((p) => p.value)} color={t.color} width={130} />
            </div>
          )
        })}
      </div>
      <p className="section-label">Замеры</p>
      <div className="card">
        {fields.filter((f) => f.key !== 'weight' && f.key !== 'waist').map((f) => {
          const s = series(a, f.key)
          const last = s[s.length - 1]
          return (
            <div className="row" key={f.key}>
              <span>{f.label}</span>
              <span>
                <span className="num small" style={{ fontWeight: 600 }}>{last ? `${last.value} ${f.unit}` : '—'}</span>
                {last && <span className="muted small"> · {fmtDayMonth(last.date)}</span>}
              </span>
            </div>
          )
        })}
      </div>
      <div className="card" style={{ marginTop: 8 }}>
        <button className="row" style={{ width: '100%' }} onClick={() => nav.push({ t: 'inbody' })}>
          <span>InBody</span>
          <span className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{lastIb ? fmtDayMonth(lastIb.date) : 'добавить'}<IconChevronRight size={16} /></span>
        </button>
        <button className="row" style={{ width: '100%' }} onClick={() => nav.push({ t: 'fields' })}>
          <span>Изменить список замеров</span><IconChevronRight size={16} color="var(--text-2)" />
        </button>
      </div>
    </main>
  )
}

export function MeasurePage() {
  const a = useAnalytics()
  const fields = useLiveQuery(measureFields)
  const nav = useNav()
  const [date, setDate] = useState(today())
  const [vals, setVals] = useState<Record<string, number>>({})
  if (!a || !fields) return null
  const lastOf = (k: string) => series(a, k).slice(-1)[0]?.value
  const save = async () => {
    if (!Object.keys(vals).length) return nav.pop()
    const existing = a.measurements.find((m) => m.date === date)
    if (existing) await db.measurements.update(existing.id, { values: { ...existing.values, ...vals } })
    else await db.measurements.add({ id: uid(), date, values: vals })
    nav.toast('Замер сохранён')
    nav.pop()
  }
  return (
    <PageShell back="Тело" right={<button className="link" onClick={save}>Сохранить</button>}>
      <h1 className="screen-title">Новый замер</h1>
      <div className="card">
        <div className="form-row"><span>Дата</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {fields.map((f) => (
          <div className="form-row" key={f.key}>
            <span>{f.label}, {f.unit}</span>
            <NumField className="input" value={vals[f.key] ?? null} placeholder={lastOf(f.key)?.toString() ?? ''} allowEmpty
              onCommit={(v) => setVals((p) => { const n = { ...p }; if (v == null) delete n[f.key]; else n[f.key] = v; return n })} />
          </div>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 8 }}>Серым — прошлое значение. Заполняй только то, что мерил.</p>
    </PageShell>
  )
}

const IB_FIELDS: { key: keyof InBody; label: string }[] = [
  { key: 'weight', label: 'Вес, кг' }, { key: 'smm', label: 'Скелетные мышцы (SMM), кг' }, { key: 'ffm', label: 'Безжировая масса, кг' },
  { key: 'fatKg', label: 'Жир, кг' }, { key: 'fatPct', label: 'Жир, %' }, { key: 'water', label: 'Вода, л' },
  { key: 'visceral', label: 'Висцеральный жир' }, { key: 'score', label: 'Балл' },
]

export function InBodyPage() {
  const a = useAnalytics()
  const nav = useNav()
  const [draft, setDraft] = useState<InBody | null>(null)
  if (!a) return null
  if (draft) {
    const save = async () => { await db.inbody.put(draft); nav.toast('InBody сохранён'); setDraft(null) }
    return (
      <PageShell back="Тело" right={<button className="link" onClick={save}>Сохранить</button>}>
        <h1 className="screen-title">InBody</h1>
        <div className="card">
          <div className="form-row"><span>Дата</span><input className="input" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></div>
          {IB_FIELDS.map((f) => (
            <div className="form-row" key={f.key}>
              <span>{f.label}</span>
              <NumField className="input" value={(draft[f.key] as number | undefined) ?? null} allowEmpty onCommit={(v) => setDraft({ ...draft, [f.key]: v ?? undefined })} />
            </div>
          ))}
        </div>
      </PageShell>
    )
  }
  const list = [...a.inbody].reverse()
  return (
    <PageShell back="Тело">
      <h1 className="screen-title">InBody</h1>
      <button className="btn btn-primary" onClick={() => setDraft({ id: uid(), date: today() })}><IconPlus size={18} aria-hidden /> Добавить InBody</button>
      {list.map((ib) => (
        <div className="card" key={ib.id} style={{ marginTop: 10 }}>
          <div className="row"><span style={{ fontWeight: 600 }}>{fmtDayMonth(ib.date)}</span>
            <span style={{ display: 'flex', gap: 14 }}>
              <button className="link small" onClick={() => setDraft(ib)}>Изменить</button>
              <button className="icon-btn" aria-label="Удалить" onClick={() => confirm('Удалить эту запись InBody?') && db.inbody.delete(ib.id)}><IconTrash size={16} /></button>
            </span>
          </div>
          {IB_FIELDS.filter((f) => ib[f.key] != null).map((f) => (
            <div className="row" key={f.key}><span className="muted small">{f.label}</span><span className="num small">{ib[f.key] as number}</span></div>
          ))}
        </div>
      ))}
    </PageShell>
  )
}

export function FieldsPage() {
  const fields = useLiveQuery(measureFields)
  const [name, setName] = useState('')
  if (!fields) return null
  const save = (f: MeasureField[]) => setSetting('measureFields', f)
  const move = (i: number, d: number) => {
    const f = [...fields]; const [x] = f.splice(i, 1); f.splice(i + d, 0, x); save(f)
  }
  return (
    <PageShell back="Тело">
      <h1 className="screen-title">Замеры</h1>
      <div className="card">
        {fields.map((f, i) => (
          <div className="form-row" key={f.key}>
            <input className="input wide" value={f.label} onChange={(e) => save(fields.map((x) => (x.key === f.key ? { ...x, label: e.target.value } : x)))} />
            <span style={{ display: 'flex', gap: 2 }}>
              <button className="icon-btn" aria-label="Выше" disabled={i === 0} onClick={() => move(i, -1)}><IconArrowUp size={16} /></button>
              <button className="icon-btn" aria-label="Ниже" disabled={i === fields.length - 1} onClick={() => move(i, 1)}><IconArrowDown size={16} /></button>
              {f.key !== 'weight' && f.key !== 'waist' && (
                <button className="icon-btn" aria-label="Убрать" onClick={() => confirm(`Убрать «${f.label}» из списка? Старые значения останутся в данных.`) && save(fields.filter((x) => x.key !== f.key))}><IconTrash size={16} /></button>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 8 }}>
        <div className="form-row">
          <input className="input wide" placeholder="Новый замер, например «Бицепс левый»" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="link" onClick={() => { if (name.trim()) { save([...fields, { key: `m_${uid().slice(0, 8)}`, label: name.trim(), unit: 'см' }]); setName('') } }}>Добавить</button>
        </div>
      </div>
    </PageShell>
  )
}
