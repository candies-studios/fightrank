import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Save } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { saveEvent, ValidationError } from '@/services/admin'
import { issuesByField } from '@/services/validation'
import { FightRow } from '@/components/FightRow'
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Panel,
  SectionHeader,
  Select,
  Skeleton,
} from '@/components/ui'
import { slugify } from '@/lib/format'

interface Draft {
  id?: string
  name: string
  slug: string
  eventNumber: number | null
  eventDate: string
  venue: string
  city: string
  country: string
  countryCode: string
  posterUrl: string
  status: 'scheduled' | 'live' | 'completed' | 'cancelled'
}

const EMPTY: Draft = {
  name: '',
  slug: '',
  eventNumber: null,
  eventDate: new Date().toISOString().slice(0, 10),
  venue: '',
  city: '',
  country: '',
  countryCode: '',
  posterUrl: '',
  status: 'scheduled',
}

export default function EventForm() {
  const { eventId } = useParams()
  const isEdit = Boolean(eventId)
  const app = useApp()
  const repository = useRepository()
  const toast = useToast()
  const navigate = useNavigate()

  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  const { data, error, loading } = useAsync(
    async () => {
      if (!eventId) return { event: null, fights: [] }
      const event = await repository.getEvent(eventId)
      const fights = event ? await repository.listFights({ eventId: event.id, status: 'all' }) : []
      return { event, fights }
    },
    [eventId, repository, app.revision],
  )

  useEffect(() => {
    if (!data?.event) return
    const e = data.event
    setDraft({
      id: e.id,
      name: e.name,
      slug: e.slug,
      eventNumber: e.eventNumber,
      eventDate: e.eventDate.slice(0, 10),
      venue: e.venue ?? '',
      city: e.city ?? '',
      country: e.country ?? '',
      countryCode: e.countryCode ?? '',
      posterUrl: e.posterUrl ?? '',
      status: e.status,
    })
    setSlugTouched(true)
  }, [data?.event])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((c) => ({ ...c, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const saved = await saveEvent(app.context, app.session, draft)
      toast.success(isEdit ? 'Event updated' : 'Event created', saved.name)
      app.bumpRevision()
      navigate('/admin/events')
    } catch (cause) {
      if (cause instanceof ValidationError) setErrors(issuesByField(cause.issues))
      else toast.error('Could not save', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  if (error) return <ErrorState error={error} />
  if (loading) return <Skeleton className="h-96 w-full" />

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/admin/events"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-signal"
      >
        <ArrowLeft className="size-4" />
        Back to events
      </Link>

      <SectionHeader eyebrow="Card" title={isEdit ? 'Edit event' : 'New event'} level={1} />

      <form onSubmit={submit} className="space-y-6">
        <Panel className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Event name" required error={errors.name} className="sm:col-span-2">
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                value={draft.name}
                placeholder="FIGHTRANK 142"
                onChange={(e) => {
                  const name = e.target.value
                  setDraft((c) => ({
                    ...c,
                    name,
                    slug: slugTouched ? c.slug : slugify(name),
                  }))
                }}
              />
            )}
          </Field>

          <Field label="URL slug" required error={errors.slug}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                value={draft.slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  set('slug', slugify(e.target.value))
                }}
              />
            )}
          </Field>

          <Field label="Event number" hint="Optional — numbered cards only" error={errors.eventNumber}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                type="number"
                value={draft.eventNumber ?? ''}
                onChange={(e) =>
                  set('eventNumber', e.target.value === '' ? null : Number(e.target.value))
                }
              />
            )}
          </Field>

          <Field label="Date" required error={errors.eventDate}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                type="date"
                value={draft.eventDate}
                onChange={(e) => set('eventDate', e.target.value)}
              />
            )}
          </Field>

          <Field label="Status">
            {({ id }) => (
              <Select
                id={id}
                value={draft.status}
                onChange={(e) => set('status', e.target.value as Draft['status'])}
              >
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            )}
          </Field>

          <Field label="Venue">
            {({ id }) => (
              <Input id={id} value={draft.venue} onChange={(e) => set('venue', e.target.value)} />
            )}
          </Field>
          <Field label="City">
            {({ id }) => (
              <Input id={id} value={draft.city} onChange={(e) => set('city', e.target.value)} />
            )}
          </Field>
          <Field label="Country">
            {({ id }) => (
              <Input id={id} value={draft.country} onChange={(e) => set('country', e.target.value)} />
            )}
          </Field>
          <Field label="Country code" hint="Two letters, e.g. US">
            {({ id }) => (
              <Input
                id={id}
                maxLength={2}
                value={draft.countryCode}
                onChange={(e) => set('countryCode', e.target.value.toUpperCase())}
              />
            )}
          </Field>
          <Field label="Poster URL" className="sm:col-span-2">
            {({ id }) => (
              <Input
                id={id}
                value={draft.posterUrl}
                placeholder="https://…"
                onChange={(e) => set('posterUrl', e.target.value)}
              />
            )}
          </Field>
        </Panel>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" loading={busy} icon={<Save className="size-4" />}>
            {isEdit ? 'Save event' : 'Create event'}
          </Button>
          <Link to="/admin/events">
            <Button variant="ghost" type="button">
              Cancel
            </Button>
          </Link>
        </div>
      </form>

      {isEdit ? (
        <section className="mt-10">
          <SectionHeader
            eyebrow={`${data?.fights.length ?? 0} bouts`}
            title="Card"
            action={
              <Link to="/admin/fights/new">
                <Button size="sm" icon={<Plus className="size-3.5" />}>
                  Add bout
                </Button>
              </Link>
            }
          />
          {(data?.fights.length ?? 0) === 0 ? (
            <EmptyState title="No bouts on this card yet" />
          ) : (
            <div className="border-t border-line-soft">
              {data?.fights
                .slice()
                .sort((a, b) => Number(b.isMainEvent) - Number(a.isMainEvent) || a.boutOrder - b.boutOrder)
                .map((fight) => (
                  <div key={fight.id} className="relative">
                    <FightRow fight={fight} />
                    <Link
                      to={`/admin/fights/${fight.id}`}
                      className="absolute right-0 top-3 text-xs text-muted transition hover:text-signal"
                    >
                      Edit
                    </Link>
                  </div>
                ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
