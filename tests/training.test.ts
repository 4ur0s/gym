import { describe, expect, it } from 'vitest'
import { e1rm, hardSetsByGroup, isPlateau, prefill, progression, score } from '../src/logic/training'
import type { Exercise } from '../src/db/types'

const bench: Exercise = { id: 'bench', name: 'Жим лёжа', muscle: 'грудь', group: 'chest', sets: 3, repMin: 6, repMax: 10, rirMin: 1, rirMax: 2, step: 2.5, unit: 'kg', note: '', archived: false }
const s = (weight: number, reps: number, rir: number | null = 1) => ({ weight, reps, rir })

describe('e1rm', () => {
  it('uses Epley with RIR', () => {
    expect(e1rm(52.5, 8, 1)).toBe(68.3) // 52.5 × (1 + 9/30)
    expect(e1rm(100, 0, 0)).toBe(0)
  })
  it('score falls back to reps for bodyweight', () => {
    expect(score(s(0, 7), 'bw')).toBe(7)
    expect(score(s(0, 30), 'sec')).toBe(30)
  })
})

describe('double progression', () => {
  it('adds a step when every set hits the top at RIR ≤ 2', () => {
    const a = progression(bench, [s(45, 10), s(45, 10), s(45, 10, 2)])
    expect(a).toMatchObject({ kind: 'up', weight: 47.5 })
  })
  it('holds when one set misses the top', () => {
    expect(progression(bench, [s(52.5, 8), s(52.5, 8), s(52.5, 7)]).kind).toBe('hold')
  })
  it('accepts a single logged set (imported history)', () => {
    expect(progression(bench, [s(45, 10)]).kind).toBe('up')
  })
  it('holds when RIR is too high', () => {
    expect(progression(bench, [s(45, 10, 3), s(45, 10, 3), s(45, 10, 3)]).kind).toBe('hold')
  })
  it('prefills raised weight from the range bottom after a top session', () => {
    expect(prefill(bench, [s(45, 10), s(45, 10), s(45, 10)])[0]).toMatchObject({ weight: 47.5, reps: 6 })
  })
  it('prefills last numbers otherwise, extending to the planned set count', () => {
    const p = prefill(bench, [s(52.5, 8), s(52.5, 7)])
    expect(p).toHaveLength(3)
    expect(p[2]).toMatchObject({ weight: 52.5, reps: 7 })
  })
})

describe('plateau (4 weeks)', () => {
  it('flags no growth over 4 weeks', () => {
    const pts = [
      { date: '2026-09-01', best: 65 }, { date: '2026-09-20', best: 66 },
      { date: '2026-10-01', best: 66 }, { date: '2026-10-10', best: 65.5 }, { date: '2026-10-20', best: 66 },
    ]
    expect(isPlateau(pts)).toBe(true)
  })
  it('does not flag growth', () => {
    const pts = [{ date: '2026-09-01', best: 60 }, { date: '2026-10-01', best: 62 }, { date: '2026-10-10', best: 64 }]
    expect(isPlateau(pts)).toBe(false)
  })
})

describe('weekly volume', () => {
  it('counts hard sets only', () => {
    const v = hardSetsByGroup([
      { ...s(50, 8, 1), group: 'chest' }, { ...s(50, 8, 4), group: 'chest' },
      { ...s(40, 10, null), group: 'legs' }, { ...s(40, 10, 1), group: 'legs', done: false },
    ])
    expect(v.chest).toBe(1)
    expect(v.legs).toBe(1)
  })
})
