import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ActionMenu, { ActionMenuItem, ActionMenuTrigger } from '@/shared/components/ui/ActionMenu'
import Avatar from '@/shared/components/ui/Avatar'
import Button from '@/shared/components/ui/Button'
import FilterBar from '@/shared/components/ui/FilterBar'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import SectionHeading from '@/shared/components/ui/SectionHeading'
import useToast from '@/shared/hooks/useToast'
import useFilterSearchParams from '@/shared/hooks/useFilterSearchParams'
import { fetchStaffUsers, changeStaffUserRole } from '../api/staff'

const filters = [
  ['all', 'All'], ['regular', 'Regular'], ['premium', 'Members'],
  ['exclusive-writer', 'Exclusive writers'], ['moderator', 'Moderators'], ['admin', 'Admins'],
]
const roleChoices = {
  regular: ['regular', 'exclusive-writer', 'moderator'],
  premium: ['premium', 'exclusive-writer', 'moderator'],
  'exclusive-writer': ['regular', 'exclusive-writer', 'moderator'],
  moderator: ['regular', 'exclusive-writer', 'moderator'],
}
const roleLabels = { regular: 'Regular', premium: 'Member', 'exclusive-writer': 'Exclusive writer', moderator: 'Moderator' }

export default function UserDirectory({ currentUserId }) {
  const [params, setParams] = useFilterSearchParams()
  const role = filters.some(([value]) => value === params.get('staffRole')) ? params.get('staffRole') : 'all'
  const requestedPage = Number(params.get('staffPage'))
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const setPage = update => setParams(current => {
    const nextPage = update(page)
    if (nextPage === 1) current.delete('staffPage')
    else current.set('staffPage', String(nextPage))
    return current
  })
  const [editingUser, setEditingUser] = useState(null)
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const users = useQuery({ queryKey: ['staff', 'users', role, page], queryFn: () => fetchStaffUsers({ role, page }) })
  const changeRole = useMutation({
    mutationFn: changeStaffUserRole,
    onSuccess: () => { setEditingUser(null); queryClient.invalidateQueries({ queryKey: ['staff', 'users'] }); notify('User role updated.') },
    onError: error => notify(error?.response?.data?.message || 'The role change could not be saved.', { tone: 'error' }),
  })
  const changeFilter = nextRole => setParams(current => {
    if (nextRole === 'all') current.delete('staffRole')
    else current.set('staffRole', nextRole)
    current.delete('staffPage')
    return current
  })

  return <section>
    <div className="mb-5 flex items-center justify-between gap-3">
      <SectionHeading className="min-w-0">Users</SectionHeading>
      <FilterBar label="Role" options={filters.map(([id, label]) => ({ id, label }))} value={role} onChange={changeFilter} onReset={() => changeFilter('all')} />
    </div>
    {users.isLoading && <p role="status" className="py-8 text-[13px] text-[var(--color-text-muted)]">Loading users…</p>}
    {users.isError && <div role="alert" className="py-8"><p className="text-[13px] text-[var(--color-danger)]">Users could not be loaded.</p><Button variant="secondary" className="mt-3" onClick={() => users.refetch()}>Try again</Button></div>}
    {!users.isLoading && !users.isError && <>
      <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">{users.data.meta.total} {role === 'all' ? 'users' : filters.find(([value]) => value === role)?.[1].toLowerCase()}</p>
      {users.data.data.length === 0 && <p className="py-12 text-center text-[13px] text-[var(--color-text-muted)]">No users in this role.</p>}
      <div className="space-y-3">{users.data.data.map(user => <UserRow key={user.id} user={user} currentUserId={currentUserId} onEditRole={() => setEditingUser(user)} pending={changeRole.isPending} />)}</div>
      {users.data.meta.total > users.data.meta.pageSize && <div className="mt-5 flex items-center justify-center gap-3"><Button variant="secondary" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</Button><span className="text-[12px] text-[var(--color-text-muted)]">Page {page} of {Math.ceil(users.data.meta.total / users.data.meta.pageSize)}</span><Button variant="secondary" disabled={!users.data.meta.hasMore} onClick={() => setPage(value => value + 1)}>Next</Button></div>}
    </>}
    {editingUser && <EditRoleDialog user={editingUser} pending={changeRole.isPending} onClose={() => setEditingUser(null)} onSave={nextRole => changeRole.mutate({ userId: editingUser.id, role: nextRole })} />}
  </section>
}

