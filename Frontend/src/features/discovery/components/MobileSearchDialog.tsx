import ModalHeader from '@/shared/components/ui/ModalHeader'
import retainRetryView from '@/shared/utils/retainRetryView'
import useOverlayViewport from '@/shared/hooks/useOverlayViewport'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import useReducedMotion from '@/shared/hooks/useReducedMotion'
import Avatar from '@/shared/components/ui/Avatar'
import { SearchIcon } from '@/shared/icons'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import { searchDiscovery } from '../api/search'
import { fetchDiscoveryFeed } from '../api/feed'
import { getTrendingSearches, suggestedSearchTopics } from '../searchPrompts'

type PostSuggestion = { id: string; title: string; image?: string; author?: { username?: string } }
type QuerySuggestion = { text: string; articleCount: number }
type WriterSuggestion = { id: string; handle: string; displayName: string; avatarUrl?: string }
type SearchResponse = { data: { suggestions: QuerySuggestion[]; writers: WriterSuggestion[] } }
type PopularResponse = { data: PostSuggestion[] }
type Suggestion = { kind: 'search'; item: QuerySuggestion } | { kind: 'writer'; item: WriterSuggestion }
type Props = {
  initialQuery: string
  origin: { left: number; width: number }
  onClose: () => void
}

export default function MobileSearchDialog({ initialQuery, origin, onClose }: Props) {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const viewportStyle = useOverlayViewport()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [closing, setClosing] = useState(false)
  const requestClose = useCallback(() => setClosing(true), [])
  const focusDialogRef = useDialogFocus(requestClose, inputRef, true, false)
  const [input, setInput] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery.trim())
  const [activeIndex, setActiveIndex] = useState(-1)
  const listId = useId()
  const popular = retainRetryView(useQuery<PopularResponse>({
    queryKey: ['search-popular-stories'],
    queryFn: () => fetchDiscoveryFeed({ mode: 'popular', sort: 'popular', cursor: null }),
    enabled: !input.trim(),
    staleTime: 60_000,
    retry: false,
  }))
  const trendingSearches = getTrendingSearches(popular.data?.data)
  const result = retainRetryView(useQuery<SearchResponse>({
    queryKey: ['search-suggestions', 'content-v1', query],
    queryFn: () => searchDiscovery({ query, type: 'all', suggestions: true, limit: 5 }),
    enabled: query.length > 0 && query === input.trim(),
    staleTime: 30_000,
    retry: false,
  }))
  const waiting = input.trim() !== query
  const searchItems: Suggestion[] = waiting || result.isError ? [] : (result.data?.data.suggestions || []).slice(0, 5).map(item => ({ kind: 'search' as const, item }))
  const writerItems: Suggestion[] = waiting || result.isError ? [] : (result.data?.data.writers || []).slice(0, 5).map(item => ({ kind: 'writer' as const, item }))
  const items = [...searchItems, ...writerItems]

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    inputRef.current?.focus({ preventScroll: true })
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Return to the navbar on desktop resize rather than leave a hidden modal.
    const media = window.matchMedia('(min-width: 768px)')
    const handleResize = () => { if (media.matches) onClose() }
    media.addEventListener('change', handleResize)
    return () => {
      media.removeEventListener('change', handleResize)
      document.body.style.overflow = previousOverflow
      dialog?.close()
    }
  }, [onClose])

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(input.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [input])

  useEffect(() => {
    const dialog = dialogRef.current
    const option = dialog?.querySelector('[role="option"][aria-selected="true"]')
    if (!dialog || !option) return
    const bounds = dialog.getBoundingClientRect()
    const visibleTop = dialog.firstElementChild?.getBoundingClientRect().bottom || bounds.top
    const row = option.getBoundingClientRect()
    if (row.top < visibleTop) dialog.scrollTop += row.top - visibleTop
    else if (row.bottom > bounds.bottom) dialog.scrollTop += row.bottom - bounds.bottom
  }, [activeIndex])

  const search = (value = input.trim()) => {
    if (!value) return
    onClose()
    navigate(`/search?q=${encodeURIComponent(value)}`)
  }
  const openSuggestion = (suggestion: Suggestion) => {
    onClose()
    navigate(suggestion.kind === 'search' ? `/search?q=${encodeURIComponent(suggestion.item.text)}` : `/author/${suggestion.item.handle}`)
  }

  return createPortal(
    <motion.dialog style={viewportStyle} ref={element => { dialogRef.current = element; focusDialogRef.current = element }} aria-label="Search firstmargin" onCancel={event => { event.preventDefault(); requestClose() }} className="mobile-search-dialog"
      initial={false} animate={{ opacity: closing ? 0 : 1 }} transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.2, 0, 0, 1] }} onAnimationComplete={() => { if (closing) onClose() }}>
      <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2">
        <ModalHeader title="Search firstmargin" titleId={`${listId}-title`} onClose={requestClose} closeLabel="Close search" className="-mx-4 -mt-2 mb-2" />
        <motion.form role="search" onSubmit={event => {
          event.preventDefault()
          const active = items[activeIndex]
          if (active) openSuggestion(active)
          else search()
        }} initial={reducedMotion ? false : { x: origin.left - 16, width: origin.width, height: 38 }} animate={closing ? { x: origin.left - 16, width: origin.width, height: 38 } : { x: 0, width: '100%', height: 46 }} transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.2, 0, 0, 1] }}
          className="flex items-center overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] pl-[14px] pr-1 focus-within:border-[var(--color-focus)]">
          <span aria-hidden="true" className="mr-2 shrink-0"><SearchIcon /></span>
          <input ref={inputRef} type="text" enterKeyHint="search" autoComplete="off" maxLength={100} value={input} placeholder="Search stories and writers…" aria-label="Search stories and writers" role="combobox" aria-autocomplete="list" aria-controls={listId} aria-expanded={input.trim().length > 0} aria-activedescendant={activeIndex >= 0 && items[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            onChange={event => { setInput(event.target.value); setActiveIndex(-1) }}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                requestClose()
                return
              }
              if (!items.length || !['ArrowDown', 'ArrowUp'].includes(event.key)) return
              event.preventDefault()
              setActiveIndex(current => current < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1) : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length)
            }}
            className="mobile-search-input min-w-0 flex-1 border-none bg-transparent py-2 text-[16px] text-[var(--color-text)] outline-none" />
          {input && <button type="button" disabled={closing} aria-label="Clear search" onClick={() => {
            setInput('')
            setQuery('')
            setActiveIndex(-1)
            inputRef.current?.focus({ preventScroll: true })
          }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transparent text-[24px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]">×</button>}
          <button type="button" disabled={!input.trim() || closing} onClick={() => search()} aria-label="Search" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-accent)] hover:bg-[var(--color-bg-alt)] disabled:opacity-40">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16m-6-6 6 6-6 6" /></svg>
          </button>
        </motion.form>
      </div>
      <motion.div className="mobile-search-content px-4 py-6" initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: closing ? 0 : 1, y: closing ? 8 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>
        {!input.trim() ? <>
        <section aria-labelledby={`${listId}-trending`} className="mb-7">
          <h2 id={`${listId}-trending`} className="text-[15px] font-semibold">Trending searches</h2>
          {popular.isPending ? <p role="status" className="py-4 text-[13px] text-[var(--color-text-muted)]">Loading suggestions…</p>
            : popular.isError ? <div className="py-4 text-[13px] text-[var(--color-text-muted)]"><p>Trending suggestions are unavailable.</p><button type="button" onClick={() => popular.refetch()} className="min-h-11 underline underline-offset-2" aria-busy={popular.isFetching} disabled={popular.isFetching}>Try again</button></div>
              : !trendingSearches.length ? <p className="py-4 text-[13px] text-[var(--color-text-muted)]">Explore a topic below while popular stories build up.</p>
                : <ul aria-label="Trending searches" className="mt-3 list-none p-0">{trendingSearches.map(title => <li key={title}><button type="button" onClick={() => search(title.slice(0, 100))} className="flex min-h-11 w-full items-center gap-3 border-b border-[var(--color-border-light)] py-3 text-left text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"><span aria-hidden="true" className="shrink-0"><SearchIcon /></span><span>{title}</span></button></li>)}</ul>}
        </section>
        <section aria-labelledby={`${listId}-topics`}>
          <h2 id={`${listId}-topics`} className="text-[15px] font-semibold">What are you curious about?</h2>
          <ul aria-label="Suggested topics" className="mt-3 list-none p-0">{suggestedSearchTopics.map(topic => <li key={topic}><button type="button" onClick={() => search(topic)} className="flex min-h-11 w-full items-center gap-3 border-b border-[var(--color-border-light)] py-3 text-left text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"><span aria-hidden="true" className="shrink-0 text-[var(--color-text-secondary)]"><SearchIcon /></span><span>{topic}</span></button></li>)}</ul>
        </section></> : <>
          <h2 className="mb-3 text-[15px] font-semibold">Suggestions</h2>
          <div role="status" aria-live="polite" className="text-[13px] text-[var(--color-text-secondary)]">
            {waiting || result.isPending ? <p className="py-5">Searching…</p> : result.isError ? <p className="py-5">Suggestions are unavailable. You can still view all results or try again.</p> : !items.length ? <p className="py-5">No matching searches or authors. Try another phrase.</p> : <span className="sr-only">{items.length} suggestions available</span>}
          </div>
          <div id={listId} role="listbox" aria-label="Search suggestions">
            {[{ label: 'Search suggestions', items: searchItems, offset: 0 }, { label: 'Authors', items: writerItems, offset: searchItems.length }].filter(group => group.items.length).map(group => <div key={group.label} role="group" aria-label={group.label}>
              <h3 className="py-3 text-[12px] font-semibold text-[var(--color-text-secondary)]">{group.label}</h3>
              {group.items.map((suggestion, itemIndex) => { const index = group.offset + itemIndex; return <button key={suggestion.kind === 'search' ? suggestion.item.text : suggestion.item.id} id={`${listId}-${index}`} type="button" role="option" aria-selected={activeIndex === index} tabIndex={-1} onMouseDown={event => event.preventDefault()} onClick={() => openSuggestion(suggestion)}
              className={`button-target flex min-h-16 w-full items-center gap-3 border-b border-[var(--color-border-light)] py-3 text-left ${activeIndex === index ? 'bg-[var(--color-bg-alt)]' : 'hover:bg-[var(--color-surface-hover)]'}`}>
              {suggestion.kind === 'writer' ? <Avatar src={suggestion.item.avatarUrl} name={suggestion.item.displayName} size={40} /> : <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-bg-alt)]"><SearchIcon /></span>}
              <span className="min-w-0 flex-1"><span className="block break-words text-[14px] font-semibold">{suggestion.kind === 'search' ? suggestion.item.text : suggestion.item.displayName}</span>{suggestion.kind === 'writer' && <span className="mt-1 block break-words text-[12px] text-[var(--color-text-muted)]">@{suggestion.item.handle}</span>}</span>
            </button> })}</div>)}
          </div>
          {result.isError && <button type="button" onClick={() => result.refetch()} className="mt-4 min-h-11 text-[13px] underline underline-offset-2" aria-busy={result.isFetching} disabled={result.isFetching}>Try again</button>}
        </>}
      </motion.div>
    </motion.dialog>, document.body,
  )
}
