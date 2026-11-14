import { useRef, useState, type PointerEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { IconArrowDown, IconArrowUp, IconChevronRight, IconGripVertical, IconPlus, IconReplace, IconTrash } from '@tabler/icons-react'
import { db, uid } from '../db/db'
import { orderedTemplates } from '../db/queries'
import { GROUPS, groupColor, type Exercise, type Group, type Template, type Unit } from '../db/types'
import { NumField } from '../components/NumField'
import { PageShell, useNav } from '../components/nav'

export function TemplatesPage() {
  const templates = useLiveQuery(orderedTemplates)
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const nav = useNav()
  if (!templates || !exercises) return null
  const exName = (id: string) => exercises.find((e) => e.id === id)?.name ?? ''
  const move = async (i: number, d: number) => {
    const list = [...templates]; const [x] = list.splice(i, 1); list.splice(i + d, 0, x)
    await Promise.all(list.map((t, order) => db.templates.update(t.id, { order })))
  }
  const create = async () => {
    const id = uid()
    await db.templates.add({ id, name: 'Новая тренировка', order: templates.length, groups: [] })
    nav.push({ t: 'template', id })
  }
  return (
    <PageShell back="Тренировка">
      <h1 className="screen-title">Шаблоны</h1>
      <div className="card">
        {templates.map((t, i) => (
          <div className="row" key={t.id}>
            <button className="row-main" onClick={() => nav.push({ t: 'template', id: t.id })}>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div className="muted small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t.groups.flat().length} упр. · {t.groups.flat().slice(0, 3).map(exName).join(', ')}
              </div>
            </button>
            <span style={{ display: 'flex' }}>
              <button className="icon-btn" aria-label="Выше" disabled={i === 0} onClick={() => move(i, -1)}><IconArrowUp size={16} /></button>
              <button className="icon-btn" aria-label="Ниже" disabled={i === templates.length - 1} onClick={() => move(i, 1)}><IconArrowDown size={16} /></button>
            </span>
          </div>
        ))}
        <button className="row link" style={{ width: '100%' }} onClick={create}><span><IconPlus size={16} style={{ verticalAlign: -3 }} /> Новый шаблон</span></button>
      </div>
      <p className="section-label">Ротация</p>
      <div className="card card-pad small muted">
        Шаблоны идут по очереди в порядке этого списка: A, Б, A, Б… — это и есть неделя 1 A/Б/A, неделя 2 Б/A/Б. На экране тренировки можно выбрать другую вручную.
      </div>
    </PageShell>
  )
}

export function TemplatePage({ id }: { id: string }) {
  const t = useLiveQuery(() => db.templates.get(id), [id])
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const nav = useNav()
  const [picking, setPicking] = useState(false)
  if (!t || !exercises) return null
  const exMap = new Map(exercises.map((e) => [e.id, e]))
  const setGroups = (groups: string[][]) => db.templates.update(id, { groups: groups.filter((g) => g.length) })

  if (picking) {
    const inTpl = new Set(t.groups.flat())
    const add = async (exId: string) => {
      await db.exercises.update(exId, { archived: false })
      await setGroups([...t.groups, [exId]])
      setPicking(false)
    }
    const createNew = async () => {
      const ex: Exercise = { id: uid(), name: 'Новое упражнение', muscle: '', group: 'chest', sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, step: 2.5, unit: 'kg', note: '', archived: false }
      await db.exercises.add(ex)
      await setGroups([...t.groups, [ex.id]])
      setPicking(false)
      nav.push({ t: 'exEdit', id: ex.id, templateId: id })
    }
    return (
      <div className="page"><main className="screen">
        <div className="topbar"><button className="back" onClick={() => setPicking(false)}>Отмена</button></div>
        <h1 className="screen-title">Добавить упражнение</h1>
        <button className="btn btn-primary" onClick={createNew}><IconPlus size={18} aria-hidden /> Новое упражнение</button>
        <p className="section-label">Из твоих упражнений</p>
        <div className="card">
          {exercises.filter((e) => !inTpl.has(e.id)).sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name)).map((e) => (
            <button className="row" key={e.id} style={{ width: '100%' }} onClick={() => add(e.id)}>
              <span className="dot" style={{ background: groupColor(e.group) }} />
              <span className="row-main"><span className="row-title" style={{ display: 'block' }}>{e.name}</span><span className="small muted">{e.muscle}{e.archived ? ' · не в шаблонах' : ''}</span></span>
              <IconPlus size={16} color="var(--accent)" />
            </button>
          ))}
        </div>
      </main></div>
    )
  }

  return (
    <PageShell back="Шаблоны">
      <input className="input" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, height: 48, background: 'transparent', padding: 0, marginBottom: 6 }}
        value={t.name} onChange={(e) => db.templates.update(id, { name: e.target.value })} aria-label="Название шаблона" />
      <p className="muted small" style={{ marginBottom: 8 }}>Тяни ≡, чтобы поменять порядок. Тап по упражнению — настройки.</p>
      <GroupList t={t} exMap={exMap} setGroups={setGroups} onOpen={(exId) => nav.push({ t: 'exEdit', id: exId, templateId: id })} />
      <div className="card" style={{ marginTop: 8 }}>
        <button className="row link" style={{ width: '100%' }} onClick={() => setPicking(true)}><span><IconPlus size={16} style={{ verticalAlign: -3 }} /> Добавить упражнение</span></button>
      </div>
      <button className="btn btn-danger" style={{ marginTop: 16 }} onClick={async () => {
        if (confirm(`Удалить шаблон «${t.name}»? История тренировок останется.`)) { await db.templates.delete(id); nav.pop() }
      }}>Удалить шаблон</button>
    </PageShell>
  )
}

