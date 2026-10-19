import Select from '@/shared/components/ui/Select'
import { useState, useRef, forwardRef, useEffect, useLayoutEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { v4 as uuid } from 'uuid'
import Button from '@/shared/components/ui/Button'
import SlashMenu from '../components/SlashMenu'
import TagPicker from '../components/TagPicker'
import MobileBlockMenu from '../components/MobileBlockMenu'
import MobileEditorCommands from '../components/MobileEditorCommands'
import useWritingHistory from '../hooks/useWritingHistory'
import createPost from '../api/createPost'
import fetchDepthOptions from '../api/fetchDepthOptions'
import useEntitlements from '@/features/membership/hooks/useEntitlements'
import { createDraft, deleteDraft, fetchDraft, updateDraft } from '../api/drafts'
import { updatePost } from '../api/updatePost'
import fetchPost from '@/features/post/api/fetchPost'
import useToast from '@/shared/hooks/useToast'
import { useSelector } from 'react-redux'
import PageFrame from '@/shared/components/layout/PageFrame'
import SignInPrompt from '@/shared/components/ui/SignInPrompt'
import ModalLayer from '@/shared/components/ui/ModalLayer'
import ModalHeader from '@/shared/components/ui/ModalHeader'
import useDialogFocus from '@/shared/hooks/useDialogFocus'
import useLoginPrompt from '@/features/auth/hooks/useLoginPrompt'
import BackButton from '@/shared/components/ui/BackButton'

// Block Input Types
const BLOCK_TYPES = [
  { type: 'text',    label: 'Text',       icon: '¶' },
  { type: 'h1',      label: 'Heading 1',  icon: 'H1' },
  { type: 'h2',      label: 'Heading 2',  icon: 'H2' },
  { type: 'h3',      label: 'Heading 3',  icon: 'H3' },
  { type: 'quote',   label: 'Quote',      icon: '❝' },
  { type: 'code',    label: 'Code',       icon: '</>' },
  { type: 'image',   label: 'Image URL',  icon: '🖼' },
  { type: 'divider', label: 'Divider',    icon: '—' },
]

// Adding a new block
function newBlock(type = 'text') {
  return { 
    id: uuid(), 
    type, 
    content: '' 
  }
}

const postEditFields = (post, blocks) => ({
  title: post.title || '',
  blocks,
  tags: post.tags || [],
  publicAt: post.publicAt ? new Date(post.publicAt).toISOString().slice(0, 16) : '',
})

const samePostEditFields = (left, right) => left.title === right.title
  && JSON.stringify(left.blocks) === JSON.stringify(right.blocks)
  && JSON.stringify(left.tags) === JSON.stringify(right.tags)
  && left.publicAt === right.publicAt

// Editor for studio draft, edit, and question routes.
export default function WritePage() {
  const isReady = useSelector(state => state.auth.isReady)
  const user = useSelector(state => state.auth.user)
  const [params] = useSearchParams()
  if (!isReady) return <PageFrame><p role="status">Restoring your session…</p></PageFrame>
  if (!user && (params.get('draft') || params.get('edit'))) return <PageFrame className="flex min-h-full flex-col !py-6"><SignInPrompt message="Sign in to access your saved story." /></PageFrame>
  return <MemberEditor />
}

function MemberEditor() {
  const editorUser = useSelector(state => state.auth.user)
  const loggedIn = Boolean(editorUser)
  const signIn = useLoginPrompt()

  // State and refs
  const navigate  = useNavigate()
  const { notify } = useToast()
  const [searchParams] = useSearchParams()
  const { hash } = useLocation()
  const sourceQuestionId = searchParams.get('question')
  const editPostId = searchParams.get('edit')
  const editStorageKey = editPostId && editorUser
    ? `ink-rider:post-edit:${String(editorUser.id || editorUser._id || editorUser.email || editorUser.username || editorUser)}:${editPostId}`
    : null
  const initialDraftId = editPostId ? null : searchParams.get('draft')
  const { title, blocks, setTitle, setBlocks, reset: resetWritingHistory, undo, redo, canUndo, canRedo, restore } = useWritingHistory(() => [newBlock()])
  const [format, setFormat] = useState(searchParams.get('new') === 'short' ? 'short' : 'article')
  const [depthParentId, setDepthParentId] = useState('')
  const [publicAt, setPublicAt] = useState('')
  const [slashMenu, setSlashMenu] = useState({ 
    open: false, 
    blockId: null, 
    position: { x: 0, y: 0 }, 
    filter: '' 
  })
  const [tags,    setTags]    = useState([])
  const [cover,   setCover]   = useState(null)
  const [coverURL, setCoverURL] = useState('')
  const [publishOpen, setPublishOpen] = useState(false)
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [activeBlockId, setActiveBlockId] = useState(null)
  const [phoneCommandsVisible, setPhoneCommandsVisible] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(null)
  const [isCompact, setIsCompact] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const [draftId, setDraftId] = useState(initialDraftId)
  const [draftVersion, setDraftVersion] = useState(null)
  const [postRevision, setPostRevision] = useState(null)
  const [autosaveStatus, setAutosaveStatus] = useState(initialDraftId ? 'loading' : 'idle')
  const [scheduleBounds] = useState(() => {
    const now = new Date()
    return {
      min: now.toISOString().slice(0, 16),
      max: new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 16),
    }
  })
  const fileRef   = useRef()
  const titleRef = useRef(null)
  const instructionsTriggerRef = useRef(null)
  const instructionsCloseRef = useRef(null)
  const instructionsDialogRef = useDialogFocus(() => setInstructionsOpen(false), instructionsCloseRef, instructionsOpen)
  const publishTriggerRef = useRef(null)
  const publishCloseRef = useRef(null)
  const closePublish = () => { if (!isPending) setPublishOpen(false) }
  const publishDialogRef = useDialogFocus(closePublish, publishCloseRef, publishOpen)
  const blockRefs  = useRef({})
  const altRefs = useRef({})
  const captureWritingFocus = fallbackBlockId => {
    const active = document.activeElement
    const id = active === titleRef.current ? 'title'
      : Object.keys(blockRefs.current).find(blockId => blockRefs.current[blockId] === active)
        || Object.keys(altRefs.current).map(blockId => `alt:${blockId}`).find(altId => altRefs.current[altId.slice(4)] === active)
        || fallbackBlockId
    if (!id) return null
    return { id, start: active?.selectionStart ?? 0, end: active?.selectionEnd ?? 0 }
  }
  const editBlocks = (updater, options = {}) => {
    const beforeFocus = options.beforeFocus || captureWritingFocus(options.blockId)
    setBlocks(updater, { ...options, beforeFocus, afterFocus: options.afterFocus || beforeFocus })
  }
  useLayoutEffect(() => {
    if (!restore) return
    const field = restore.id === 'title' ? titleRef.current
      : restore.id?.startsWith('alt:') ? altRefs.current[restore.id.slice(4)] : blockRefs.current[restore.id]
    if (!field) return
    field.focus({ preventScroll: true })
    if (field.setSelectionRange) {
      const start = Math.min(restore.start || 0, field.value.length)
      field.setSelectionRange(start, Math.min(restore.end ?? start, field.value.length))
    }
  }, [restore])
  const handleHistoryKey = event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return
    const key = event.key.toLowerCase()
    if (key !== 'z' && key !== 'y') return
    const isRedo = key === 'y' || event.shiftKey
    event.preventDefault()
    if (isRedo) redo()
    else undo()
    closeSlashMenu()
  }
  const slashAnchorRef = useRef(null)
  const editorRef = useRef()
  const hydratedDraftRef = useRef(!initialDraftId && !editPostId)
  const draftIdRef = useRef(initialDraftId)
  const draftVersionRef = useRef(null)
  const wordCount = blocks.reduce((count, block) => count + String(block.content || '').trim().split(/\s+/).filter(Boolean).length, 0)
  const focusNearestWritingField = event => {
    if (event.target.closest('textarea, input, button, label, a, [role="listbox"]')) return
    const fields = [titleRef.current, ...blocks.map(block => blockRefs.current[block.id])]
      .filter(field => field instanceof HTMLTextAreaElement)
    const nearest = fields.reduce((best, field) => {
      const rect = field.getBoundingClientRect()
      const distance = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom)
      return !best || distance < best.distance ? { field, distance } : best
    }, null)
    if (!nearest) return
    event.preventDefault()
    requestAnimationFrame(() => {
      nearest.field.focus({ preventScroll: true })
    })
  }
  const hasStory = blocks.some(block => block.type !== 'divider' && String(block.content || '').trim())
  const hasDraftContent = Boolean(title.trim() || blocks.some(block => String(block.content || '').trim()))
  const writingRequirements = [!title.trim() && 'add a title', !hasStory && 'write your story'].filter(Boolean)
  const publishRequirements = [...writingRequirements, format === 'short' && wordCount > 500 && 'reduce your short to 500 words'].filter(Boolean)
  const depthOptions = useQuery({ queryKey: ['depth-options'], queryFn: fetchDepthOptions, enabled: loggedIn && format === 'short' })
  const entitlements = useEntitlements(loggedIn)
  const canScheduleEarlyAccess = loggedIn && entitlements.data?.capabilities?.includes('early_access')
  const draftQuery = useQuery({ queryKey: ['draft', initialDraftId], queryFn: () => fetchDraft(initialDraftId), enabled: loggedIn && Boolean(initialDraftId), retry: false, refetchOnMount: 'always' })
  const editQuery = useQuery({ queryKey: ['post', editPostId], queryFn: fetchPost, enabled: loggedIn && Boolean(editPostId), retry: false, refetchOnMount: 'always' })

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => { setIsCompact(media.matches); setMobileMenu(null) }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useLayoutEffect(() => {
    const field = titleRef.current
    if (!field) return undefined
    const resize = () => { field.style.height = 'auto'; field.style.height = `${field.scrollHeight}px` }
    resize()
    window.addEventListener('resize', resize)
    document.fonts?.ready.then(resize)
    return () => window.removeEventListener('resize', resize)
  }, [title, format])

  useEffect(() => {
    if (!draftQuery.data || draftQuery.isFetching || hydratedDraftRef.current) return
    const draft = draftQuery.data
    resetWritingHistory(draft.title || '', draft.blocks?.length ? draft.blocks : [newBlock()])
    setFormat(draft.format || 'article')
    setTags(draft.tags || [])
    setPublicAt(draft.publicAt ? new Date(draft.publicAt).toISOString().slice(0, 16) : '')
    setDraftVersion(draft.version)
    draftVersionRef.current = draft.version
    hydratedDraftRef.current = true
    setAutosaveStatus('saved')
  }, [draftQuery.data, draftQuery.isFetching, resetWritingHistory])

  useEffect(() => {
    if (!editQuery.data || editQuery.isFetching || initialDraftId || hydratedDraftRef.current) return
    const post = editQuery.data
    let parsedBlocks
    try { parsedBlocks = JSON.parse(post.body) } catch { parsedBlocks = [newBlock()] }
    const publishedFields = postEditFields(post, parsedBlocks)
    let savedEdit = null
    try {
      const stored = editStorageKey && localStorage.getItem(editStorageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed.title === 'string' && Array.isArray(parsed.blocks) && Array.isArray(parsed.tags)
          && Number.isInteger(parsed.expectedRevision) && parsed.expectedRevision > 0) savedEdit = parsed
      }
    } catch { /* Unavailable or invalid browser storage should not block editing. */ }
    if (savedEdit && samePostEditFields(savedEdit, publishedFields)) {
      try { localStorage.removeItem(editStorageKey) } catch { /* Ignore an unavailable storage cleanup. */ }
      savedEdit = null
    }
    resetWritingHistory(savedEdit?.title ?? post.title ?? '', savedEdit?.blocks || parsedBlocks)
    setFormat(post.format || 'article')
    setTags(savedEdit?.tags || post.tags || [])
    setCover(post.coverImage || null)
    setPostRevision(savedEdit?.expectedRevision || post.currentRevision || 1)
    setPublicAt(savedEdit?.publicAt ?? (post.publicAt ? new Date(post.publicAt).toISOString().slice(0, 16) : ''))
    hydratedDraftRef.current = true
    setAutosaveStatus(savedEdit && savedEdit.expectedRevision !== (post.currentRevision || 1) ? 'conflict' : 'saved')
  }, [editQuery.data, editQuery.isFetching, editStorageKey, initialDraftId, resetWritingHistory])

  useEffect(() => {
    draftIdRef.current = draftId
    draftVersionRef.current = draftVersion
  }, [draftId, draftVersion])

  useEffect(() => {
    if (!editStorageKey || !postRevision || !hydratedDraftRef.current || !editQuery.data) return
    let nextStatus = 'saved'
    try {
      const currentFields = { title, blocks, tags, publicAt }
      let publishedBlocks
      try { publishedBlocks = JSON.parse(editQuery.data.body) } catch { publishedBlocks = [] }
      if (samePostEditFields(currentFields, postEditFields(editQuery.data, publishedBlocks))) {
        localStorage.removeItem(editStorageKey)
      } else {
        localStorage.setItem(editStorageKey, JSON.stringify({ ...currentFields, expectedRevision: postRevision }))
      }
    } catch {
      nextStatus = 'error'
    }
    const frame = requestAnimationFrame(() => setAutosaveStatus(current => current === 'conflict' ? current : nextStatus))
    return () => cancelAnimationFrame(frame)
  }, [editStorageKey, postRevision, editQuery.data, title, blocks, tags, publicAt])

  useEffect(() => {
    if (!loggedIn || editPostId || !hydratedDraftRef.current || draftQuery.isError || !hasDraftContent) return
    setAutosaveStatus('waiting')
    const timer = window.setTimeout(async () => {
      const payload = { title, format, blocks, tags, publicAt: publicAt ? new Date(publicAt).toISOString() : null }
      try {
        setAutosaveStatus('saving')
        const result = draftIdRef.current
          ? await updateDraft({ draftId: draftIdRef.current, expectedVersion: draftVersionRef.current, ...payload })
          : await createDraft(payload)
        if (!draftIdRef.current) {
          draftIdRef.current = result.id
          setDraftId(result.id)
          const next = new URLSearchParams(searchParams)
          next.set('draft', result.id)
          navigate({ search: `?${next}`, hash }, { replace: true })
        }
        draftVersionRef.current = result.version
        setDraftVersion(result.version)
        setAutosaveStatus('saved')
      } catch (saveError) {
        setAutosaveStatus(saveError?.response?.status === 409 ? 'conflict' : 'error')
      }
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [loggedIn, editPostId, title, format, blocks, tags, publicAt, hasDraftContent, draftQuery.isError, searchParams, navigate, hash])

  // Creating Post
  const { mutate, isPending, isError, error } = useMutation({
    mutationFn: input => editPostId ? updatePost(input) : createPost(input),
    onSuccess: (response) => {
      if (editStorageKey) {
        try { localStorage.removeItem(editStorageKey) } catch { /* The update succeeded even if storage is unavailable. */ }
      }
      if (!editPostId && draftIdRef.current) deleteDraft(draftIdRef.current).catch(() => {})
      notify(editPostId ? 'Story updated.' : 'Story published.')
      // Replace the draft editor entry so browser Back cannot reopen the
      // draft after it has been deleted following publication.
      navigate(`/post/${editPostId || response.postId}`, { replace: true });
      // displayNotification(response.message);
    },
    onError: (error) => {
      const message = error?.response?.data?.message || 'An error occurred while creating the story.';
      notify(message, { tone: 'error' })
      // displayNotification(message, 'error');
    },
  });
  
  // Submitting Form
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loggedIn || publishRequirements.length || isPending || (editPostId && !postRevision)) return
    if (editPostId) {
      mutate({ postId: editPostId, expectedRevision: postRevision, title, body: JSON.stringify(blocks), tags, publicAt: publicAt ? new Date(publicAt).toISOString() : undefined })
      return
    }
    const formData = new FormData();
    formData.append('coverURL', coverURL);
    formData.append('title', title);
    formData.append('body', JSON.stringify(blocks));
    formData.append('tags', tags);
    formData.append('format', format);
    if (format === 'short' && depthParentId) formData.append('depthParentId', depthParentId);
    if (sourceQuestionId) formData.append('questionId', sourceQuestionId);
    if (publicAt) formData.append('publicAt', new Date(publicAt).toISOString());
    mutate(formData);
  };
  
  // Input Handlers
  const handleCoverImage = (e) => {
    const f = e.target.files[0];
    if (f){
      setCoverURL(f)
      setCover(URL.createObjectURL(f));
      
    } 
  }

  // Block update and edit operations
  const updateBlock = (id, val, kind = 'typing') => {
    editBlocks(b => b.map(bl => bl.id === id ? { ...bl, content: val } : bl), { kind, field: id, blockId: id })
  }
  const updateBlockField = (id, field, val) => {
    editBlocks(current => current.map(block => block.id === id ? { ...block, [field]: val } : block), { kind: 'typing', field: `${id}:${field}`, blockId: `alt:${id}` })
  }
  const deleteBlock = (id) => {
    let focusBlkId = null;
    
    // If last, Prevent deleting the last block
    if(blocks.length === 1) {
      const newBlk = newBlock();
      editBlocks([newBlk], { blockId: id, afterFocus: { id: newBlk.id, start: 0, end: 0 } });
      focusBlkId = newBlk.id
    }
    // Otherwise, Delete current block
    else{
      const idx = blocks.findIndex(bl => bl.id === id);
      focusBlkId = idx > 0 ? blocks[idx - 1].id : blocks[1].id;
      editBlocks(b => b.length > 1 ? b.filter(bl => bl.id !== id) : b, { blockId: id, afterFocus: { id: focusBlkId, start: 0, end: 0 } })
    }

    // Focus on the new block after deletion
    setTimeout(() => {
      placeCaretAtEnd(blockRefs.current[focusBlkId]);
    }, 0);
  }
  // Add a block after the given block, optionally with initial content
  const addAfter = (id, initialContent = '', type = 'text', beforeContent = null) => {
    const newBlk = newBlock(type);
    if (initialContent) newBlk.content = initialContent;

    editBlocks(b => {
      const i = b.findIndex(bl => bl.id === id); 
      if(i === -1) return b;
      const nb = [...b];
      if (beforeContent !== null) nb[i] = { ...nb[i], content: beforeContent }
      nb.splice(i + 1, 0, newBlk);
      return nb;
    }, { blockId: id, afterFocus: { id: newBlk.id, start: 0, end: 0 } });

    setTimeout(() => {
      blockRefs.current[newBlk.id]?.focus();
      if (initialContent) {
        // Move cursor to start if content was split
        const el = blockRefs.current[newBlk.id];
        if (el && el.setSelectionRange) el.setSelectionRange(0, 0);
      }
    }, 0);
  }
  const changeType = (id, type) => {
    if (blocks.find(block => block.id === id)?.type === type) return
    editBlocks(b => b.map(bl => bl.id === id ? { ...bl, type } : bl), { blockId: id })
  }
  // Slash menu handlers
  const openSlashMenu = (blockId, filter = '', commandRange = null) => {
    const blockEl = blockRefs.current[blockId];
    const editorEl = editorRef.current;

    if (!blockEl || !editorEl) return;
    slashAnchorRef.current = blockEl;

    const scrollArea = blockEl.closest('[data-app-scroll]')
    const bottomBar = document.querySelector('[aria-label="Mobile primary navigation"]')
    const usableBottom = bottomBar?.getBoundingClientRect().top || window.innerHeight
    const scrollBy = blockEl.getBoundingClientRect().bottom - usableBottom + 8
    if (scrollArea && scrollBy > 0) {
      const previousScroll = scrollArea.scrollTop
      scrollArea.scrollTop += scrollBy
      if (scrollArea.scrollTop > previousScroll) {
        requestAnimationFrame(() => openSlashMenu(blockId, filter, commandRange))
        return
      }
    }

    const blockRect = blockEl.getBoundingClientRect();
    const editorRect = editorEl.getBoundingClientRect();

    const MENU_HEIGHT = 200;

    // Position relative to editor
    let y = blockRect.bottom - editorRect.top + 10

    // Detect viewport overflow
    const wouldOverflow = blockRect.bottom + MENU_HEIGHT > window.innerHeight;

    // Open upward if needed
    if (wouldOverflow)
      y = blockRect.top - editorRect.top - MENU_HEIGHT - 10;

    setSlashMenu({ open: true, blockId, position: { x: 0, y }, filter, commandRange })
  }
  const closeSlashMenu = () => {
    setSlashMenu({ open: false, blockId: null, position: { x: 0, y: 0 }, filter: '' })
  }
  const handleSlashSelect = (item) => {
    const { blockId, commandRange } = slashMenu
    if (slashMenu.mode === 'insert' && item) {
      addAfter(blockId, '', item.type)
      closeSlashMenu()
      return
    }
    if (blockId && item) {
      editBlocks(current => current.map(block => {
        if (block.id !== blockId) return block
        const { start, end } = commandRange || {}
        const content = Number.isInteger(start) && block.content.slice(start, end) === `/${slashMenu.filter}`
          ? block.content.slice(0, start) + block.content.slice(end)
          : block.content
        return { ...block, type: item.type, content }
      }), { blockId })
    }
    closeSlashMenu()
    // Refocus block
    setTimeout(() => {
      blockRefs.current[blockId]?.focus();
    }, 0)
  }

  const openBlockInsert = (blockId, event) => {
    if (isCompact) { setMobileMenu({ blockId, mode: 'insert' }); return }
    slashAnchorRef.current = event.currentTarget
    setSlashMenu({ open: true, blockId, mode: 'insert', position: { x: 0, y: 0 }, filter: '' })
  }

  const selectMobileBlock = option => {
    const { blockId, mode } = mobileMenu
    if (mode === 'insert') addAfter(blockId, '', option.type)
    else { changeType(blockId, option.type); setTimeout(() => blockRefs.current[blockId]?.focus(), 0) }
    setMobileMenu(null)
    if (mode === 'type') requestAnimationFrame(() => requestAnimationFrame(() => blockRefs.current[blockId]?.focus()))
  }

  useEffect(() => {
    const onFocus = event => {
      if (event.target.closest?.('[data-mobile-editor-commands]')) return
      setPhoneCommandsVisible(Boolean(event.target.closest?.('[data-editor-block]') && event.target.matches('textarea')))
    }
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [])

  const selectPhoneCommand = option => {
    if (!activeBlockId) return
    changeType(activeBlockId, option.type)
    requestAnimationFrame(() => blockRefs.current[activeBlockId]?.focus({ preventScroll: true }))
  }

  const moveFocus = (id, dir) => {
    const i = blocks.findIndex(b => b.id === id);
    const nextIdx = i + dir;
    if (nextIdx >= 0 && nextIdx < blocks.length) {
      const nextId = blocks[nextIdx].id;
      setTimeout(() => {
        blockRefs.current[nextId]?.focus();
      }, 0);
    }
  }

  const mergeToPrevBlock = (id, content) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx === 0) return;

    const blk = blocks[idx];
    const prevBlk = blocks[idx - 1];
    
    if (blk.type === 'image' || prevBlk.type === 'image') return;
    
    editBlocks(prev =>
      prev
       .map((b, i) => (i === idx - 1) ? {...b, content: b.content + content} : b)
       .filter(b => b.id !== blk.id)
    , { blockId: id, afterFocus: { id: prevBlk.id, start: prevBlk.content.length, end: prevBlk.content.length } });
    
    setTimeout(() => {
      const textarea = blockRefs.current[prevBlk.id];
      const cursorPos = prevBlk.content.length;
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0)
  }

  const placeCaretAtEnd = (el) => {
    if (!el) return;
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      // For textarea or input
      if (el.setSelectionRange && typeof el.value === 'string') {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      } else {
        // For contenteditable
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });
  };

  // Copy content into blocks
  const copyPasteContent = async (id) => {
    try {
      const content = await navigator.clipboard.readText();
      const contentArray = content
        .split('\n')
        .map(line => line.replace(/\n/g, '').trimEnd())
        .filter(line => line !== '');
      if (contentArray.length === 0) return;

      editBlocks(prev => {
        const idx = prev.findIndex(bl => bl.id === id);
        if (idx === -1) return prev;
        // Replace current block with first line, insert rest after
        const updated = [...prev];
        updated[idx] = { ...updated[idx], content: contentArray[0] };
        const newBlocks = contentArray.slice(1).map(c => ({
          id: uuid(),
          type: "text",
          content: c
        }));
        updated.splice(idx + 1, 0, ...newBlocks);
        return updated;
      }, { blockId: id });
    } catch {
      notify('Clipboard access was denied. Paste your text directly into the editor.', { tone: 'error' });
    }
  }

  // useEffect(() => {
  //   document.addEventListener('mouseup', handleTextSelection);
  //   document.addEventListener('keyup', handleTextSelection);
  //   return () => {
  //     document.removeEventListener('mouseup', handleTextSelection);
  //     document.removeEventListener('keyup', handleTextSelection);
  //   };
  // }, []);

  return (
    <PageFrame className="!pt-6 !pb-2 lg:!pt-8">

      {/* <HoveringMenu position={menuPosition} onFormat={applyFormatting} /> */}
      <div className="mb-4"><BackButton fallbackTo={loggedIn ? '/studio?writingTab=drafts' : '/'} className="-ml-2" disabled={Boolean(coverURL) || ['waiting', 'saving', 'error', 'conflict'].includes(autosaveStatus)} /></div>
      <header className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--color-border)] pb-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">Editing</p>
          <h1 className="mt-2 text-[24px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{editPostId ? 'Edit' : 'Write'} {format === 'short' ? 'Short' : 'Story'}</h1>
          <p role="status" aria-live="polite" className={`mt-1 text-[12px] ${['conflict', 'error'].includes(autosaveStatus) ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`}>
            {!loggedIn ? 'Sign in to save your draft.' : autosaveStatus === 'loading' ? 'Loading draft…' : autosaveStatus === 'saving' ? 'Saving…' : autosaveStatus === 'conflict' ? editPostId ? 'Story changed in another session' : 'Draft conflict' : autosaveStatus === 'error' ? 'Save failed' : autosaveStatus === 'saved' ? editPostId ? '✓ Saved on this device' : '✓ Saved' : autosaveStatus === 'waiting' ? 'Unsaved changes' : 'Autosave on'}
          </p>
        </div>

      <div className="ml-auto flex items-center gap-3">
        <button ref={instructionsTriggerRef} type="button" onClick={() => setInstructionsOpen(true)} className="flex h-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[13px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]">Instructions</button>
          <Button
            ref={publishTriggerRef}
            variant="primary"
            className="!min-h-11"
            disabled={Boolean(writingRequirements.length) || isPending || Boolean(editPostId && !postRevision)}
            data-disabled-reason={isPending ? 'Publication is in progress.' : editPostId && !postRevision ? 'The story is still loading.' : writingRequirements.length ? `To publish, ${writingRequirements.join(' and ')}.` : undefined}
            onClick={() => loggedIn ? setPublishOpen(true) : signIn()}>
            {editPostId ? 'Update' : 'Publish'}
          </Button>
      </div>

      </header>

      {sourceQuestionId && <div className="mb-6 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-4 py-3 text-[12px] text-[var(--color-text-secondary)]">This story will be published as a response to a reader question.</div>}
      {draftQuery.isError && <p role="alert" className="mb-6 rounded-[12px] border border-[var(--color-danger)] px-4 py-3 text-[12px] text-[var(--color-danger)]">This draft could not be loaded. Return to your profile and choose it again.</p>}
      {autosaveStatus === 'conflict' && <p role="alert" className="mb-6 rounded-[12px] border border-[var(--color-danger)] px-4 py-3 text-[12px] text-[var(--color-danger)]">{editPostId ? 'This story changed since your saved edit. Your writing is still here, but Update will require the latest revision.' : 'This draft changed in another tab. Reload before making more edits so you do not overwrite newer work.'}</p>}

      <section aria-label="Writing area" onPointerDown={focusNearestWritingField} onKeyDownCapture={handleHistoryKey} onBeforeInputCapture={event => {
        const inputType = event.nativeEvent.inputType
        if (inputType !== 'historyUndo' && inputType !== 'historyRedo') return
        event.preventDefault()
        if (inputType === 'historyUndo') undo()
        else redo()
      }} className="min-w-0 cursor-text pl-6 pr-6 lg:px-0">
        {/* ── Title input ── */}
        <div>
          <label htmlFor="editor-title" className="mb-3 block text-[12px] font-medium text-[var(--color-text-secondary)]">{format === 'short' ? 'Short title' : 'Story title'}</label>
          <textarea
            ref={titleRef}
            id="editor-title"
            value={title}
            onChange={(e) => setTitle(e.target.value, { kind: 'typing', field: 'title', beforeFocus: { id: 'title', start: e.target.selectionStart, end: e.target.selectionEnd } })}
            placeholder={format === 'short' ? 'A focused idea…' : 'Title…'}
            maxLength={format === 'short' ? 120 : 180}
            className="editor-writing-field w-full bg-transparent border-none outline-none resize-none font-bold text-[clamp(24px,4vw,36px)] leading-[1.3] tracking-[-0.5px] mb-8 text-(--color-text) placeholder:text-(--color-text-muted)"
            style={{ fontFamily: "var(--font-display)", minHeight: "1.3em" }}
            rows={1}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
          />
        </div>

        {/* ── Block editor ── */}
        <div className="mb-3">
          <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">Story</p>
        </div>
        <div className="flex min-h-[240px] flex-col gap-2 mb-4 relative" ref={editorRef}>
          {blocks.map(bl => (
            <Block
              key={bl.id}
              block={bl}
                format={format}
              ref={(el) => blockRefs.current[bl.id] = el}
              onChange={(v, kind) => updateBlock(bl.id, v, kind)}
              onAltChange={(value) => updateBlockField(bl.id, 'alt', value)}
              onAltRef={element => { altRefs.current[bl.id] = element }}
              onDelete={() => deleteBlock(bl.id)}
              onSplit={(before, after) => addAfter(bl.id, after, 'text', before)}
              onInsert={event => openBlockInsert(bl.id, event)}
              onActivate={() => setActiveBlockId(bl.id)}
              active={activeBlockId === bl.id || (!activeBlockId && bl.id === blocks[0]?.id)}
              openSlashMenu={openSlashMenu}
              closeSlashMenu={closeSlashMenu}
              isSlashMenuOpen={slashMenu.open && slashMenu.blockId === bl.id}
              moveFocus={moveFocus}
              mergeToPrevBlock={mergeToPrevBlock}
              copyPasteContent={copyPasteContent}
            />
          ))}

          {slashMenu.open && (
            <SlashMenu anchorRef={slashAnchorRef}
              options={BLOCK_TYPES.filter(b => b.type !== 'divider' || blocks.length > 1)}
              position={slashMenu.position}
              filter={slashMenu.filter}
              onSelect={handleSlashSelect}
              onClose={closeSlashMenu}
            />
          )}

        </div>

        {mobileMenu && <MobileBlockMenu title={mobileMenu.mode === 'insert' ? 'Insert block' : 'Block type'} options={BLOCK_TYPES} onSelect={selectMobileBlock} onClose={() => setMobileMenu(null)} />}
        {phoneCommandsVisible && activeBlockId && !mobileMenu && <MobileEditorCommands
          options={BLOCK_TYPES.filter(option => option.type !== 'divider' || blocks.length > 1)}
          activeType={blocks.find(block => block.id === activeBlockId)?.type} onSelect={selectPhoneCommand} />}

        <div data-editor-footer className="flex items-center justify-between gap-2 pb-6 text-[12px] text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-2 sm:hidden">
            <button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo writing change" title="Undo (Ctrl+Z)" className="min-h-11 rounded-lg px-3 text-[13px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-alt)] disabled:cursor-not-allowed disabled:opacity-50">Undo</button>
            <button type="button" onClick={redo} disabled={!canRedo} aria-label="Redo writing change" title="Redo (Ctrl+Y)" className="min-h-11 rounded-lg px-3 text-[13px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-alt)] disabled:cursor-not-allowed disabled:opacity-50">Redo</button>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <p data-editor-shortcuts className="hidden whitespace-nowrap text-[11px] italic leading-5 tracking-[0.02em] text-[var(--color-text-muted)] sm:block">(ctrl+z to undo, ctrl+y to redo)</p>
            <p className={`shrink-0 ${format === 'short' && wordCount > 500 ? 'text-[var(--color-danger)]' : ''}`}>{format === 'short' ? `${wordCount}/500 words` : `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`}</p>
          </div>
        </div>

      </section>

      {instructionsOpen && <ModalLayer onDismiss={() => setInstructionsOpen(false)} returnFocusRef={instructionsTriggerRef} aria-labelledby="writing-instructions-title" className="grid place-items-center p-4">
        <section ref={instructionsDialogRef} tabIndex={-1} className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-menu)]">
          <ModalHeader title="Writing instructions" titleId="writing-instructions-title" onClose={() => setInstructionsOpen(false)} closeLabel="Close writing instructions" closeRef={instructionsCloseRef} />
          <ul className="list-disc space-y-2 overflow-y-auto p-4 pl-9 text-[13px] leading-6 text-[var(--color-text-secondary)] sm:p-6 sm:pl-11">
            <li>Add a title and write your story.</li>
            <li>Type / in a block to add a heading, quote, code, or image.</li>
            <li>On phones and tablets, use + on the left to insert a block and × on the right to remove one.</li>
            <li>Use Ctrl+Z to undo and Ctrl+Y to redo (Cmd+Z and Cmd+Shift+Z on Mac).</li>
            <li>Signed-in drafts save automatically.</li>
            <li>Select Publish to add tags, a story cover, and release options.</li>
          </ul>
        </section>
      </ModalLayer>}

      {publishOpen && <ModalLayer onDismiss={closePublish} dismissOnBackdrop={false} returnFocusRef={publishTriggerRef} aria-labelledby="publish-dialog-title" className="grid place-items-center p-4">
        <section ref={publishDialogRef} tabIndex={-1} className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-menu)]">
          <ModalHeader title={editPostId ? 'Update story' : 'Publish story'} titleId="publish-dialog-title" onClose={closePublish} closeLabel="Close publishing options" closeRef={publishCloseRef} />
          <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto p-4 sm:p-6">
        <div>
          <div className="grid items-start gap-6">
            {/* ── Cover image ── */}
            {format === 'article' && <div>
              <h2 className="mb-3 text-[13px] font-semibold text-[var(--color-text)]">Cover image <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span></h2>
              {cover ? (
                <div className="relative">
                  <img src={cover} alt="cover" className="w-full h-40 object-cover rounded-[14px] block"/>
                  <button
                    type="button"
                    aria-label="Remove cover image"
                    onClick={() => { setCover(null); setCoverURL(''); if (fileRef.current) fileRef.current.value = '' }}
                    className="absolute top-2 right-2 w-11 h-11 rounded-full bg-black/60 text-white border-none cursor-pointer flex items-center justify-center text-[18px]">
                    ×
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full min-h-40 px-3 py-3 rounded-[14px] border-2 border-dashed border-(--color-border) flex items-center justify-center text-(--color-text-muted) text-[13px] font-medium cursor-pointer bg-transparent hover:bg-(--color-bg-alt) transition-colors">
                  + Add cover image
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverImage}
              />
            </div>}

            <TagPicker tags={tags} onChange={setTags} required={false} />
          </div>
          {(format === 'short' || canScheduleEarlyAccess) && <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <h3 className="mb-3 text-[12px] font-medium text-[var(--color-text-secondary)]">Publishing options</h3>
            <div className="pt-3">
            {format === 'short' && <div className="mb-7"><Select id="depth-parent" label="Link a full story (optional)" value={depthParentId} options={[{ value: '', label: 'None' }, ...(depthOptions.data || []).map(post => ({ value: post.id, label: post.title }))]} onChange={setDepthParentId} className="max-w-none" describedBy="depth-parent-help" /><p id="depth-parent-help" className="mt-2 text-[11px] text-[var(--color-text-muted)]">Choose a longer story on the same topic so readers can move between the short and full version. Select None to remove a link.</p></div>}
            {canScheduleEarlyAccess && <div className="mb-7"><label htmlFor="public-at" className="block mb-2 text-[12px] font-semibold text-[var(--color-text)]">Public release <span className="font-normal text-[var(--color-text-muted)]">(optional)</span></label><input id="public-at" type="datetime-local" value={publicAt} min={scheduleBounds.min} max={scheduleBounds.max} onChange={event => setPublicAt(event.target.value)} className="w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3 text-[13px] text-[var(--color-text)]" /><p className="mt-2 text-[11px] text-[var(--color-text-muted)]">Members can read immediately; everyone else gets access at this time.</p></div>}
            </div>
          </div>}
        </div>
        {isError && <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">{error?.response?.data?.message || 'The story could not be published.'}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="submit" disabled={Boolean(publishRequirements.length) || isPending || Boolean(editPostId && !postRevision)} data-disabled-reason={isPending ? 'Publication is in progress.' : editPostId && !postRevision ? 'The story is still loading.' : publishRequirements.length ? `To publish, ${publishRequirements.join(', ')}.` : undefined} aria-busy={isPending}>{editPostId ? 'Update' : 'Publish'}</Button>
        </div>
          </form>
        </section>
      </ModalLayer>}

    </PageFrame>
  );
}

