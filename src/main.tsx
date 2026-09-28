import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { DataProvider } from '@/hooks/useData'
import { ToastProvider } from '@/hooks/useToast'
import { ScrollToTop } from '@/components/ScrollToTop'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element missing from index.html')

// When the site is served from a subpath (GitHub Pages serves this repo from
// /fightrank/), the router has to know about that prefix or every route misses.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

createRoot(container).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <ToastProvider>
        <DataProvider>
          <ScrollToTop />
          <App />
        </DataProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
