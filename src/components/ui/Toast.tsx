'use client'
import { useState, useEffect, useCallback } from 'react'

type ToastType = 'success' | 'error' | 'warn' | 'info'
interface Toast { id: number; msg: string; type: ToastType }

let _add: ((msg: string, type?: ToastType) => void) | null = null

export function toast(msg: string, type: ToastType = 'success') {
  _add?.(msg, type)
}

const icons: Record<ToastType, string> = {
  success: '✓', error: '✕', warn: '⚠', info: 'ℹ'
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const add = useCallback((msg: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])
  useEffect(() => { _add = add; return () => { _add = null } }, [add])
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{icons[t.type]}</span>
          {t.msg}
        </div>
      ))}
    </div>
  )
}