function GroupList({ t, exMap, setGroups, onOpen }: {
  t: Template; exMap: Map<string, Exercise>; setGroups: (g: string[][]) => void; onOpen: (id: string) => void
}) {
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)

  const onDown = (i: number) => (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ from: i, to: i })
  }
  const onMove = (e: PointerEvent) => {
    if (!drag) return
    let to = drag.from
    refs.current.forEach((el, j) => {
      if (!el) return
      const r = el.getBoundingClientRect()
      if (e.clientY > r.top + r.height / 2) to = j
      if (j === 0 && e.clientY < r.top + r.height / 2) to = 0
    })
    if (to !== drag.to) setDrag({ ...drag, to })
  }
  const onUp = () => {
    if (drag && drag.from !== drag.to) {
      const g = [...t.groups]; const [x] = g.splice(drag.from, 1); g.splice(drag.to, 0, x); setGroups(g)
    }
    setDrag(null)
  }

  const order = t.groups.map((_, i) => i)
  if (drag) { const [x] = order.splice(drag.from, 1); order.splice(drag.to, 0, x) }

  return (
    <div>
      {order.map((gi, pos) => {
        const g = t.groups[gi]
        return (
          <div key={g.join('+')} ref={(el) => { refs.current[pos] = el }} className={`card${drag?.from === gi ? ' dragging' : ''}`} style={{ marginTop: pos ? 8 : 0 }}>
            {g.length > 1 && (
              <div className="superset-label"><span>Суперсет</span>
                <button className="link small" style={{ fontSize: 11 }} onClick={() => setGroups(t.groups.flatMap((x, k) => (k === gi ? x.map((id) => [id]) : [x])))}>разъединить</button>
              </div>
            )}
            {g.map((id, k) => {
              const ex = exMap.get(id)
              return (
                <div className="row" key={id}>
                  {k === 0
                    ? <span className="drag-handle" onPointerDown={onDown(gi)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label="Перетащить"><IconGripVertical size={18} /></span>
                    : <span style={{ width: 26 }} />}
                  <button className="row-main" onClick={() => onOpen(id)}>
                    <span className="row-title" style={{ display: 'block' }}>{ex?.name ?? id}</span>
                    <span className="small" style={{ color: ex ? groupColor(ex.group) : undefined }}>{ex?.muscle}</span>
                    {ex && <span className="small muted"> · {ex.sets} × {ex.repMin}–{ex.repMax}</span>}
                  </button>
                  <IconChevronRight size={16} color="var(--text-2)" />
                </div>
              )
            })}
            {g.length === 1 && gi < t.groups.length - 1 && t.groups[gi + 1].length === 1 && (
              <button className="small link" style={{ fontSize: 11, padding: '0 14px 10px 50px' }} onClick={() => {
                const next = [...t.groups]; next.splice(gi, 2, [...t.groups[gi], ...t.groups[gi + 1]]); setGroups(next)
              }}>суперсет со следующим</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

const UNITS: { id: Unit; label: string }[] = [{ id: 'kg', label: 'Вес, кг' }, { id: 'bw', label: 'Свой вес (+кг)' }, { id: 'sec', label: 'Время, сек' }]

export function ExerciseEditPage({ id, templateId }: { id: string; templateId?: string }) {
  const ex = useLiveQuery(() => db.exercises.get(id), [id])
  const t = useLiveQuery(() => (templateId ? db.templates.get(templateId) : undefined), [templateId])
  const nav = useNav()
  const partner = t?.groups.find((g) => g.includes(id))?.filter((x) => x !== id)
  const partnerName = useLiveQuery(async () => (partner?.length ? (await db.exercises.bulkGet(partner)).map((e) => e?.name).join(', ') : ''), [partner?.join()])
  if (!ex) return null
  const up = (patch: Partial<Exercise>) => db.exercises.update(id, patch)

  const replace = async () => {
    if (!t) return
    const nid = uid()
    await db.exercises.add({ ...ex, id: nid, name: 'Новое упражнение', note: '' })
    await db.templates.update(t.id, { groups: t.groups.map((g) => g.map((x) => (x === id ? nid : x))) })
    await archiveIfUnused(id)
    nav.pop()
    nav.push({ t: 'exEdit', id: nid, templateId })
  }
  const remove = async () => {
    if (!t || !confirm(`Убрать «${ex.name}» из шаблона? История останется.`)) return
    await db.templates.update(t.id, { groups: t.groups.map((g) => g.filter((x) => x !== id)).filter((g) => g.length) })
    await archiveIfUnused(id)
    nav.pop()
  }

  return (
    <PageShell back={t?.name ?? 'Назад'}>
      <input className="input" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, height: 46, background: 'transparent', padding: 0, marginBottom: 10 }}
        value={ex.name} onChange={(e) => up({ name: e.target.value })} aria-label="Название" />
      <div className="card">
        <div className="form-row"><span>Мышца</span><input className="input" value={ex.muscle} placeholder="средняя дельта" onChange={(e) => up({ muscle: e.target.value })} /></div>
        <div className="form-row"><span>Группа (цвет)</span>
          <select className="input" value={ex.group} style={{ color: groupColor(ex.group) }} onChange={(e) => up({ group: e.target.value as Group })}>
            {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </div>
        <div className="form-row"><span>Тип</span>
          <select className="input" value={ex.unit} onChange={(e) => up({ unit: e.target.value as Unit })}>
            {UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </div>
      </div>
      <div className="card" style={{ marginTop: 8 }}>
        <div className="form-row"><span>Подходы</span><NumField className="input" value={ex.sets} onCommit={(v) => v && up({ sets: Math.round(v) })} /></div>
        <div className="form-row"><span>{ex.unit === 'sec' ? 'Секунды' : 'Повторы'}, от–до</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <NumField className="input" value={ex.repMin} onCommit={(v) => v != null && up({ repMin: Math.round(v) })} />
            <NumField className="input" value={ex.repMax} onCommit={(v) => v != null && up({ repMax: Math.round(v) })} />
          </span>
        </div>
        <div className="form-row"><span>RIR, от–до</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <NumField className="input" value={ex.rirMin} onCommit={(v) => v != null && up({ rirMin: v })} />
            <NumField className="input" value={ex.rirMax} onCommit={(v) => v != null && up({ rirMax: v })} />
          </span>
        </div>
        <div className="form-row"><span>Шаг {ex.unit === 'sec' ? 'времени, сек' : 'веса, кг'}</span><NumField className="input" value={ex.step} onCommit={(v) => v != null && up({ step: v })} /></div>
      </div>
      {t && partnerName && <div className="card" style={{ marginTop: 8 }}><div className="row"><span className="muted">Суперсет с</span><span className="small">{partnerName}</span></div></div>}
      <p className="section-label">Заметка к технике</p>
      <textarea className="input" style={{ background: 'var(--cell)' }} value={ex.note} placeholder="Видна на тренировке под названием упражнения" onChange={(e) => up({ note: e.target.value })} />
      {t && (
        <div className="card" style={{ marginTop: 12 }}>
          <button className="row link" style={{ width: '100%' }} onClick={replace}><span><IconReplace size={16} style={{ verticalAlign: -3 }} /> Заменить упражнение</span></button>
          <button className="row btn-danger" style={{ width: '100%' }} onClick={remove}><span><IconTrash size={16} style={{ verticalAlign: -3 }} /> Убрать из шаблона</span></button>
        </div>
      )}
      {t && <p className="muted small" style={{ marginTop: 8 }}>При замене старая история остаётся, у нового упражнения своя кривая.</p>}
    </PageShell>
  )
}

async function archiveIfUnused(id: string) {
  const templates = await db.templates.toArray()
  if (!templates.some((t) => t.groups.flat().includes(id))) await db.exercises.update(id, { archived: true })
}
