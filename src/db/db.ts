import Dexie, { type Table } from 'dexie'
import type { Exercise, InBody, MeasureField, Measurement, Template, Workout, WorkSet } from './types'
import { DEFAULT_MEASURE_FIELDS } from './types'
import seed from './seed.json'

interface Setting { key: string; value: unknown }

class PodhodDB extends Dexie {
  exercises!: Table<Exercise, string>
  templates!: Table<Template, string>
  workouts!: Table<Workout, string>
  sets!: Table<WorkSet, string>
  measurements!: Table<Measurement, string>
  inbody!: Table<InBody, string>
  settings!: Table<Setting, string>

  constructor() {
    super('podhod')
    this.version(1).stores({
      exercises: 'id, group, archived',
      templates: 'id, order',
      workouts: 'id, date, status, templateId',
      sets: 'id, workoutId, exerciseId, date',
      measurements: 'id, date',
      inbody: 'id, date',
      settings: 'key',
    })
    this.on('populate', (tx) => {
      tx.table('exercises').bulkAdd(seed.exercises)
      tx.table('templates').bulkAdd(seed.templates)
      tx.table('settings').add({ key: 'measureFields', value: DEFAULT_MEASURE_FIELDS })
    })
  }
}

export const db = new PodhodDB()

export const uid = () => crypto.randomUUID()

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const s = await db.settings.get(key)
  return (s?.value as T) ?? fallback
}
export const setSetting = (key: string, value: unknown) => db.settings.put({ key, value })

export const measureFields = () => getSetting<MeasureField[]>('measureFields', DEFAULT_MEASURE_FIELDS)
