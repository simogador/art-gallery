'use client'

import { forwardRef, useState, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:       string
  hint?:        string
  error?:       string
  leftIcon?:    React.ReactNode
  rightIcon?:   React.ReactNode
  variant?:     'default' | 'filled' | 'underline'
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  hint,
  error,
  leftIcon,
  rightIcon,
  variant = 'default',
  className,
  id: externalId,
  disabled,
  ...props
}, ref) => {
  const generatedId = useId()
  const id          = externalId ?? generatedId
  const [focused, setFocused] = useState(false)
  const hasError    = !!error

  const baseInput = cn(
    'w-full font-sans text-sm text-foreground bg-transparent',
    'placeholder:text-neutral-400',
    'transition-all duration-300',
    'disabled:opacity-40 disabled:cursor-not-allowed',
    'outline-none',
    leftIcon  && 'pl-10',
    rightIcon && 'pr-10',
  )

  const variantWrapperMap = {
    default:   cn(
      'border rounded-sm',
      hasError  ? 'border-red-400'
      : focused ? 'border-foreground shadow-[0_0_0_1px_#0A0A0A]'
                : 'border-neutral-200 hover:border-neutral-400',
    ),
    filled:    cn(
      'bg-neutral-100 rounded-sm border',
      hasError  ? 'border-red-400 bg-red-50/30'
      : focused ? 'border-foreground bg-neutral-50'
                : 'border-transparent hover:border-neutral-200',
    ),
    underline: cn(
      'border-b rounded-none border-x-0 border-t-0',
      hasError  ? 'border-red-400'
      : focused ? 'border-foreground'
                : 'border-neutral-300 hover:border-neutral-600',
    ),
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={id}
          className={cn(
            'font-sans text-xs font-medium uppercase tracking-widest',
            hasError  ? 'text-red-500'
            : focused ? 'text-foreground'
                      : 'text-neutral-500',
            'transition-colors duration-200',
          )}
        >
          {label}
        </label>
      )}

      <div className={cn('relative flex items-center', variantWrapperMap[variant])}>
        {leftIcon && (
          <span className="absolute left-3 text-neutral-400 flex items-center pointer-events-none">
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={id}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            baseInput,
            variant === 'underline' ? 'px-0 py-2.5' : 'px-4 py-2.5',
          )}
          aria-invalid={hasError}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...props}
        />

        {rightIcon && (
          <span className="absolute right-3 text-neutral-400 flex items-center pointer-events-none">
            {rightIcon}
          </span>
        )}

        {/* Gold accent line on focus (default variant) */}
        {variant === 'default' && (
          <motion.span
            className="absolute bottom-0 left-0 h-px bg-gold"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: focused ? 1 : 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ originX: 0, width: '100%' }}
          />
        )}
      </div>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            key="error"
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="font-sans text-xs text-red-500"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            id={`${id}-hint`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="font-sans text-xs text-neutral-400"
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
})

Input.displayName = 'Input'

export { Input }
export type { InputProps }
