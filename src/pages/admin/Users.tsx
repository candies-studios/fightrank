import { useState } from 'react'
import { ShieldCheck, UserCog } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { updateUserRole } from '@/services/admin'
import { isOwner } from '@/data/auth'
import type { UserRole } from '@/types/domain'
import {
  EmptyState,
  ErrorState,
  Panel,
  SectionHeader,
  Select,
  TableSkeleton,
} from '@/components/ui'

const ROLE_NOTES: Record<UserRole, string> = {
  admin: 'Full access, including managing users and roles.',
  editor: 'Can record results and manage fighters, events and settings.',
  viewer: 'Read-only. Cannot open the admin panel.',
}

export default function Users() {
  const repository = useRepository()
  const app = useApp()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  const { data, error, loading, reload } = useAsync(
    () => repository.listUsers(),
    [repository, app.revision],
  )

  const owner = isOwner(app.session)

  const changeRole = async (userId: string, role: UserRole) => {
    setBusy(userId)
    try {
      await updateUserRole(app.context, app.session, userId, role)
      toast.success('Role updated')
      reload()
    } catch (cause) {
      toast.error('Could not update role', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader eyebrow="Access control" title="Users"
        level={1} />

      <Panel className="mb-6 flex items-start gap-3 p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-signal" />
        <div className="text-xs leading-relaxed text-muted">
          <p className="mb-1 text-chalk-dim">How access works</p>
          <p>
            Roles are enforced in the database by Row Level Security, not in this interface. Public
            visitors can read competitive data; only <code className="text-chalk">admin</code> and{' '}
            <code className="text-chalk">editor</code> accounts can write anything, and only{' '}
            <code className="text-chalk">admin</code> can change a role. The service-role key is
            never used in the browser.
          </p>
        </div>
      </Panel>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <TableSkeleton rows={5} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="The first account to sign up becomes an administrator."
          icon={<UserCog className="size-6" />}
        />
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-ink-850 text-left">
                {['User', 'Role', 'Since'].map((h) => (
                  <th key={h} className="eyebrow px-3 py-2 text-[0.6rem]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.map((user) => (
                <tr key={user.id} className="border-b border-line-soft">
                  <td className="px-3 py-2.5">
                    <div className="text-chalk">{user.displayName ?? user.email}</div>
                    <div className="text-xs text-faint">{user.email}</div>
                    {user.id === app.session?.userId ? (
                      <div className="text-[0.65rem] uppercase tracking-wider text-signal">You</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <Select
                      value={user.role}
                      disabled={!owner || busy === user.id || user.id === app.session?.userId}
                      onChange={(e) => changeRole(user.id, e.target.value as UserRole)}
                      className="w-32"
                      aria-label={`Role for ${user.email}`}
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </Select>
                    <div className="mt-1 max-w-56 text-xs text-faint">{ROLE_NOTES[user.role]}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">
                    {new Date(user.createdAt).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!owner ? (
        <p className="mt-4 text-xs text-faint">
          Only an account with the admin role can change roles.
        </p>
      ) : null}
    </div>
  )
}
