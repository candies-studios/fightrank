import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { useApp } from '@/hooks/useData'
import { useToast } from '@/hooks/useToast'
import { Button, Field, Input, Panel } from '@/components/ui'

export default function Login() {
  const app = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const demo = app.context.auth.demoCredentials

  const [email, setEmail] = useState(demo?.email ?? '')
  const [password, setPassword] = useState(demo?.password ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (app.session) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from.startsWith('/admin') ? from : '/admin'} replace />
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const session = await app.context.auth.signIn(email.trim(), password)
      app.setSession(session)
      toast.success('Signed in', `Welcome back, ${session.displayName ?? session.email}.`)
      navigate('/admin', { replace: true })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-900">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center px-4 sm:px-6">
          <Link to="/" className="numeral text-xl tracking-tight text-chalk">
            FIGHT<span className="text-signal">RANK</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="eyebrow mb-2 flex items-center gap-2 text-signal">
            <ShieldCheck className="size-3.5" />
            Administration
          </div>
          <h1 className="text-4xl text-chalk">Sign in</h1>
          <p className="mt-2 text-sm text-muted">
            Administrator access is required to record results, manage fighters and tune the ranking
            engine.
          </p>

          <Panel className="mt-6 p-5">
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field label="Email" required>
                {({ id, invalid }) => (
                  <Input
                    id={id}
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    invalid={invalid}
                    required
                  />
                )}
              </Field>
              <Field label="Password" required error={error ?? undefined}>
                {({ id, invalid }) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    invalid={invalid}
                    required
                  />
                )}
              </Field>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={busy}
                icon={<KeyRound className="size-4" />}
              >
                Sign in
              </Button>
            </form>
          </Panel>

          {demo ? (
            <div className="mt-4 border border-signal/30 bg-signal-wash/40 p-4 text-xs leading-relaxed text-chalk-dim">
              <p className="mb-1 font-medium text-signal">Demo mode</p>
              <p>
                No Supabase project is configured, so this installation is running against a local
                PostgreSQL database in your browser with a stub sign-in. Use{' '}
                <code className="text-chalk">{demo.email}</code> /{' '}
                <code className="text-chalk">{demo.password}</code>. Configure{' '}
                <code>VITE_SUPABASE_URL</code> to switch to real Supabase authentication with Row
                Level Security.
              </p>
            </div>
          ) : null}

          <p className="mt-6 text-center text-xs text-faint">
            <Link to="/" className="transition hover:text-signal">
              ← Back to the public site
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
