import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Send the viewport to the top on navigation, as a document site should. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}
