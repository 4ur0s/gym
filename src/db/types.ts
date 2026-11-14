export type Group = 'chest' | 'back' | 'legs' | 'delts' | 'arms' | 'core'
export type Unit = 'kg' | 'bw' | 'sec'

export const GROUPS: { id: Group; label: string; color: string }[] = [
  { id: 'chest', label: 'Грудь', color: 'var(--g-chest)' },
  { id: 'back', label: 'Спина', color: 'var(--g-back)' },
  { id: 'legs', label: 'Ноги', color: 'var(--g-legs)' },
  { id: 'delts', label: 'Дельты', color: 'var(--g-delts)' },
  { id: 'arms', label: 'Руки', color: 'var(--g-arms)' },
  { id: 'core', label: 'Пресс', color: 'var(--g-core)' },
]
export const groupColor = (g: Group) => GROUPS.find((x) => x.id === g)?.color ?? 'var(--text-2)'

export interface Exercise {
  id: string
  name: string
  muscle: string
  group: Group
  sets: number
  repMin: number
  repMax: number
  rirMin: number
  rirMax: number
  step: number
  unit: Unit
  note: string
  archived: boolean
}

export interface Template {
  id: string
  name: string
  order: number
  /** each group is one exercise or a superset of several */
  groups: string[][]
}

export interface Workout {
  id: string
  date: string // YYYY-MM-DD
  templateId: string
  templateName: string
  startedAt: number
  finishedAt?: number
  status: 'active' | 'done'
  imported?: boolean
}

export interface WorkSet {
  id: string
  workoutId: string
  exerciseId: string
  date: string
  idx: number
  weight: number
  reps: number
  rir: number | null
  done: boolean
}

export interface Measurement {
  id: string
  date: string
  values: Record<string, number>
}

export interface InBody {
  id: string
  date: string
  weight?: number
  smm?: number
  ffm?: number
  fatKg?: number
  fatPct?: number
  water?: number
  visceral?: number
  score?: number
}

export interface MeasureField {
  key: string
  label: string
  unit: string
}

export const DEFAULT_MEASURE_FIELDS: MeasureField[] = [
  { key: 'weight', label: 'Вес', unit: 'кг' },
  { key: 'waist', label: 'Талия', unit: 'см' },
  { key: 'chest', label: 'Грудь', unit: 'см' },
  { key: 'shoulders', label: 'Плечи', unit: 'см' },
  { key: 'biceps', label: 'Бицепс', unit: 'см' },
  { key: 'forearm', label: 'Предплечье', unit: 'см' },
  { key: 'hips', label: 'Бёдра (ягодицы)', unit: 'см' },
  { key: 'thigh', label: 'Бедро', unit: 'см' },
  { key: 'calf', label: 'Голень', unit: 'см' },
  { key: 'neck', label: 'Шея', unit: 'см' },
]
