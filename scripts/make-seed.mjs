// Builds src/db/seed.json (exercises + templates A/Б) from MY_BRAIN/health/training-plan.md.
import fs from 'node:fs'

const PLAN = process.argv[2] ?? 'X:/SALE TOOLS/MY_BRAIN/health/training-plan.md'
const rows = fs.readFileSync(PLAN, 'utf8').split('\n').filter((l) => /^\| \d/.test(l))
  .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
const notes = rows.map((c) => c[5].replace(/\s+/g, ' ').trim())

// order of rows in the plan: A (9 rows) then Б (9 rows)
const E = (id, name, muscle, group, sets, repMin, repMax, rirMin, rirMax, step, unit, noteIdx) =>
  ({ id, name, muscle, group, sets, repMin, repMax, rirMin, rirMax, step, unit, note: notes[noteIdx] ?? '', archived: false })

const exercises = [
  E('leg-ext', 'Разгибания ног', 'квадрицепс', 'legs', 4, 10, 15, 1, 2, 2.5, 'kg', 0),
  E('bench', 'Жим лёжа', 'грудь', 'chest', 3, 6, 10, 1, 2, 2.5, 'kg', 1),
  E('cs-row', 'Тяга с упором грудью', 'середина спины', 'back', 3, 8, 12, 1, 2, 2.5, 'kg', 2),
  E('lat-pd', 'Тяга верхнего блока', 'широчайшие', 'back', 3, 8, 12, 1, 2, 2.5, 'kg', 3),
  E('lat-raise', 'Махи в тренажёре', 'средняя дельта', 'delts', 3, 10, 15, 1, 1, 2.5, 'kg', 4),
  E('rev-fly', 'Обратные разведения', 'задняя дельта', 'delts', 3, 12, 15, 1, 2, 2.5, 'kg', 5),
  E('wrist-curl', 'Сгибания запястий', 'предплечья', 'arms', 3, 15, 20, 1, 1, 2.5, 'kg', 6),
  E('hyperext', 'Гиперэкстензия', 'разгибатели спины', 'back', 3, 12, 15, 1, 2, 2.5, 'kg', 7),
  E('rev-crunch', 'Обратные скручивания', 'нижний пресс', 'core', 3, 12, 15, 1, 1, 1, 'bw', 8),
  E('leg-curl', 'Сгибания ног лёжа', 'бицепс бедра', 'legs', 3, 8, 12, 1, 2, 2.5, 'kg', 9),
  E('incline', 'Жим на наклонной', 'верх груди', 'chest', 3, 8, 10, 1, 2, 2.5, 'kg', 10),
  E('chinup', 'Подтягивания обратным хватом', 'широчайшие', 'back', 3, 5, 8, 0, 1, 1, 'bw', 12),
  E('db-press', 'Жим гантелей сидя', 'передняя дельта', 'delts', 3, 8, 10, 1, 2, 2.5, 'kg', 13),
  E('incline-curl', 'Сгибания гантелей на наклонной', 'бицепс', 'arms', 3, 10, 12, 0, 1, 1, 'kg', 14),
  E('oh-ext', 'Разгибания из-за головы', 'трицепс', 'arms', 3, 10, 12, 0, 1, 2.5, 'kg', 15),
  E('rev-curl', 'Обратные сгибания (reverse curl)', 'брахиалис, предплечья', 'arms', 3, 12, 15, 1, 1, 2.5, 'kg', 16),
  E('plank', 'Планка с подкруткой таза', 'пресс', 'core', 3, 30, 45, 2, 2, 5, 'sec', 17),
]

const templates = [
  { id: 'A', name: 'Тренировка A', order: 0, groups: [['leg-ext'], ['bench', 'cs-row'], ['lat-pd', 'lat-raise'], ['rev-fly', 'wrist-curl'], ['hyperext'], ['rev-crunch']] },
  { id: 'B', name: 'Тренировка Б', order: 1, groups: [['leg-curl'], ['incline', 'cs-row'], ['chinup'], ['db-press', 'incline-curl'], ['oh-ext', 'rev-curl'], ['plank']] },
]

fs.writeFileSync('src/db/seed.json', JSON.stringify({ exercises, templates }, null, 1))
console.log(`seed: ${exercises.length} exercises, ${templates.length} templates, ${rows.length} plan rows`)