function UserRow({ user, currentUserId, onEditRole, pending }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const canEditRole = user.accountStatus === 'active' && user.id !== currentUserId && !!roleChoices[user.role]
  const close = ({ restoreFocus = false } = {}) => { setOpen(false); if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus()) }
  return <article className="flex items-center gap-3 rounded-[16px] border border-[var(--color-border)] p-4">
    <Avatar src={user.picture} name={user.username} size={40} />
    <div className="min-w-0 flex-1"><h2 className="truncate text-[14px] font-semibold text-[var(--color-text)]">{user.username}</h2><p className="truncate text-[12px] text-[var(--color-text-muted)]">{user.email}</p><p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{filters.find(([value]) => value === user.role)?.[1] || user.role}{user.accountStatus === 'suspended' ? ' · Suspended' : ''}</p></div>
    {canEditRole && <div className="relative shrink-0"><ActionMenuTrigger ref={triggerRef} aria-label={`More options for ${user.username}`} aria-expanded={open} aria-controls={open ? `user-options-${user.id}` : undefined} disabled={pending} onClick={() => setOpen(value => !value)} />
      {open && <ActionMenu id={`user-options-${user.id}`} label={`Options for ${user.username}`} anchorRef={triggerRef} onClose={close}>
        <ActionMenuItem icon={<span aria-hidden="true">✎</span>} onClick={() => { close(); onEditRole() }}>Edit role</ActionMenuItem>
        <ActionMenuItem icon={<span aria-hidden="true">×</span>} disabled title="Account removal is unavailable until the suspension and appeal process is ready">Remove user</ActionMenuItem>
      </ActionMenu>}
    </div>}
  </article>
}

function EditRoleDialog({ user, pending, onClose, onSave }) {
  const [selectedRole, setSelectedRole] = useState(user.role)
  const titleId = `edit-role-${user.id}`
  const dismiss = () => { if (!pending) onClose() }
  return <ModalLayer aria-labelledby={titleId} onDismiss={dismiss} className="grid place-items-center p-4">
    <section className="flex w-[min(480px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[18px] bg-[var(--color-surface)] shadow-2xl">
      <ModalHeader title="Edit role" titleId={titleId} subtitle={user.username} onClose={dismiss} closeLabel="Close edit role" />
      <div className="p-4 sm:p-6">
        <p className="mb-4 text-[12px] text-[var(--color-text-secondary)]">Current role: <strong>{roleLabels[user.role]}</strong>. Select a role, then save.</p>
        <fieldset className="relative space-y-2" aria-label="Choose a role">
          <div aria-hidden="true" className="absolute bottom-6 left-[19px] top-6 w-px bg-[var(--color-border)]" />
          {roleChoices[user.role].map(role => <label key={role} className={`relative flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2 text-[13px] ${selectedRole === role ? 'border-[var(--color-accent)] bg-[var(--color-bg-alt)] text-[var(--color-text)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
            <input type="radio" name={`role-${user.id}`} value={role} checked={selectedRole === role} onChange={() => setSelectedRole(role)} disabled={pending} className="h-4 w-4 accent-[var(--color-accent)]" />
            <span className="flex-1">{roleLabels[role]}</span>
            {user.role === role && <span className="text-[11px] text-[var(--color-text-muted)]">Current</span>}
          </label>)}
        </fieldset>
        <div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={dismiss} disabled={pending}>Cancel</Button><Button onClick={() => onSave(selectedRole)} disabled={pending || selectedRole === user.role} aria-busy={pending}>Save role</Button></div>
      </div>
    </section>
  </ModalLayer>
}
