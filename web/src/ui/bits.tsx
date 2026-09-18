import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../lib/state'

/** A thumbnail whose object URL is fetched from IndexedDB on first render. */
export function BlobImg({
  blobId,
  alt,
  className,
}: {
  blobId: string | null | undefined
  alt: string
  className?: string
}) {
  const url = useApp((s) => (blobId ? s.urls[blobId] : undefined))
  const needUrl = useApp((s) => s.needUrl)
  useEffect(() => {
    if (blobId && !url) needUrl(blobId)
  }, [blobId, url, needUrl])
  if (!url) return <span className={className} aria-label={alt} />
  return <img className={className} src={url} alt={alt} draggable={false} />
}

/** A destructive button that needs a second click, so nothing is lost by accident. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = 'btn danger',
}: {
  label: string
  confirmLabel: string
  onConfirm: () => void
  className?: string
}) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <button
      type="button"
      className={armed ? `${className} confirm` : className}
      onClick={() => {
        if (!armed) {
          setArmed(true)
          timer.current = window.setTimeout(() => setArmed(false), 4000)
          return
        }
        window.clearTimeout(timer.current)
        setArmed(false)
        onConfirm()
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}

/** A modal that traps Escape and clicks on the scrim. */
export function Modal({
  children,
  onClose,
  wide,
  label,
}: {
  children: ReactNode
  onClose: () => void
  wide?: boolean
  label: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={wide ? 'modal wide' : 'modal'} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  )
}

/** Hidden file input driven by a ref, so any button can open the picker. */
export function useFilePicker(
  onPick: (files: File[]) => void,
  accept: string,
  multiple = false,
  capture?: 'environment' | 'user',
) {
  const ref = useRef<HTMLInputElement>(null)
  const input = (
    <input
      ref={ref}
      type="file"
      accept={accept}
      multiple={multiple}
      capture={capture}
      hidden
      onChange={(e) => {
        const files = Array.from(e.target.files ?? [])
        e.target.value = ''
        if (files.length) onPick(files)
      }}
    />
  )
  return { input, open: () => ref.current?.click() }
}
