// Turns MY_BRAIN/health/logs/*.md (weekly reviews) into a «Подход» backup file: data/history.json.
// Usage: node scripts/import-logs.mjs [--names]   (--names prints unmatched exercise names)
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const HEALTH = 'X:/SALE TOOLS/MY_BRAIN/health'
const LOGS = path.join(HEALTH, 'logs')
const seed = JSON.parse(fs.readFileSync('src/db/seed.json', 'utf8'))
const YEAR = 2026

// exercises that are no longer in the plan but have history
const RETIRED = [
  ['squat', 'Присед со штангой', 'квадрицепс', 'legs', 'kg'],
  ['cable-row', 'Тяга нижнего блока к животу', 'середина спины', 'back', 'kg'],
  ['db-lat-raise', 'Махи гантелями в стороны', 'средняя дельта', 'delts', 'kg'],
  ['bb-curl', 'Подъём штанги на бицепс', 'бицепс', 'arms', 'kg'],
  ['cable-curl', 'Бицепс на нижнем блоке', 'бицепс', 'arms', 'kg'],
  ['ohp', 'Армейский жим стоя', 'передняя дельта', 'delts', 'kg'],
  ['triceps-cable', 'Трицепс на блоке', 'трицепс', 'arms', 'kg'],
  ['incline-crunch', 'Скручивания на наклонной', 'пресс', 'core', 'bw'],
  ['leg-raise', 'Ноги к груди', 'нижний пресс', 'core', 'bw'],
].map(([id, name, muscle, group, unit]) => ({ id, name, muscle, group, sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, step: 2.5, unit, note: '', archived: true }))

// [regex on lowercased name, exercise id] — first match wins
const ALIASES = [
  [/присед/, 'squat'],
  [/разгибани.*ног|leg ext/, 'leg-ext'],
  [/(сгибани.*ног|leg curl)/, 'leg-curl'],
  [/наклон.*жим|жим.*наклон/, 'incline'],
  [/гантел.*сидя|жим гантел/, 'db-press'],
  [/армейск/, 'ohp'],
  [/^жим( лёжа)?$|^жим лежа/, 'bench'],
  [/упор.*груд|chest.supported/, 'cs-row'],
  [/(блок|тяга).*(живот|нижн)/, 'cable-row'],
  [/(блок|тяга).*(груд|верхн)/, 'lat-pd'],
  [/подтяг/, 'chinup'],
  [/обратн.*развед|reverse fly/, 'rev-fly'],
  [/махи.*тренаж|дельт|разведени/, 'lat-raise'],
  [/махи/, 'db-lat-raise'],
  [/бицепс.*блок/, 'cable-curl'],
  [/гантел.*наклон|incline.*curl/, 'incline-curl'],
  [/штанг.*бицепс|^бицепс/, 'bb-curl'],
  [/из-за головы|трицепс штанг/, 'oh-ext'],
  [/трицепс/, 'triceps-cable'],
  [/reverse curl|обратн.*сгиб/, 'rev-curl'],
  [/запяст/, 'wrist-curl'],
  [/гиперэкст/, 'hyperext'],
  [/reverse crunch|обратн.*скруч/, 'rev-crunch'],
  [/ноги к груди/, 'leg-raise'],
  [/планк/, 'plank'],
  [/^пресс|скручиван/, 'incline-crunch'],
]

const exercises = new Map([...seed.exercises, ...RETIRED].map((e) => [e.id, e]))
const matchId = (name) => ALIASES.find(([re]) => re.test(name))?.[1]

