import { createContext, useContext, type ReactNode } from 'react'
import { IconChevronLeft } from '@tabler/icons-react'

export type Page =
  | { t: 'exercise'; id: string }
  | { t: 'templates' }
  | { t: 'template'; id: string }
  | { t: 'exEdit'; id: string; templateId?: string }
  | { t: 'measure' }
  | { t: 'inbody' }
  | { t: 'fields' }
  | { t: 'data' }

export interface Nav { push: (p: Page) => void; pop: () => void; toast: (text: string) => void }
export const NavContext = createContext<Nav>({ push: () => {}, pop: () => {}, toast: () => {} })
export const useNav = () => useContext(NavContext)

export function PageShell({ back, right, children }: { back: string; right?: ReactNode; children: ReactNode }) {
  const nav = useNav()
  return (
    <div className="page">
      <main className="screen">
        <div className="topbar">
          <button className="back" onClick={nav.pop}><IconChevronLeft size={22} stroke={2} aria-hidden />{back}</button>
          {right}
        </div>
        {children}
      </main>
    </div>
  )
}
