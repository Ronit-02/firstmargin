import { useCallback, useReducer } from 'react'

const HISTORY_LIMIT = 100
const TYPING_INTERVAL = 750

const initialState = {
  document: { title: '', blocks: [] },
  past: [],
  future: [],
  focus: null,
  restore: null,
  group: null,
  revision: 0,
}

function historyReducer(state, action) {
  if (action.type === 'reset') {
    return { ...initialState, document: action.document, revision: state.revision + 1 }
  }
  if (action.type === 'change') {
    const document = action.change(state.document)
    if (document === state.document) return state
    const grouped = action.kind === 'typing' && state.group?.field === action.field
      && action.time - state.group.time < TYPING_INTERVAL && state.past.length > 0
    return {
      ...state,
      document,
      past: grouped ? state.past : [...state.past, { document: state.document, focus: action.beforeFocus }].slice(-HISTORY_LIMIT),
      future: [],
      focus: action.afterFocus,
      restore: null,
      group: action.kind === 'typing' ? { field: action.field, time: action.time } : null,
    }
  }
  if (action.type === 'undo' && state.past.length) {
    const previous = state.past.at(-1)
    return {
      ...state,
      document: previous.document,
      past: state.past.slice(0, -1),
      future: [...state.future, { document: state.document, focus: state.focus }].slice(-HISTORY_LIMIT),
      focus: previous.focus,
      restore: { ...previous.focus, revision: state.revision + 1 },
      group: null,
      revision: state.revision + 1,
    }
  }
  if (action.type === 'redo' && state.future.length) {
    const next = state.future.at(-1)
    return {
      ...state,
      document: next.document,
      past: [...state.past, { document: state.document, focus: state.focus }].slice(-HISTORY_LIMIT),
      future: state.future.slice(0, -1),
      focus: next.focus,
      restore: { ...next.focus, revision: state.revision + 1 },
      group: null,
      revision: state.revision + 1,
    }
  }
  return state
}

export default function useWritingHistory(initialBlocks) {
  const [state, dispatch] = useReducer(historyReducer, initialBlocks, createBlocks => ({
    ...initialState,
    document: { title: '', blocks: createBlocks() },
  }))
  const reset = useCallback((title, blocks) => dispatch({ type: 'reset', document: { title, blocks } }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const change = (update, options = {}) => dispatch({
    type: 'change', change: update, time: Date.now(),
    kind: options.kind || 'action', field: options.field,
    beforeFocus: options.beforeFocus || null,
    afterFocus: options.afterFocus || options.beforeFocus || null,
  })
  const setTitle = (value, options) => change(document => value === document.title ? document : { ...document, title: value }, options)
  const setBlocks = (updater, options) => change(document => {
    const blocks = typeof updater === 'function' ? updater(document.blocks) : updater
    return blocks === document.blocks ? document : { ...document, blocks }
  }, options)
  return {
    title: state.document.title,
    blocks: state.document.blocks,
    setTitle,
    setBlocks,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    restore: state.restore,
  }
}
