import ModalHeader from '@/shared/components/ui/ModalHeader'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import retainRetryView from '@/shared/utils/retainRetryView'
import useToast from '@/shared/hooks/useToast'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import Button from '@/shared/components/ui/Button'
import InfiniteScrollSentinel from '@/shared/components/ui/InfiniteScrollSentinel'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import ViewportPopover from '@/shared/components/ui/ViewportPopover'
import { useClickOutside } from '@/shared/hooks/useClickOutside'
import { ListSkeleton } from '@/shared/components/ui/Skeleton'
import { deleteNotification, fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications'

const notificationTarget = item => item.type === 'direct_request_received' && ['/members', '/studio?writingTab=creator'].includes(item.href) ? '/studio?writingTab=requests' : item.href

export default function NotificationsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const titleId = useId()
  const [anchor, setAnchor] = useState(undefined)
  const anchorRef = useMemo(() => ({ current: anchor }), [anchor])
  // Rebind the focus hook when responsive placement replaces the panel's DOM.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Ref identity must follow the placement anchor.
  const closeRef = useMemo(() => ({ current: null }), [anchor])
  useLayoutEffect(() => {
    const update = () => setAnchor(window.innerWidth >= 768 ? document.getElementById('notification-trigger') : null)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  const onClose = useCallback(() => {
    if (location.state?.notificationBackground) navigate(-1)
    else navigate('/', { replace: true })
  }, [location.state, navigate])
  useEffect(() => {
    if (!anchor) return undefined
    const toggle = event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return
      event.preventDefault()
      onClose()
    }
    anchor.addEventListener('click', toggle)
    return () => anchor.removeEventListener('click', toggle)
  }, [anchor, onClose])
  const panelRef = useDialogFocus(onClose, closeRef, anchor !== undefined)
  useEffect(() => {
    if (anchor === undefined) return undefined
    const frame = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [anchor, closeRef])
  useClickOutside(panelRef, () => { if (anchor) onClose() }, anchorRef)
  const { notify } = useToast()
  const queryClient = useQueryClient()
  // Keep the paginated inbox separate from Navbar's compact unread-count query.
  const notifications = retainRetryView(useInfiniteQuery({
    queryKey: ['notifications', 'inbox'],
    queryFn: ({ pageParam }) => fetchNotifications(pageParam),
    initialPageParam: null,
    getNextPageParam: page => page.meta?.nextCursor || undefined,
    refetchInterval: 60000,
    retry: false,
  }))
  const markOne = useMutation({ mutationFn: markNotificationRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }), onError: () => notify('The notification could not be marked as read.', { tone: 'error' }) })
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['notifications'] }); notify('All notifications marked as read.') }, onError: () => notify('Notifications could not be marked as read.', { tone: 'error' }) })
  const removeOne = useMutation({ mutationFn: deleteNotification, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['notifications'] }); closeRef.current?.focus({ preventScroll: true }); notify('Notification deleted.') }, onError: () => notify('The notification could not be deleted.', { tone: 'error' }) })
  const openNotification = async (event, item) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    if (markOne.isPending || markAll.isPending || removeOne.isPending) return
    try {
      if (!item.readAt) await markOne.mutateAsync(item._id)
      const target = notificationTarget(item)
      if (/^https?:\/\//i.test(target)) window.location.assign(target)
      else navigate(target)
    } catch {
      // The mutation owns error feedback; failed reads retain the inbox.
    }
  }
  const items = notifications.data?.pages.flatMap(page => page.data) || []
  const unreadCount = notifications.data?.pages[0]?.meta?.unreadCount || 0
  const content = <section ref={panelRef} tabIndex={-1} style={anchor ? undefined : { maxHeight: 'calc(var(--overlay-height) - 70px)' }} className={`flex w-full flex-col overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-float)] ${anchor ? 'max-h-[inherit]' : 'max-w-[420px]'}`}>
      <div className="shrink-0">
        <ModalHeader title="Inbox" titleId={titleId} onClose={onClose} closeLabel="Close notifications" closeRef={closeRef} />
        {unreadCount > 0 && <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4"><p className="text-[13px] text-[var(--color-text-secondary)]">{unreadCount} unread</p><Button variant="secondary" disabled={markAll.isPending || markOne.isPending || removeOne.isPending} onClick={() => markAll.mutate()} aria-busy={markAll.isPending}>Mark all read</Button></div>}
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
        {notifications.isLoading ? <div role="status" aria-label="Loading notifications" className="py-5"><ListSkeleton count={5} role={undefined} /></div>
          : notifications.isError && !notifications.data ? <div className="py-10"><p role="alert" className="text-[13px] text-[var(--color-danger)]">Notifications could not be loaded.</p><Button className="mt-4" variant="secondary" onClick={() => notifications.refetch()} aria-busy={notifications.isFetching} disabled={notifications.isFetching}>Try again</Button></div>
            : <>
              {items.length === 0 && <p className="py-8 text-center text-[13px] text-[var(--color-text-secondary)]">Comments, follows, appreciations, answers, request updates, and competition results will appear here.</p>}
              <div>{items.map(item => <div key={item._id} className="flex items-start gap-1 border-b border-[var(--color-border)] py-5 last:border-b-0"><Link to={notificationTarget(item)} onClick={event => openNotification(event, item)} aria-disabled={markOne.isPending || markAll.isPending || removeOne.isPending || undefined} aria-busy={markOne.isPending && markOne.variables === item._id} className={`flex min-w-0 flex-1 gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus)] ${item.readAt ? 'opacity-65' : ''}`}><span aria-hidden="true" className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-transparent' : 'bg-[var(--color-accent)]'}`} /><div className="min-w-0 break-words"><h3 className="text-[14px] font-semibold text-[var(--color-text)]">{item.title}</h3>{item.body && <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{item.body}</p>}<p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">{!item.readAt && <span>Unread · </span>}<time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></p></div></Link><div className="flex shrink-0 items-start gap-1"><Button variant="ghost" size="sm" className="!px-2" leadingIcon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 12 5 5L20 6" /></svg>} onClick={() => markOne.mutate(item._id)} disabled={Boolean(item.readAt) || markOne.isPending || markAll.isPending || removeOne.isPending} aria-busy={markOne.isPending && markOne.variables === item._id} aria-label={item.readAt ? `Notification already read: ${item.title}` : `Mark notification as read: ${item.title}`} /><Button variant="ghost" size="sm" className="!px-2" leadingIcon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>} onClick={() => removeOne.mutate(item._id)} disabled={removeOne.isPending || markOne.isPending || markAll.isPending} aria-busy={removeOne.isPending && removeOne.variables === item._id} aria-label={`Delete notification: ${item.title}`} /></div></div>)}</div>
              {notifications.isRefetchError && <p role="alert" className="mt-4 text-[13px] text-[var(--color-danger)]">Notifications could not be refreshed.<Button className="ml-3" variant="secondary" onClick={() => notifications.refetch()} aria-busy={notifications.isFetching} disabled={notifications.isFetching}>Try again</Button></p>}
              <InfiniteScrollSentinel query={notifications} className="mt-5" label="Loading older notifications" />
            </>}
      </div>
    </section>
  if (anchor === undefined) return null
  return anchor ? <ViewportPopover anchorRef={anchorRef} preferredSide="bottom" onAnchorHidden={onClose} role="dialog" aria-labelledby={titleId} className="w-[360px] rounded-[14px]" style={{ maxHeight: 480 }}>{content}</ViewportPopover>
    : <ModalLayer aria-labelledby={titleId} onDismiss={onClose} className="flex items-start justify-end px-4 pb-4 pt-[54px]">{content}</ModalLayer>
}