// Single editable block
const Block = forwardRef(
  function Block(
    { block, format, onChange, onAltChange, onAltRef, onDelete, onSplit, onInsert, onActivate, active, openSlashMenu, closeSlashMenu, isSlashMenuOpen, moveFocus, mergeToPrevBlock, copyPasteContent },
    ref
  ) {
    const fieldRef = useRef(null)
    const [selectionToolbar, setSelectionToolbar] = useState(null)
    const selectionRef = useRef(null)
    const canFormat = !['code', 'image', 'divider'].includes(block.type)
    const updateSelectionToolbar = () => {
      const field = fieldRef.current
      if (!canFormat || !field || field.selectionStart === field.selectionEnd) {
        setSelectionToolbar(null)
        return
      }
      const { selectionStart: start, selectionEnd: end } = field
      selectionRef.current = { start, end }
      const rect = field.getBoundingClientRect()
      const style = getComputedStyle(field)
      const mirror = document.createElement('div')
      mirror.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;box-sizing:border-box;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;font:${style.font};letter-spacing:${style.letterSpacing};padding:${style.padding};border:${style.border};`
      const selected = document.createElement('span')
      selected.textContent = field.value.slice(start, end) || '\u200b'
      mirror.append(document.createTextNode(field.value.slice(0, start)), selected)
      document.body.appendChild(mirror)
      const rangeRect = selected.getBoundingClientRect()
      mirror.remove()
      setSelectionToolbar({
        left: Math.max(80, Math.min(window.innerWidth - 80, rangeRect.left + rangeRect.width / 2)),
        top: Math.max(8, rangeRect.top - 52),
      })
    }
    const applyInlineFormat = marker => {
      const field = fieldRef.current
      const range = selectionRef.current
      if (!field || !range || range.start === range.end) return
      const value = block.content
      const selected = value.slice(range.start, range.end)
      const wrapped = `${marker}${selected}${marker}`
      onChange(value.slice(0, range.start) + wrapped + value.slice(range.end), 'action')
      setSelectionToolbar(null)
      requestAnimationFrame(() => {
        field.focus()
        const caret = range.start + wrapped.length
        field.setSelectionRange(caret, caret)
      })
    }
    useEffect(() => {
      const dismissOutside = event => {
        if (event.target === fieldRef.current || event.target.closest?.('[data-selection-toolbar]')) return
        setSelectionToolbar(null)
        selectionRef.current = null
      }
      const dismissCollapsed = () => {
        const field = fieldRef.current
        if (document.activeElement === field && field.selectionStart === field.selectionEnd) setSelectionToolbar(null)
      }
      document.addEventListener('pointerdown', dismissOutside, true)
      document.addEventListener('selectionchange', dismissCollapsed)
      return () => {
        document.removeEventListener('pointerdown', dismissOutside, true)
        document.removeEventListener('selectionchange', dismissCollapsed)
      }
    }, [])
    const attachField = element => {
      fieldRef.current = element
      if (typeof ref === 'function') ref(element)
      else if (ref) ref.current = element
    }

    useLayoutEffect(() => {
      const field = fieldRef.current
      if (!(field instanceof HTMLTextAreaElement)) return undefined
      const resize = () => { field.style.height = 'auto'; field.style.height = `${field.scrollHeight}px` }
      resize()
      window.addEventListener('resize', resize)
      document.fonts?.ready.then(resize)
      return () => window.removeEventListener('resize', resize)
    }, [block.content, block.type])

    const cls = {
      text:  'text-[15px] bg-transparent border-none leading-[1.8] text-[var(--color-text)]',
      h1:    'text-[32px] bg-transparent border-none font-bold leading-[1.3] text-[var(--color-text)]',
      h2:    'text-[24px] bg-transparent border-none font-bold leading-[1.35] text-[var(--color-text)]',
      h3:    'text-[18px] bg-transparent border-none font-semibold leading-[1.4] text-[var(--color-text)]',
      quote: 'text-[17px] bg-transparent italic leading-[1.7] border-l-4 text-[var(--color-text-secondary)] border-[var(--color-text-secondary)] pl-4',
      code:  'font-mono bg-[var(--color-bg-alt)] text-[var(--color-text)] border-none text-[13px] leading-[1.7] p-4 rounded-lg',
      image: 'text-[13px] bg-transparent border-none text-[var(--color-text-secondary)]',
    }

    // Handle key events for slash menu and navigation
    const handleKey = (e) => {

      const textarea = e.target;
      if (canFormat && (e.ctrlKey || e.metaKey) && ['b', 'i'].includes(e.key.toLowerCase())) {
        e.preventDefault()
        selectionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd }
        applyInlineFormat(e.key.toLowerCase() === 'b' ? '**' : '*')
        return
      }
      const cursorPos = textarea.selectionStart;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (textarea.selectionStart !== textarea.selectionEnd) return
        const styles = getComputedStyle(textarea)
        const mirror = document.createElement('div')
        const startMarker = document.createElement('span')
        const caretMarker = document.createElement('span')
        const endMarker = document.createElement('span')
        mirror.style.cssText = [
          'position:fixed', 'left:-100000px', 'top:0', 'visibility:hidden',
          `width:${textarea.clientWidth}px`, 'white-space:pre-wrap',
          'overflow-wrap:break-word', `font:${styles.font}`,
          `line-height:${styles.lineHeight}`, `letter-spacing:${styles.letterSpacing}`,
          `padding:${styles.padding}`, `border:${styles.border}`,
          `box-sizing:${styles.boxSizing}`,
        ].join(';')
        startMarker.textContent = '\u200b'
        caretMarker.textContent = '\u200b'
        endMarker.textContent = '\u200b'
        mirror.append(startMarker, document.createTextNode(textarea.value.slice(0, cursorPos)), caretMarker, document.createTextNode(textarea.value.slice(cursorPos)), endMarker)
        document.body.appendChild(mirror)
        const startTop = startMarker.getBoundingClientRect().top
        const caretTop = caretMarker.getBoundingClientRect().top
        const endTop = endMarker.getBoundingClientRect().top
        mirror.remove()
        const lineHeight = Number.parseFloat(styles.lineHeight) || 24
        const atBoundary = e.key === 'ArrowUp'
          ? caretTop <= startTop + lineHeight * 0.5
          : caretTop >= endTop - lineHeight * 0.5
        if (atBoundary) {
          e.preventDefault()
          moveFocus(block.id, e.key === 'ArrowUp' ? -1 : 1)
        }
        return;
      }
      // Pasting content into editor into separate blocks
      if (e.key === 'v' && e.ctrlKey) {
        e.preventDefault();
        copyPasteContent(block.id);
      }
      // Add new block on Enter (split block if content after cursor)
      if (e.key === 'Enter' && !e.shiftKey && !isSlashMenuOpen) {
        e.preventDefault();
        const value = textarea.value;
        const before = value.slice(0, cursorPos);
        const after = value.slice(cursorPos);
        onSplit(before, after);
        return
      }
      // Merge with previous block on Backspace at start
      if (e.key === 'Backspace' && e.target.selectionStart === 0 && e.target.selectionEnd === 0 && block.content.length > 0) {
        e.preventDefault();
        mergeToPrevBlock(block.id, block.content);
      }
      // Delete block on backspace if empty
      if (e.key === 'Backspace' && !block.content) {
        e.preventDefault();
        onDelete();
      }
      // Open Slash menu
      if (e.key === '/' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        openSlashMenu(block.id, '');
      }
      // If menu is open, update filter
      if (e.key.length === 1 && block.content.endsWith('/')) {
        openSlashMenu(block.id, '');
      }
    }

    // Handle input for filtering
    const handleChange = (val, cursorPosition) => {
      onChange(val)
      const match = val.slice(0, cursorPosition).match(/\/(\w*)$/)
      if (match) {
        openSlashMenu(block.id, match[1], { start: cursorPosition - match[0].length, end: cursorPosition })
      } else {
        closeSlashMenu()
      }
    }

    return (
      <div data-editor-block data-active={active || undefined} onFocusCapture={onActivate} className="editor-block-row relative group flex min-h-11 items-start gap-2">
        {/* Content */}
        {
          block.type === "divider"
        ? 
          <button ref={attachField} type="button" aria-label="Divider block" onClick={onActivate} className="editor-divider-button flex min-h-11 w-full items-center"><span className="h-px bg-(--color-border) w-full" /></button>
        :
          <div className="flex-1 min-w-0">
            {block.type === 'image' && block.content && (
              <img src={block.content} alt="block" className="w-full rounded-[10px] mb-2 object-cover max-h-100 block" />
            )}
            <textarea
              ref={attachField}
              aria-label={`${block.type === 'text' ? 'Paragraph' : block.type} block`}
              aria-controls={isSlashMenuOpen ? 'editor-slash-menu' : undefined}
              value={block.content}
              onChange={e => handleChange(e.target.value, e.target.selectionStart)}
              onKeyDown={handleKey}
              onKeyUp={updateSelectionToolbar}
              onSelect={updateSelectionToolbar}
              onPointerUp={updateSelectionToolbar}
              onBlur={event => { if (!event.relatedTarget?.closest('[data-selection-toolbar]')) setSelectionToolbar(null) }}
              placeholder={{
                text: 'Press / for formatting options', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3',
                quote: 'A thought worth quoting…', code: '// code here', image: 'Paste image URL…',
              }[block.type]}
              rows={1}
              className={`editor-writing-field w-full outline-none resize-none overflow-hidden ${block.type === 'code' ? 'editor-code-field' : 'pr-3'} placeholder:text-(--color-text-muted) ${block.type === 'text' ? 'editor-slash-hint' : ''} ${cls[block.type] || cls.text}`}
              style={{ minHeight: '1.6em', fontFamily: format !== 'short' && ['text', 'quote'].includes(block.type) ? 'var(--font-reading)' : undefined }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            />
            {selectionToolbar && <div data-selection-toolbar role="toolbar" aria-label="Format selected text" style={{ left: selectionToolbar.left, top: selectionToolbar.top }} className="fixed z-[200] flex -translate-x-1/2 gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-menu)]">
              <button type="button" aria-label="Bold selected text" title="Bold (Ctrl+B)" onMouseDown={event => event.preventDefault()} onClick={() => applyInlineFormat('**')} className="flex h-10 min-w-10 items-center justify-center rounded font-bold text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]">B</button>
              <button type="button" aria-label="Italicize selected text" title="Italic (Ctrl+I)" onMouseDown={event => event.preventDefault()} onClick={() => applyInlineFormat('*')} className="flex h-10 min-w-10 items-center justify-center rounded italic text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]">I</button>
            </div>}
            {block.type === 'image' && <input ref={onAltRef} value={block.alt || ''} maxLength={300} onChange={event => onAltChange(event.target.value)} placeholder="Describe this image for screen readers" aria-label="Image description" className="mt-2 w-full rounded-[8px] border border-(--color-border) bg-(--color-bg-alt) px-3 py-2 text-[12px] text-(--color-text)" />}
          </div>
        }
        
        <div data-editor-block-controls className={`pointer-events-none absolute -left-8 -right-8 -top-2 z-10 h-11 ${active ? 'opacity-100' : 'opacity-0'}`}>
          <button
            type="button"
            aria-label="Add block after this block"
            onClick={onInsert}
            aria-haspopup="listbox"
            className={`absolute left-0 top-0 w-11 h-11 flex items-center justify-center rounded text-(--color-text-muted) hover:text-(--color-text) bg-transparent border-none cursor-pointer text-[18px] ${active ? 'pointer-events-auto' : 'pointer-events-none'}`}
            title="Add block after"
            tabIndex={active ? 0 : -1}
          >
            +
          </button>

          {/* Delete button */}
          <button type="button" aria-label={`Delete ${block.type} block`} onClick={onDelete} tabIndex={active ? 0 : -1}
            className={`absolute right-0 top-0 w-11 h-11 flex items-center justify-center rounded text-(--color-text-muted) hover:text-(--color-danger) bg-transparent border-none cursor-pointer text-[16px] ${active ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            ×
          </button>
        </div>
      </div>
    )
  }
);

