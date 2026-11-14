import { useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { Placeholder } from './screens/Placeholder'

const SCREENS: Record<Tab, { title: string; note: string }> = {
  workout: { title: 'Тренировка', note: 'Здесь будет сегодняшняя тренировка.' },
  progress: { title: 'Прогресс', note: 'Здесь будут сводка недели и кривые упражнений.' },
  body: { title: 'Тело', note: 'Здесь будут вес, талия, замеры и InBody.' },
  history: { title: 'История', note: 'Здесь будут тренировки по неделям.' },
}

export function App() {
  const [tab, setTab] = useState<Tab>('workout')
  return (
    <div className="app">
      <Placeholder {...SCREENS[tab]} />
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
