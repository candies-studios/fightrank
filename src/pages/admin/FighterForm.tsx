import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import {
  deleteDisciplineRegistration,
  saveDisciplineRegistration,
  saveFighter,
  ValidationError,
} from '@/services/admin'
import { issuesByField } from '@/services/validation'
import { FighterAvatar } from '@/components/FighterAvatar'
import {
  Button,
  ErrorState,
  Field,
  Input,
  Panel,
  SectionHeader,
  Select,
  Skeleton,
  Textarea,
  Toggle,
} from '@/components/ui'
import { slugify } from '@/lib/format'

interface Draft {
  id?: string
  firstName: string
  lastName: string
  displayName: string
  slug: string
  nickname: string
  photoUrl: string
  country: string
  countryCode: string
  dateOfBirth: string | null
  heightCm: number | null
  reachCm: number | null
  stance: string
  disciplineId: string | null
  divisionId: string | null
  team: string
  debutDate: string | null
  isActive: boolean
  isChampion: boolean
  isInterimChampion: boolean
  bio: string
}

const EMPTY: Draft = {
  firstName: '',
  lastName: '',
  displayName: '',
  slug: '',
  nickname: '',
  photoUrl: '',
  country: '',
  countryCode: '',
  dateOfBirth: null,
  heightCm: null,
  reachCm: null,
  stance: '',
  disciplineId: null,
  divisionId: null,
  team: '',
  debutDate: null,
  isActive: true,
  isChampion: false,
  isInterimChampion: false,
  bio: '',
}

