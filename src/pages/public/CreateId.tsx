import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, IdCard } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import {
  Button,
  Container,
  Field,
  Input,
  Panel,
  SectionHeader,
  Select,
  Textarea,
} from '@/components/ui'
import type { FighterApplication } from '@/types/domain'

interface Draft {
  firstName: string
  lastName: string
  displayName: string
  email: string
  dateOfBirth: string
  country: string
  countryCode: string
  heightCm: string
  reachCm: string
  stance: string
  team: string
  disciplineId: string
  divisionId: string
  note: string
}

const EMPTY: Draft = {
  firstName: '',
  lastName: '',
  displayName: '',
  email: '',
  dateOfBirth: '',
  country: '',
  countryCode: '',
  heightCm: '',
  reachCm: '',
  stance: '',
  team: '',
  disciplineId: '',
  divisionId: '',
  note: '',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Apply for a Fighter ID.
 *
 * This creates a request, not an athlete: nothing here reaches the rankings
 * until an administrator approves it, and the ID itself is issued by the
 * database at that moment. Saying so plainly on the form matters — an ID that
 * anyone could mint on demand would be worth nothing.
 */
export default function CreateId() {
  const repository = useRepository()
  const { disciplines, divisionsOf } = useApp()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState<FighterApplication | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const divisions = useMemo(
    () => (draft.disciplineId ? divisionsOf(draft.disciplineId).filter((d) => !d.isP4P) : []),
    [draft.disciplineId, divisionsOf],
  )

  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {}
    if (!draft.firstName.trim()) found.firstName = 'First name is required.'
    if (!draft.lastName.trim()) found.lastName = 'Last name is required.'
    if (!draft.email.trim()) found.email = 'We need an email to reach you about this.'
    else if (!EMAIL_RE.test(draft.email.trim())) found.email = 'That does not look like an email.'
    if (!draft.disciplineId) found.disciplineId = 'Choose the discipline you compete in.'
    if (draft.dateOfBirth) {
      const years =
        (Date.now() - Date.parse(`${draft.dateOfBirth}T00:00:00Z`)) / 31_557_600_000
      if (Number.isNaN(years)) found.dateOfBirth = 'That date is not valid.'
      else if (years < 18) found.dateOfBirth = 'Applicants must be 18 or over.'
      else if (years > 80) found.dateOfBirth = 'Please check the year.'
    }
    const height = Number(draft.heightCm)
    if (draft.heightCm && (Number.isNaN(height) || height < 120 || height > 250)) {
      found.heightCm = 'Height should be between 120 and 250 cm.'
    }
    const reach = Number(draft.reachCm)
    if (draft.reachCm && (Number.isNaN(reach) || reach < 120 || reach > 260)) {
      found.reachCm = 'Reach should be between 120 and 260 cm.'
    }
    return found
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFailure(null)
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    try {
      const application = await repository.submitApplication({
        first_name: draft.firstName.trim(),
        last_name: draft.lastName.trim(),
        display_name:
          draft.displayName.trim() || `${draft.firstName.trim()} ${draft.lastName.trim()}`,
        email: draft.email.trim(),
        date_of_birth: draft.dateOfBirth || null,
        country: draft.country.trim() || null,
        country_code: draft.countryCode.trim().toUpperCase() || null,
        height_cm: draft.heightCm ? Number(draft.heightCm) : null,
        reach_cm: draft.reachCm ? Number(draft.reachCm) : null,
        stance: draft.stance || null,
        team: draft.team.trim() || null,
        discipline_id: draft.disciplineId || null,
        division_id: draft.divisionId || null,
        note: draft.note.trim() || null,
      })
      setSubmitted(application)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setFailure(
        /one_pending|duplicate|unique/i.test(message)
          ? 'There is already an application waiting on that email address.'
          : message,
      )
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <Container className="py-12" size="narrow">
        <Panel className="p-7 text-center">
          <CheckCircle2 className="mx-auto size-9 text-rise" />
          <h1 className="mt-4 text-3xl text-chalk">Application received</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            Keep this reference. An administrator reviews each application, and your Fighter ID is
            issued if it is approved — you do not have one yet.
          </p>
          <div className="mx-auto mt-6 w-fit border border-signal/40 bg-signal-wash px-6 py-4">
            <div className="eyebrow text-[0.6rem]">Your reference</div>
            <div className="numeral mt-1 text-3xl text-signal">{submitted.reference}</div>
          </div>
          <p className="mt-6 text-xs text-faint">
            Submitted as {submitted.email}. We will write to that address with the decision.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/fighter-id">
              <Button variant="secondary" size="sm">
                Look up a Fighter ID
              </Button>
            </Link>
            <Link to="/disciplines">
              <Button variant="ghost" size="sm">
                Browse disciplines
              </Button>
            </Link>
          </div>
        </Panel>
      </Container>
    )
  }

  return (
    <Container className="py-8 sm:py-12" size="narrow">
      <SectionHeader eyebrow="Join the register" title="Create a Fighter ID" level={1} />

      <p className="mb-6 text-sm leading-relaxed text-muted">
        A Fighter ID is the permanent identity an athlete carries on FIGHTRANK — one ID for life,
        with a separate competitive record in each discipline. Apply below and an administrator
        will review it.
      </p>

      <Panel className="mb-6 border-signal/30 bg-signal-wash/30 p-4">
        <div className="flex gap-3">
          <IdCard className="mt-0.5 size-4 shrink-0 text-signal" />
          <p className="text-sm leading-relaxed text-chalk-dim">
            This form creates an <strong className="text-chalk">application</strong>, not an
            athlete. No ID is issued, and nothing appears in the rankings, until it is approved.
            Rankings are built from recorded results only.
          </p>
        </div>
      </Panel>

      <form onSubmit={submit} className="space-y-5">
        <Panel className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="eyebrow sm:col-span-2">Who you are</div>

          <Field label="First name" required error={errors.firstName}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                value={draft.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                autoComplete="given-name"
              />
            )}
          </Field>
          <Field label="Last name" required error={errors.lastName}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                value={draft.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                autoComplete="family-name"
              />
            )}
          </Field>
          <Field
            label="Fighting name"
            hint="Leave blank to use your given name"
            className="sm:col-span-2"
          >
            {({ id }) => (
              <Input
                id={id}
                value={draft.displayName}
                onChange={(e) => set('displayName', e.target.value)}
              />
            )}
          </Field>
          <Field label="Email" required error={errors.email} className="sm:col-span-2">
            {({ id, invalid }) => (
              <Input
                id={id}
                type="email"
                invalid={invalid}
                value={draft.email}
                onChange={(e) => set('email', e.target.value)}
                autoComplete="email"
              />
            )}
          </Field>
          <Field label="Date of birth" error={errors.dateOfBirth}>
            {({ id, invalid }) => (
              <Input
                id={id}
                type="date"
                invalid={invalid}
                value={draft.dateOfBirth}
                onChange={(e) => set('dateOfBirth', e.target.value)}
              />
            )}
          </Field>
          <Field label="Team or academy">
            {({ id }) => (
              <Input id={id} value={draft.team} onChange={(e) => set('team', e.target.value)} />
            )}
          </Field>
        </Panel>

        <Panel className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="eyebrow sm:col-span-2">Where you compete</div>

          <Field label="Discipline" required error={errors.disciplineId}>
            {({ id, invalid }) => (
              <Select
                id={id}
                invalid={invalid}
                value={draft.disciplineId}
                onChange={(e) => {
                  set('disciplineId', e.target.value)
                  set('divisionId', '')
                }}
              >
                <option value="">Select…</option>
                {disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Division" hint="You can be placed later if unsure">
            {({ id }) => (
              <Select
                id={id}
                value={draft.divisionId}
                disabled={!draft.disciplineId}
                onChange={(e) => set('divisionId', e.target.value)}
              >
                <option value="">Not sure yet</option>
                {divisions.map((division) => (
                  <option key={division.id} value={division.id}>
                    {division.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Country">
            {({ id }) => (
              <Input
                id={id}
                value={draft.country}
                onChange={(e) => set('country', e.target.value)}
                autoComplete="country-name"
              />
            )}
          </Field>
          <Field label="Country code" hint="Two letters, e.g. IN">
            {({ id }) => (
              <Input
                id={id}
                maxLength={2}
                value={draft.countryCode}
                onChange={(e) => set('countryCode', e.target.value.toUpperCase())}
              />
            )}
          </Field>
          <Field label="Height (cm)" error={errors.heightCm}>
            {({ id, invalid }) => (
              <Input
                id={id}
                type="number"
                invalid={invalid}
                value={draft.heightCm}
                onChange={(e) => set('heightCm', e.target.value)}
              />
            )}
          </Field>
          <Field label="Reach (cm)" error={errors.reachCm}>
            {({ id, invalid }) => (
              <Input
                id={id}
                type="number"
                invalid={invalid}
                value={draft.reachCm}
                onChange={(e) => set('reachCm', e.target.value)}
              />
            )}
          </Field>
          <Field label="Stance" className="sm:col-span-2">
            {({ id }) => (
              <Select id={id} value={draft.stance} onChange={(e) => set('stance', e.target.value)}>
                <option value="">Not stated</option>
                <option value="orthodox">Orthodox</option>
                <option value="southpaw">Southpaw</option>
                <option value="switch">Switch</option>
              </Select>
            )}
          </Field>
          <Field
            label="Anything else"
            hint="Record so far, promotions you have fought for, links"
            className="sm:col-span-2"
          >
            {({ id }) => (
              <Textarea
                id={id}
                rows={3}
                value={draft.note}
                onChange={(e) => set('note', e.target.value)}
              />
            )}
          </Field>
        </Panel>

        {failure ? (
          <p className="border border-fall/40 bg-fall/10 px-4 py-3 text-sm text-fall">{failure}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={busy} icon={<IdCard className="size-4" />}>
            Submit application
          </Button>
          <Link to="/fighter-id">
            <Button type="button" variant="ghost">
              I already have an ID
            </Button>
          </Link>
        </div>

        <p className="text-xs leading-relaxed text-faint">
          Your email and date of birth are used to identify you and are never shown publicly. This
          installation runs on fictional demonstration data.
        </p>
      </form>
    </Container>
  )
}
