import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/unbounded/cyrillic-500.css'
import '@fontsource/unbounded/cyrillic-700.css'
import '@fontsource/unbounded/cyrillic-800.css'
import '@fontsource/unbounded/latin-500.css'
import '@fontsource/unbounded/latin-700.css'
import '@fontsource/unbounded/latin-800.css'
import '@fontsource/montserrat/cyrillic-400.css'
import '@fontsource/montserrat/cyrillic-500.css'
import '@fontsource/montserrat/cyrillic-600.css'
import '@fontsource/montserrat/latin-400.css'
import '@fontsource/montserrat/latin-500.css'
import '@fontsource/montserrat/latin-600.css'
import './styles/tokens.css'
import './styles/global.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