const num = (s) => Number(String(s).replace(',', '.'))
const firstNum = (s) => num(String(s).split(/[–-]/)[0])
const iso = (d, m) => `${YEAR}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const uid = () => crypto.randomUUID()

/** "присед 52.5×6 rir1" → { name, sets: [{weight, reps, rir}] } */
function parseItem(raw) {
  let t = raw.replace(/\*\*/g, '').replace(/\([^)]*\)/g, ' ').replace(/[⚠️🆕]/gu, '').replace(/\s+/g, ' ').trim()
  const rirM = t.match(/rir\s*(\d+(?:[.,]\d+)?)/i)
  const rir = rirM ? num(rirM[1]) : null
  t = t.replace(/rir\s*[\d.,–-]+/gi, '').trim()
  const nameM = t.match(/^(.*?)(?=\s[+\d]|$)/)
  const name = (nameM?.[1] ?? t).trim().toLowerCase()
  const rest = t.slice(nameM?.[1]?.length ?? 0)
  const id = matchId(name)
  if (!id) return { name, unknown: true }
  const unit = exercises.get(id).unit
  let m
  const sets = []
  if ((m = rest.match(/(\d+)\s*×\s*\+?(\d+(?:[.,]\d+)?)\s*×\s*(\d+)/))) { // 2×12.5×9
    for (let i = 0; i < num(m[1]); i++) sets.push({ weight: num(m[2]), reps: num(m[3]) })
  } else if ((m = rest.match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/)) && unit !== 'kg') { // 7-7-6
    sets.push(...[m[1], m[2], m[3]].map((r) => ({ weight: 0, reps: num(r) })))
  } else if ((m = rest.match(/\+?(\d+(?:[.,]\d+)?)\s*кг[^×\d]*(\d+)\s*×\s*([\d–-]+)/))) { // 30кг 3×6
    for (let i = 0; i < num(m[2]); i++) sets.push({ weight: num(m[1]), reps: firstNum(m[3]) })
  } else if ((m = rest.match(/(\d+(?:[.,]\d+)?)\s*кг\s*×\s*([\d–-]+)/))) { // 9 кг ×6
    sets.push({ weight: num(m[1]), reps: firstNum(m[2]) })
  } else if ((m = rest.match(/(\+?)(\d+(?:[.,]\d+)?)\s*×\s*([\d–-]+)/))) {
    if (unit !== 'kg' && !m[1]) { // 2×17 → 2 sets of 17 (bodyweight / time)
      for (let i = 0; i < num(m[2]); i++) sets.push({ weight: 0, reps: firstNum(m[3]) })
    } else sets.push({ weight: num(m[2]), reps: firstNum(m[3]) })
  } else return { name, id, unparsed: rest }
  return { name, id, sets: sets.map((s) => ({ ...s, rir })) }
}

const workouts = new Map() // date+tpl → { workout, items }
const unknown = new Map()
function addWorkout(date, letter, items) {
  const parsed = items.map(parseItem)
  const inA = new Set(seed.templates[0].groups.flat().concat(['squat']))
  const tpl = letter ? (/[AА]/.test(letter) ? 'A' : 'B') : (parsed.some((p) => inA.has(p.id) && p.id !== 'cs-row') ? 'A' : 'B')
  const key = `${date}|${tpl}`
  for (const p of parsed) if (p.unknown || p.unparsed) unknown.set(p.name + (p.unparsed ? ` [${p.unparsed}]` : ''), (unknown.get(p.name) ?? 0) + 1)
  const good = parsed.filter((p) => p.sets?.length)
  if (!good.length) return
  if (!workouts.has(key) || workouts.get(key).items.length < good.length) workouts.set(key, { date, tpl, items: good })
}

for (const file of fs.readdirSync(LOGS).filter((f) => f.endsWith('.md')).sort()) {
  const lines = fs.readFileSync(path.join(LOGS, file), 'utf8').split('\n')
  // inline format: **03.08 — Б:** item · item
  for (const l of lines) {
    const m = l.match(/^\*\*(\d{1,2})\.(\d{2})\s*(?:—\s*)?([AАБB])?(?=[\s:*(])[^*]*\*\*\s*(?:\([^)]*\))?\s*:?\s*(.*)$/)
    if (!m) continue
    const body = m[4].replace(/^[^:]*?:\s*/, (x) => (x.length < 4 ? '' : x)).trim()
    addWorkout(iso(m[1], m[2]), m[3] ?? '', body.split(/\s·\s/).filter(Boolean))
  }
  // table format: ### 27.07 — A + | name | 50 кг | 3×8–10 | 1 |
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^###\s*(\d{1,2})\.(\d{2})\s*—\s*([AАБB])/)
    if (!h) continue
    const items = []
    for (let j = i + 1; j < lines.length && !/^#/.test(lines[j]); j++) {
      const c = lines[j].split('|').map((x) => x.trim())
      if (c.length < 6 || /^-+$/.test(c[1]) || /упражнение/i.test(c[1])) continue
      const w = c[2].match(/\+?(\d+(?:[.,]\d+)?)/)
      const sr = c[3].match(/(\d+)\s*×\s*([\d–-]+)/)
      if (!sr) continue
      const isBw = /свой|св\./i.test(c[2]) || !w
      items.push(`${c[1]} ${isBw ? '' : w[1] + '×'}${isBw ? `${sr[1]}×${sr[2]}` : firstNum(sr[2])} rir${firstNum(c[4]) || 0}`)
      if (!isBw) items[items.length - 1] = `${c[1]} ${num(w[1])}кг ${sr[1]}×${firstNum(sr[2])} rir${firstNum(c[4]) || 0}`
    }
    addWorkout(iso(h[1], h[2]), h[3], items)
  }
}

if (process.argv.includes('--names')) {
  console.log('Unmatched:')
  for (const [n, c] of unknown) console.log(`  ${c}× ${n}`)
}

// build backup
const W = [], S = []
for (const { date, tpl, items } of [...workouts.values()].sort((a, b) => a.date.localeCompare(b.date))) {
  const id = uid()
  const startedAt = new Date(`${date}T18:00:00`).getTime()
  W.push({ id, date, templateId: tpl, templateName: tpl === 'A' ? 'Тренировка A' : 'Тренировка Б', startedAt, finishedAt: startedAt, status: 'done', imported: true })
  items.forEach((it, order) => it.sets.forEach((s, i) => S.push({ id: uid(), workoutId: id, exerciseId: it.id, date, idx: order * 100 + i, weight: s.weight, reps: s.reps, rir: s.rir, done: true })))
}

// body: fasted weight mentions + known InBody / measurements from profile.md
const measurements = new Map()
for (const file of fs.readdirSync(LOGS).filter((f) => f.endsWith('.md'))) {
  const text = fs.readFileSync(path.join(LOGS, file), 'utf8').replace(/\*\*/g, '')
  for (const m of text.matchAll(/(\d{2}(?:[.,]\d{1,2})?)\s*кг\s*натощак\s*\((\d{1,2})\.(\d{2})\)/g)) {
    measurements.set(iso(m[2], m[3]), num(m[1]))
  }
}
const M = [...measurements.entries()].map(([date, weight]) => ({ id: `w-${date}`, date, values: { weight } }))
M.push({ id: 'm-2026-07-24', date: '2026-07-24', values: { weight: 72.1, waist: 80.5, chest: 97, hips: 96.5, neck: 37.5 } })
const IB = [
  { id: 'ib-2026-07-24', date: '2026-07-24', weight: 72.1, smm: 34.4, ffm: 61.2, fatKg: 10.9, fatPct: 15.1, water: 44.7, visceral: 4, score: 80 },
  { id: 'ib-2026-10-16', date: '2026-10-16', weight: 75.4, smm: 37.4, ffm: 65.8, fatKg: 9.6, fatPct: 12.7, water: 48.0, visceral: 4, score: 84 },
]

const used = new Set(S.map((s) => s.exerciseId))
const backup = {
  app: 'podhod', version: 1, exportedAt: new Date().toISOString(),
  data: { exercises: RETIRED.filter((e) => used.has(e.id)), workouts: W, sets: S, measurements: M, inbody: IB },
}
fs.mkdirSync('data', { recursive: true })
fs.writeFileSync('data/history.json', JSON.stringify(backup))
console.log(`workouts ${W.length}, sets ${S.length}, measurements ${M.length}, inbody ${IB.length}, unmatched ${unknown.size}`)
console.log(`range ${W[0]?.date} … ${W[W.length - 1]?.date}`)
