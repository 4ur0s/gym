import { useCallback, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { TabBar, type Tab } from './components/TabBar'
import { NavContext, type Nav, type Page } from './components/nav'
import { WorkoutScreen, useElapsed } from './screens/Workout'
import { ExerciseDetail, ProgressScreen } from './screens/Progress'
import { BodyScreen, FieldsPage, InBodyPage, MeasurePage } from './screens/Body'
import { DataPage, HistoryScreen } from './screens/History'
import { ExerciseEditPage, TemplatePage, TemplatesPage } from './screens/Templates'
import { fmtDuration } from './logic/dates'

function PageView({ page }: { page: Page }) {
  switch (page.t) {
    case 'exercise': return <ExerciseDetail id={page.id} />
    case 'templates': return <TemplatesPage />
    case 'template': return <TemplatePage id={page.id} />
    case 'exEdit': return <ExerciseEditPage id={page.id} templateId={page.templateId} />
    case 'measure': return <MeasurePage />
    case 'inbody': return <InBodyPage />
    case 'fields': return <FieldsPage />
    case 'data': return <DataPage />
  }
}

export function App() {
  const [tab, setTab] = useState<Tab>('workout')
  const [stack, setStack] = useState<Page[]>([])
  const [toastText, setToastText] = useState<string>()
  const toastTimer = useRef<number>(undefined)
  const active = useLiveQuery(() => db.workouts.where('status').equals('active').first())
  const elapsed = useElapsed(active?.startedAt)

  const toast = useCallback((text: string) => {
    setToastText(text)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastText(undefined), 2200)
  }, [])
  const nav: Nav = useMemo(() => ({
    push: (p) => setStack((s) => [...s, p]),
    pop: () => setStack((s) => s.slice(0, -1)),
    toast,
  }), [toast])

  const top = stack[stack.length - 1]
  return (
    <NavContext.Provider value={nav}>
      <div className="app">
        <div style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 0 }}>
          {tab === 'workout' && <WorkoutScreen />}
          {tab === 'progress' && <ProgressScreen />}
          {tab === 'body' && <BodyScreen />}
          {tab === 'history' && <HistoryScreen />}
          {top && <PageView key={stack.length} page={top} />}
        </div>
        <TabBar active={tab} onChange={(t) => { setStack([]); setTab(t) }} timer={active ? fmtDuration(elapsed) : undefined} />
        {toastText && <div className="toast" role="status">{toastText}</div>}
      </div>
    </NavContext.Provider>
  )
}
