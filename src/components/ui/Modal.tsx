'use client'

import { useEffect, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

const sizeMap = {
  sm:   'max-w-sm',
  md:   'max-w-lg',
  lg:   'max-w-2xl',
  xl:   'max-w-4xl',
  full: 'max-w-[95vw] max-h-[95vh]',
} as const

type ModalSize = keyof typeof sizeMap

interface ModalProps {
  open:          boolean
  onClose:       () => void
  title?:        string
  subtitle?:     string
  size?:         ModalSize
  closable?:     boolean
  children:      React.ReactNode
  footer?:       React.ReactNode
  className?:    string
}

const overlayVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.25, delay: 0.05 } },
}

const panelVariants = {
  hidden:  { opacity: 0, scale: 0.96, y: 12 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0, scale: 0.97, y: 8,
    transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

function Modal({
  open,
  onClose,
  title,
  subtitle,
  size      = 'md',
  closable  = true,
  children,
  footer,
  className,
}: ModalProps) {
  const titleId = useId()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && closable) onClose()
  }, [onClose, closable])

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, handleKeyDown])

  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-foreground/60 backdrop-blur-[2px]"
            onClick={closable ? onClose : undefined}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            variants={panelVariants}
            className={cn(
              'relative z-10 w-full',
              'bg-background border border-neutral-200',
              'rounded-sm shadow-premium-lg',
              'flex flex-col max-h-[90vh]',
              sizeMap[size],
              className,
            )}
          >
            {/* Header */}
            {(title || closable) && (
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-neutral-100">
                <div>
                  {title && (
                    <h2 id={titleId} className="font-serif text-2xl font-light text-foreground">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="mt-1 font-sans text-sm text-neutral-500">{subtitle}</p>
                  )}
                </div>
                {closable && (
                  <button
                    onClick={onClose}
                    className={cn(
                      'flex-shrink-0 flex items-center justify-center',
                      'w-8 h-8 rounded-sm',
                      'text-neutral-400 hover:text-foreground',
                      'hover:bg-neutral-100',
                      'transition-all duration-200',
                      'focus-visible:outline focus-visible:outline-gold',
                    )}
                    aria-label="Fermer"
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export { Modal }
export type { ModalProps, ModalSize }
