import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { approveApplication, declineApplication } from '@/services/admin'
import {
  Button,
  EmptyState,
  ErrorState,
  Modal,
  Panel,
  SectionHeader,
  Tabs,
  TableSkeleton,
  Textarea,
} from '@/components/ui'
import type { FighterApplication } from '@/types/domain'
import { shortDate } from '@/lib/format'

type Tab = 'pending' | 'approved' | 'declined'

/**
 * Fighter ID applications.
 *
 * Approving one creates the athlete and issues their permanent ID; declining
 * one records why. Either way the decision is written to the audit log, so the
 * question "who let this person onto the register?" always has an answer.
 */
export default function Applications() {
  const repository = useRepository()
  const app = useApp()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('pending')
  const [declining, setDeclining] = useState<FighterApplication | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, error, loading, reload } = useAsync(
    () => repository.listApplications(tab),
    [repository, tab, app.revision],
  )

  const counts = useAsync(
    async () => {
      const all = await repository.listApplications()
      return {
        pending: all.filter((a) => a.status === 'pending').length,
        approved: all.filter((a) => a.status === 'approved').length,
        declined: all.filter((a) => a.status === 'declined').length,
      }
    },
    [repository, app.revision],
  )

  const approve = async (application: FighterApplication) => {
    setBusy(true)
    try {
      const fighter = await approveApplication(app.context, app.session, application)
      toast.success(
        `Fighter ID issued: ${fighter.fighterCode}`,
        `${fighter.displayName} is now on the register.`,
      )
      app.bumpRevision()
      reload()
      counts.reload()
    } catch (cause) {
      toast.error('Could not approve', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const decline = async () => {
    if (!declining) return
    setBusy(true)
    try {
      await declineApplication(app.context, app.session, declining, reason)
      toast.success('Application declined', declining.reference)
      setDeclining(null)
      setReason('')
      app.bumpRevision()
      reload()
      counts.reload()
    } catch (cause) {
      toast.error('Could not decline', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <SectionHeader
        eyebrow="Requests for a Fighter ID"
        title="Applications"
        level={1}
      />

      <p className="mb-5 max-w-2xl text-sm leading-relaxed text-muted">
        Approving an application creates the athlete and issues their permanent ID. Until then the
        applicant has a reference number and nothing else — no ID, and no presence in the rankings.
      </p>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pending', label: 'Pending', count: counts.data?.pending },
          { value: 'approved', label: 'Approved', count: counts.data?.approved },
          { value: 'declined', label: 'Declined', count: counts.data?.declined },
        ]}
        className="mb-5"
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <TableSkeleton rows={4} />
      ) : !data?.length ? (
        <EmptyState
          title={`No ${tab} applications`}
          description={
            tab === 'pending'
              ? 'Applications submitted from the public Create ID page appear here.'
              : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((application) => (
            <li key={application.id}>
              <Panel className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="numeral text-sm text-signal">{application.reference}</span>
                      <span className="text-lg text-chalk">{application.displayName}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {application.email}
                      {application.team ? ` · ${application.team}` : ''}
                      {application.country ? ` · ${application.country}` : ''}
                      {' · applied '}
                      {shortDate(application.createdAt)}
                    </div>
                    <div className="mt-1 text-xs text-faint">
                      {app.disciplineOf(application.disciplineId)?.name ?? 'No discipline stated'}
                      {application.divisionId
                        ? ` · ${
                            app.divisions.find((d) => d.id === application.divisionId)?.name ?? ''
                          }`
                        : ''}
                    </div>
                    {application.note ? (
                      <p className="mt-2 max-w-xl border-l-2 border-line pl-3 text-xs leading-relaxed text-chalk-dim">
                        {application.note}
                      </p>
                    ) : null}
                    {application.status === 'declined' && application.decisionNote ? (
                      <p className="mt-2 text-xs text-fall">Declined: {application.decisionNote}</p>
                    ) : null}
                    {application.status === 'approved' && application.fighterId ? (
                      <Link
                        to={`/admin/fighters/${application.fighterId}`}
                        className="mt-2 inline-block text-xs text-signal hover:underline"
                      >
                        View the athlete this became →
                      </Link>
                    ) : null}
                  </div>

                  {application.status === 'pending' ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        loading={busy}
                        icon={<Check className="size-3.5" />}
                        onClick={() => approve(application)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<X className="size-3.5" />}
                        onClick={() => {
                          setDeclining(application)
                          setReason('')
                        }}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={declining !== null}
        onClose={() => setDeclining(null)}
        title={`Decline ${declining?.reference ?? ''}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeclining(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={decline}>
              Decline application
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted">
          No ID is issued and no athlete is created. The reason is recorded with the application
          and in the audit log.
        </p>
        <Textarea
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why is this being declined?"
          aria-label="Reason"
        />
      </Modal>
    </div>
  )
}
