/* eslint-disable react-refresh/only-export-components -- Selection offsets and the field renderer share the same inline parser. */
import { forwardRef, useLayoutEffect, useRef } from 'react'

const MARKERS = /(\*\*\*([^*\n]+)\*\*\*|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*)/g

export function inlineParts(value) {
  const parts = []
  let cursor = 0
  let plainStart = 0
  for (const match of String(value || '').matchAll(MARKERS)) {
    if (match.index > cursor) {
      const text = value.slice(cursor, match.index)
      parts.push({ text, rawStart: cursor, rawEnd: match.index, plainStart, marker: '' })
      plainStart += text.length
    }
    const marker = match[2] ? '***' : match[3] ? '**' : '*'
    const text = match[2] || match[3] || match[4]
    parts.push({ text, rawStart: match.index, rawEnd: match.index + match[0].length, plainStart, marker })
    plainStart += text.length
    cursor = match.index + match[0].length
  }
  if (cursor < value.length) parts.push({ text: value.slice(cursor), rawStart: cursor, rawEnd: value.length, plainStart, marker: '' })
  return parts
}

export const plainText = value => inlineParts(value).map(part => part.text).join('')

export function rawOffset(value, offset, edge = 'start') {
  const parts = inlineParts(value)
  if (!parts.length) return 0
  for (const part of parts) {
    const end = part.plainStart + part.text.length
    if (offset < end || (offset === end && edge === 'end')) {
      return part.rawStart + part.marker.length + Math.max(0, offset - part.plainStart)
    }
  }
  return value.length
}

export function getFieldSelection(field) {
  if (!(field instanceof HTMLElement) || !field.isContentEditable) {
    return { start: field?.selectionStart ?? 0, end: field?.selectionEnd ?? 0 }
  }
  const selection = window.getSelection()
  if (!selection?.rangeCount || !field.contains(selection.anchorNode) || !field.contains(selection.focusNode)) return { start: 0, end: 0 }
  const offsetOf = (node, offset) => {
    const range = document.createRange()
    range.selectNodeContents(field)
    range.setEnd(node, offset)
    return range.toString().length
  }
  const anchor = offsetOf(selection.anchorNode, selection.anchorOffset)
  const focus = offsetOf(selection.focusNode, selection.focusOffset)
  return { start: Math.min(anchor, focus), end: Math.max(anchor, focus) }
}

export function setFieldSelection(field, start, end = start) {
  if (!field?.isContentEditable) {
    field?.setSelectionRange?.(start, end)
    return
  }
  const locate = offset => {
    const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    let left = offset
    while (node) {
      if (left < node.textContent.length) return { node, offset: left }
      left -= node.textContent.length
      node = walker.nextNode()
    }
    return { node: field, offset: field.childNodes.length }
  }
  const first = locate(start)
  const last = locate(end)
  const range = document.createRange()
  range.setStart(first.node, first.offset)
  range.setEnd(last.node, last.offset)
  const selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
}

const serialize = node => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  if (node.nodeName === 'BR') return '\n'
  const content = Array.from(node.childNodes, serialize).join('')
  if (!content && ['STRONG', 'B', 'EM', 'I'].includes(node.nodeName)) return ''
  if (node.nodeName === 'STRONG' || node.nodeName === 'B') return `**${content}**`
  if (node.nodeName === 'EM' || node.nodeName === 'I') return `*${content}*`
  if (node.nodeName === 'DIV' || node.nodeName === 'P') return `${content}\n`
  return content
}

const render = (field, value) => {
  const fragment = document.createDocumentFragment()
  for (const part of inlineParts(value)) {
    if (!part.marker) fragment.append(document.createTextNode(part.text))
    else {
      const mark = document.createElement(part.marker === '*' ? 'em' : 'strong')
      if (part.marker === '***') {
        const emphasis = document.createElement('em')
        emphasis.textContent = part.text
        mark.append(emphasis)
      } else mark.textContent = part.text
      fragment.append(mark)
    }
  }
  field.replaceChildren(fragment)
}

const InlineRichText = forwardRef(function InlineRichText({ value, onChange, onInput, onKeyDown, ...props }, ref) {
  const localRef = useRef(null)
  const lastValue = useRef(null)
  useLayoutEffect(() => {
    const field = localRef.current
    if (!field || lastValue.current === value) return
    const focused = document.activeElement === field
    const selection = focused ? getFieldSelection(field) : null
    render(field, value)
    lastValue.current = value
    if (selection) setFieldSelection(field, Math.min(selection.start, plainText(value).length), Math.min(selection.end, plainText(value).length))
  }, [value])
  return <div {...props} data-empty={plainText(value).trim().length === 0 ? 'true' : undefined} ref={element => {
    localRef.current = element
    if (typeof ref === 'function') ref(element)
    else if (ref) ref.current = element
  }} role="textbox" aria-multiline="true" tabIndex={0} contentEditable suppressContentEditableWarning
    onKeyDown={event => {
      onKeyDown?.(event)
      if (event.defaultPrevented || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
      const selection = getFieldSelection(event.currentTarget)
      if (selection.start !== selection.end || !inlineParts(value).some(part => part.marker && selection.start === part.plainStart + part.text.length)) return
      event.preventDefault()
      const offset = rawOffset(value, selection.start)
      onChange(value.slice(0, offset) + event.key + value.slice(offset), { start: selection.start + 1, end: selection.start + 1 })
      requestAnimationFrame(() => setFieldSelection(localRef.current, selection.start + 1))
    }}
    onBeforeInput={event => {
      const input = event.nativeEvent
      if (input.inputType !== 'insertText' || !input.data) return
      const selection = getFieldSelection(event.currentTarget)
      if (selection.start !== selection.end) return
      const atStyledEnd = inlineParts(value).some(part => part.marker && selection.start === part.plainStart + part.text.length)
      if (!atStyledEnd) return
      event.preventDefault()
      const offset = rawOffset(value, selection.start)
      const next = value.slice(0, offset) + input.data + value.slice(offset)
      onChange(next, { start: selection.start + input.data.length, end: selection.start + input.data.length })
      requestAnimationFrame(() => setFieldSelection(localRef.current, selection.start + input.data.length))
    }}
    onInput={event => {
      const next = Array.from(event.currentTarget.childNodes, serialize).join('')
      lastValue.current = next
      onChange(next, getFieldSelection(event.currentTarget))
      onInput?.(event)
    }} />
})

export default InlineRichText
