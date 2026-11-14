import { db, setSetting } from './db'
import { today } from '../logic/dates'

const TABLES = ['exercises', 'templates', 'workouts', 'sets', 'measurements', 'inbody', 'settings'] as const

export interface Backup { app: 'podhod'; version: 1; exportedAt: string; data: Record<string, unknown[]> }

export async function exportBackup(): Promise<{ file: File; counts: string }> {
  const data: Record<string, unknown[]> = {}
  for (const t of TABLES) data[t] = await db.table(t).toArray()
  const backup: Backup = { app: 'podhod', version: 1, exportedAt: new Date().toISOString(), data }
  const file = new File([JSON.stringify(backup)], `podhod-${today()}.json`, { type: 'application/json' })
  return { file, counts: `${data.workouts.length} тренировок, ${data.measurements.length} замеров` }
}

export async function shareOrDownload(file: File) {
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: file.name }); return } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function markExported() { await setSetting('lastExport', Date.now()) }

/** Adds or replaces records by id; nothing in the app is deleted */
export async function importBackup(text: string): Promise<string> {
  let parsed: Backup
  try { parsed = JSON.parse(text) } catch { throw new Error('Файл не читается как JSON') }
  if (parsed?.app !== 'podhod' || !parsed.data) throw new Error('Это не файл «Подхода»')
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const rows = parsed.data[t]
      if (Array.isArray(rows) && rows.length) await db.table(t).bulkPut(rows)
    }
  })
  const d = parsed.data
  return `Загружено: ${d.workouts?.length ?? 0} тренировок, ${d.measurements?.length ?? 0} замеров, ${d.inbody?.length ?? 0} InBody`
}
