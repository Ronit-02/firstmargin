import { useEffect, useRef } from 'react'

export default function useFilePickerDismissGuard() {
  const pickerActiveRef = useRef(false)
  const resetTimerRef = useRef(null)

  const releasePicker = () => {
    window.clearTimeout(resetTimerRef.current)
    resetTimerRef.current = window.setTimeout(() => { pickerActiveRef.current = false }, 500)
  }

  useEffect(() => {
    window.addEventListener('focus', releasePicker)
    return () => {
      window.removeEventListener('focus', releasePicker)
      window.clearTimeout(resetTimerRef.current)
    }
  }, [])

  const openPicker = input => {
    if (!input) return
    window.clearTimeout(resetTimerRef.current)
    pickerActiveRef.current = true
    input.click()
  }

  return { pickerActiveRef, openPicker, releasePicker }
}
