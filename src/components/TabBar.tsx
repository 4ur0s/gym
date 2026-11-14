import { IconBarbell, IconChartLine, IconRulerMeasure, IconCalendar } from '@tabler/icons-react'

export type Tab = 'workout' | 'progress' | 'body' | 'history'

const TABS = [
  { id: 'workout', label: 'Тренировка', Icon: IconBarbell },
  { id: 'progress', label: 'Прогресс', Icon: IconChartLine },
  { id: 'body', label: 'Тело', Icon: IconRulerMeasure },
  { id: 'history', label: 'История', Icon: IconCalendar },
] as const

export function TabBar({ active, onChange, timer }: { active: Tab; onChange: (tab: Tab) => void; timer?: string }) {
  return (
    <nav className="tabbar">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className="tab"
          aria-current={active === id ? 'page' : undefined}
          style={id === 'workout' && timer ? { color: 'var(--accent)' } : undefined}
          onClick={() => onChange(id)}
        >
          <Icon size={26} stroke={1.6} aria-hidden />
          {id === 'workout' && timer ? <span className="num">{timer}</span> : label}
        </button>
      ))}
    </nav>
  )
}