export default function FighterForm() {
  const { fighterId } = useParams()
  const isEdit = Boolean(fighterId)
  const app = useApp()
  const repository = useRepository()
  const toast = useToast()
  const navigate = useNavigate()

  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [touchedSlug, setTouchedSlug] = useState(false)
  const [touchedName, setTouchedName] = useState(false)

  const { data, error, loading } = useAsync(
    () => (fighterId ? repository.getFighter(fighterId) : Promise.resolve(null)),
    [fighterId, repository],
  )

  // Every discipline this athlete is registered in, under the one Fighter ID.
  const registrations = useAsync(
    () => (fighterId ? repository.listDisciplineRecords(fighterId) : Promise.resolve([])),
    [fighterId, repository, app.revision],
  )
  const [adding, setAdding] = useState<{ disciplineId: string; divisionId: string }>({
    disciplineId: '',
    divisionId: '',
  })

  const addRegistration = async () => {
    if (!fighterId || !adding.disciplineId) return
    setBusy(true)
    try {
      await saveDisciplineRegistration(app.context, app.session, {
        fighterId,
        disciplineId: adding.disciplineId,
        divisionId: adding.divisionId || null,
      })
      toast.success(
        'Discipline added',
        `${app.disciplineOf(adding.disciplineId)?.name} record created under this Fighter ID.`,
      )
      setAdding({ disciplineId: '', divisionId: '' })
      registrations.reload()
      app.bumpRevision()
    } catch (cause) {
      toast.error('Could not register', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const removeRegistration = async (disciplineId: string) => {
    if (!fighterId) return
    setBusy(true)
    try {
      await deleteDisciplineRegistration(app.context, app.session, fighterId, disciplineId)
      toast.success('Discipline removed', 'Their records in other disciplines are untouched.')
      registrations.reload()
      app.bumpRevision()
    } catch (cause) {
      toast.error(
        'Could not remove',
        'A discipline with recorded bouts cannot be removed from an athlete.',
      )
      void cause
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!data) return
    setDraft({
      id: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: data.displayName,
      slug: data.slug,
      nickname: data.nickname ?? '',
      photoUrl: data.photoUrl ?? '',
      country: data.country ?? '',
      countryCode: data.countryCode ?? '',
      dateOfBirth: data.dateOfBirth,
      heightCm: data.heightCm,
      reachCm: data.reachCm,
      stance: data.stance ?? '',
      disciplineId: data.primaryDisciplineId,
      divisionId: data.divisionId,
      team: data.team ?? '',
      debutDate: data.debutDate,
      isActive: data.isActive,
      isChampion: data.isChampion,
      isInterimChampion: data.isInterimChampion,
      bio: data.bio ?? '',
    })
    setTouchedSlug(true)
    setTouchedName(true)
  }, [data])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((c) => ({ ...c, [key]: value }))

  const updateName = (firstName: string, lastName: string) => {
    setDraft((c) => {
      const displayName = touchedName ? c.displayName : `${firstName} ${lastName}`.trim()
      return {
        ...c,
        firstName,
        lastName,
        displayName,
        slug: touchedSlug ? c.slug : slugify(displayName),
      }
    })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const saved = await saveFighter(app.context, app.session, {
        ...draft,
        stance: draft.stance || null,
      })
      toast.success(isEdit ? 'Fighter updated' : 'Fighter added', saved.displayName)
      app.bumpRevision()
      navigate('/admin/fighters')
    } catch (cause) {
      if (cause instanceof ValidationError) {
        setErrors(issuesByField(cause.issues))
        toast.error('Check the form', `${cause.issues.length} problem(s) need attention.`)
      } else {
        toast.error('Could not save', cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      setBusy(false)
    }
  }

  if (error) return <ErrorState error={error} />
  if (loading) return <Skeleton className="h-[36rem] w-full" />

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/admin/fighters"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-signal"
      >
        <ArrowLeft className="size-4" />
        Back to fighters
      </Link>

      <SectionHeader eyebrow="Roster" title={isEdit ? 'Edit fighter' : 'Add fighter'} level={1} />

      <form onSubmit={submit} className="space-y-6">
        <Panel className="p-5">
          <div className="mb-4 flex items-center gap-4">
            <FighterAvatar
              id={draft.id ?? draft.slug ?? 'new'}
              name={draft.displayName || 'New fighter'}
              photoUrl={draft.photoUrl || null}
              size="lg"
            />
            <div className="min-w-0">
              <div className="eyebrow text-[0.58rem]">Preview</div>
              <div className="truncate font-display text-2xl font-bold uppercase text-chalk">
                {draft.displayName || 'New fighter'}
              </div>
              {draft.nickname ? (
                <div className="truncate text-sm text-signal">“{draft.nickname}”</div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required error={errors.firstName}>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  invalid={invalid}
                  value={draft.firstName}
                  onChange={(e) => updateName(e.target.value, draft.lastName)}
                />
              )}
            </Field>
            <Field label="Last name" required error={errors.lastName}>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  invalid={invalid}
                  value={draft.lastName}
                  onChange={(e) => updateName(draft.firstName, e.target.value)}
                />
              )}
            </Field>
            <Field label="Display name" required error={errors.displayName}>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  invalid={invalid}
                  value={draft.displayName}
                  onChange={(e) => {
                    setTouchedName(true)
                    setDraft((c) => ({
                      ...c,
                      displayName: e.target.value,
                      slug: touchedSlug ? c.slug : slugify(e.target.value),
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
                    setTouchedSlug(true)
                    set('slug', slugify(e.target.value))
                  }}
                />
              )}
            </Field>
            <Field label="Nickname">
              {({ id }) => (
                <Input
                  id={id}
                  value={draft.nickname}
                  onChange={(e) => set('nickname', e.target.value)}
                />
              )}
            </Field>
            <Field label="Photo URL" hint="Leave blank to use the generated monogram">
              {({ id }) => (
                <Input
                  id={id}
                  value={draft.photoUrl}
                  placeholder="https://…"
                  onChange={(e) => set('photoUrl', e.target.value)}
                />
              )}
            </Field>
          </div>
        </Panel>

        <Panel className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="eyebrow sm:col-span-2">Competitive details</div>

          <Field
            label="Primary discipline"
            error={errors.disciplineId}
            hint="Add further disciplines from the athlete's profile after saving"
          >
            {({ id, invalid }) => (
              <Select
                id={id}
                invalid={invalid}
                value={draft.disciplineId ?? ''}
                onChange={(e) => {
                  set('disciplineId', e.target.value || null)
                  set('divisionId', null)
                }}
              >
                <option value="">Unassigned</option>
                {app.disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Division" error={errors.divisionId}>
            {({ id, invalid }) => (
              <Select
                id={id}
                invalid={invalid}
                value={draft.divisionId ?? ''}
                onChange={(e) => {
                  const divisionId = e.target.value || null
                  set('divisionId', divisionId)
                  // A division names its own discipline, so keep the two in step.
                  const owner = app.divisions.find((d) => d.id === divisionId)?.disciplineId
                  if (owner) set('disciplineId', owner)
                }}
              >
                <option value="">Unassigned</option>
                {app.disciplines
                  .filter((disc) => !draft.disciplineId || disc.id === draft.disciplineId)
                  .map((discipline) => (
                    <optgroup key={discipline.id} label={discipline.name}>
                      {app
                        .divisionsOf(discipline.id)
                        .filter((d) => !d.isP4P)
                        .map((division) => (
                          <option key={division.id} value={division.id}>
                            {division.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
              </Select>
            )}
          </Field>

          <Field label="Stance">
            {({ id }) => (
              <Select id={id} value={draft.stance} onChange={(e) => set('stance', e.target.value)}>
                <option value="">Unknown</option>
                <option value="orthodox">Orthodox</option>
                <option value="southpaw">Southpaw</option>
                <option value="switch">Switch</option>
              </Select>
            )}
          </Field>

          <Field label="Country">
            {({ id }) => (
              <Input id={id} value={draft.country} onChange={(e) => set('country', e.target.value)} />
            )}
          </Field>
          <Field label="Country code" hint="Two letters, e.g. BR">
            {({ id }) => (
              <Input
                id={id}
                maxLength={2}
                value={draft.countryCode}
                onChange={(e) => set('countryCode', e.target.value.toUpperCase())}
              />
            )}
          </Field>

          <Field label="Date of birth" error={errors.dateOfBirth}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                type="date"
                value={draft.dateOfBirth ?? ''}
                onChange={(e) => set('dateOfBirth', e.target.value || null)}
              />
            )}
          </Field>
          <Field label="Professional debut">
            {({ id }) => (
              <Input
                id={id}
                type="date"
                value={draft.debutDate ?? ''}
                onChange={(e) => set('debutDate', e.target.value || null)}
              />
            )}
          </Field>

          <Field label="Height (cm)" error={errors.heightCm}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                type="number"
                value={draft.heightCm ?? ''}
                onChange={(e) =>
                  set('heightCm', e.target.value === '' ? null : Number(e.target.value))
                }
              />
            )}
          </Field>
          <Field label="Reach (cm)" error={errors.reachCm}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                type="number"
                value={draft.reachCm ?? ''}
                onChange={(e) =>
                  set('reachCm', e.target.value === '' ? null : Number(e.target.value))
                }
              />
            )}
          </Field>

          <Field label="Team / gym" className="sm:col-span-2">
            {({ id }) => (
              <Input id={id} value={draft.team} onChange={(e) => set('team', e.target.value)} />
            )}
          </Field>

          <Field label="Biography" className="sm:col-span-2">
            {({ id }) => (
              <Textarea id={id} value={draft.bio} onChange={(e) => set('bio', e.target.value)} />
            )}
          </Field>

          <Toggle
            label="Active"
            hint="Inactive fighters stay ranked but stop being matched"
            checked={draft.isActive}
            onChange={(value) => set('isActive', value)}
          />
        </Panel>

        <Panel className="p-5">
          <div className="eyebrow mb-3">Championship status</div>
          <p className="mb-3 text-xs leading-relaxed text-faint">
            Championship status is normally set by the engine when a title-fight result is recorded.
            These switches exist for corrections and for importing an existing roster; the next
            recalculation will overwrite them from the fight record.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle
              label="Undisputed champion"
              checked={draft.isChampion}
              onChange={(value) =>
                setDraft((c) => ({
                  ...c,
                  isChampion: value,
                  isInterimChampion: value ? false : c.isInterimChampion,
                }))
              }
            />
            <Toggle
              label="Interim champion"
              checked={draft.isInterimChampion}
              onChange={(value) =>
                setDraft((c) => ({
                  ...c,
                  isInterimChampion: value,
                  isChampion: value ? false : c.isChampion,
                }))
              }
            />
          </div>
          {errors.isInterimChampion ? (
            <p className="mt-2 text-xs text-fall">{errors.isInterimChampion}</p>
          ) : null}
        </Panel>

        {isEdit ? (
          <Panel className="p-5">
            <div className="eyebrow mb-1">Disciplines under this Fighter ID</div>
            <p className="mb-4 text-xs leading-relaxed text-muted">
              Each registration gives this athlete a separate division, record and ranking. Ratings
              are never shared between them — a result in one discipline cannot move a rating in
              another.
            </p>

            <ul className="mb-4 flex flex-col gap-px bg-line">
              {(registrations.data ?? []).map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 bg-ink-800 px-3 py-2.5 text-sm"
                >
                  <span className="font-display text-xs uppercase tracking-wider text-signal">
                    {entry.disciplineCode}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-chalk">
                    {entry.disciplineName}
                    <span className="text-muted"> · {entry.divisionName ?? 'Unassigned'}</span>
                  </span>
                  <span className="numeral shrink-0 text-xs text-muted">
                    {entry.wins}-{entry.losses}-{entry.draws}
                  </span>
                  {entry.isPrimary ? (
                    <span className="shrink-0 text-[0.65rem] uppercase tracking-wider text-faint">
                      Primary
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${entry.disciplineName}`}
                      onClick={() => removeRegistration(entry.disciplineId)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </li>
              ))}
              {(registrations.data ?? []).length === 0 ? (
                <li className="bg-ink-800 px-3 py-2.5 text-sm text-faint">
                  No disciplines registered yet.
                </li>
              ) : null}
            </ul>

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Field label="Add discipline">
                {({ id }) => (
                  <Select
                    id={id}
                    value={adding.disciplineId}
                    onChange={(e) =>
                      setAdding({ disciplineId: e.target.value, divisionId: '' })
                    }
                  >
                    <option value="">Select…</option>
                    {app.disciplines
                      .filter(
                        (d) =>
                          !(registrations.data ?? []).some((r) => r.disciplineId === d.id),
                      )
                      .map((discipline) => (
                        <option key={discipline.id} value={discipline.id}>
                          {discipline.name}
                        </option>
                      ))}
                  </Select>
                )}
              </Field>
              <Field label="Division in that discipline">
                {({ id }) => (
                  <Select
                    id={id}
                    value={adding.divisionId}
                    disabled={!adding.disciplineId}
                    onChange={(e) => setAdding({ ...adding, divisionId: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {app
                      .divisionsOf(adding.disciplineId)
                      .filter((d) => !d.isP4P)
                      .map((division) => (
                        <option key={division.id} value={division.id}>
                          {division.name}
                        </option>
                      ))}
                  </Select>
                )}
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!adding.disciplineId}
                  loading={busy}
                  icon={<Plus className="size-3.5" />}
                  onClick={addRegistration}
                >
                  Register
                </Button>
              </div>
            </div>
          </Panel>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" loading={busy} icon={<Save className="size-4" />}>
            {isEdit ? 'Save fighter' : 'Add fighter'}
          </Button>
          <Link to="/admin/fighters">
            <Button variant="ghost" type="button">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
