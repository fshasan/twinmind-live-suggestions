import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

type Props = {
  hint: string
  children: ReactNode
  className?: string
}

/**
 * Hover shows a small floating hint above the trigger, portaled to
 * `document.body` so it is not clipped by scrollable parents (e.g. Settings).
 */
export function LabelWithHint({
  hint,
  children,
  className = '',
}: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const [show, setShow] = useState(false)
  const [box, setBox] = useState({ left: 0, bottom: 0, maxW: 288 })

  const reposition = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const maxW = Math.min(288, Math.max(160, window.innerWidth - 16))
    const left = Math.max(8, Math.min(r.left, window.innerWidth - maxW - 8))
    setBox({
      left,
      bottom: window.innerHeight - r.top + 8,
      maxW,
    })
  }, [])

  useLayoutEffect(() => {
    if (!show) return
    reposition()
  }, [show, hint, reposition])

  useEffect(() => {
    if (!show) return
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [show, reposition])

  const triggerClass =
    `inline cursor-help rounded-sm border-b border-dotted border-transparent hover:border-[var(--color-muted)] ${className}`.trim()

  return (
    <>
      <span
        ref={wrapRef}
        className={triggerClass}
        onMouseEnter={() => {
          setShow(true)
          requestAnimationFrame(reposition)
        }}
        onMouseLeave={() => setShow(false)}
      >
        {children}
      </span>
      {show && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[9999] rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-1.5 text-left text-xs leading-snug text-[var(--color-fg)] shadow-lg ring-1 ring-black/5 dark:ring-white/10"
              style={{
                left: box.left,
                bottom: box.bottom,
                maxWidth: box.maxW,
              }}
            >
              {hint}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
