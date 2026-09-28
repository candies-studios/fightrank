import { Link } from 'react-router-dom'
import { Button, Container } from '@/components/ui'

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-5 py-20 text-center">
      <div className="numeral text-[22vw] leading-none text-ink-600 sm:text-[10rem]">404</div>
      <h1 className="text-3xl text-chalk">No contest</h1>
      <p className="max-w-md text-sm text-muted">
        That page is not on the card. Check the rankings, or search for a fighter.
      </p>
      <div className="flex gap-2">
        <Link to="/">
          <Button variant="primary">Home</Button>
        </Link>
        <Link to="/rankings">
          <Button variant="secondary">Rankings</Button>
        </Link>
      </div>
    </Container>
  )
}
