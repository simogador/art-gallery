'use client'

import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

const variants = {
  primary:   'bg-foreground text-background hover:bg-neutral-700 border border-foreground',
  secondary: 'bg-transparent text-foreground border border-foreground hover:bg-neutral-100',
  gold:      'bg-gold text-background hover:bg-gold-dark border border-gold',
  ghost:     'bg-transparent text-foreground border border-neutral-200 hover:border-foreground hover:bg-neutral-50',
  outline:   'bg-transparent text-gold border border-gold hover:bg-gold-muted',
} as const

const sizes = {
  sm:   'px-4 py-2 text-xs tracking-widest',
  md:   'px-6 py-3 text-sm tracking-widest',
  lg:   'px-8 py-4 text-sm tracking-widest',
  icon: 'p-3',
} as const

type ButtonVariant = keyof typeof variants
type ButtonSize    = keyof typeof sizes

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?:  ButtonVariant
  size?:     ButtonSize
  loading?:  boolean
  fullWidth?: boolean
  leftIcon?:  React.ReactNode
  rightIcon?: React.ReactNode
  children?:  React.ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  children,
  ...props
}, ref) => {
  const isDisabled = disabled || loading

  return (
    <motion.button
      ref={ref}
      disabled={isDisabled}
      whileHover={isDisabled ? {} : { y: -1 }}
      whileTap={isDisabled ? {} : { scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'relative inline-flex items-center justify-center gap-2',
        'font-sans font-medium uppercase tracking-widest',
        'rounded-sm transition-all duration-300',
        'select-none cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <LoadingSpinner />
          {children}
        </span>
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </motion.button>
  )
})

Button.displayName = 'Button'

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export { Button }
export type { ButtonProps, ButtonVariant, ButtonSize }
