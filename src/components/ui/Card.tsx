'use client'

import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

const cardVariants = {
  default:  'bg-background border border-neutral-200',
  elevated: 'bg-background shadow-premium border border-neutral-100',
  filled:   'bg-neutral-100 border border-transparent',
  dark:     'bg-foreground text-background border border-neutral-700',
  gold:     'bg-background border border-gold-subtle shadow-gold',
} as const

type CardVariant = keyof typeof cardVariants

interface CardProps extends HTMLMotionProps<'div'> {
  variant?:   CardVariant
  hoverable?: boolean
  padding?:   'none' | 'sm' | 'md' | 'lg'
}

const paddingMap = {
  none: 'p-0',
  sm:   'p-4',
  md:   'p-6',
  lg:   'p-8 md:p-10',
} as const

const Card = forwardRef<HTMLDivElement, CardProps>(({
  variant   = 'default',
  hoverable = false,
  padding   = 'md',
  className,
  children,
  ...props
}, ref) => {
  return (
    <motion.div
      ref={ref}
      whileHover={hoverable ? { y: -4, shadow: 'var(--shadow-premium-lg)' } : {}}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'rounded-sm',
        'transition-shadow duration-350',
        cardVariants[variant],
        paddingMap[padding],
        hoverable && 'cursor-pointer hover:shadow-premium-lg',
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
})

Card.displayName = 'Card'

/* ─── Sub-components ──────────────────────────────────────────────────────── */

interface CardHeaderProps {
  title:        string
  subtitle?:    string
  action?:      React.ReactNode
  withDivider?: boolean
  className?:   string
}

function CardHeader({ title, subtitle, action, withDivider = false, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div>
        <h3 className="font-serif text-xl font-light text-foreground">{title}</h3>
        {subtitle && (
          <p className="mt-1 font-sans text-sm text-neutral-500">{subtitle}</p>
        )}
        {withDivider && <div className="divider mt-3" />}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

function CardMedia({
  src,
  alt,
  aspect = 'landscape',
  className,
}: {
  src:       string
  alt:       string
  aspect?:   'square' | 'portrait' | 'landscape' | 'wide'
  className?: string
}) {
  const aspectMap = {
    square:    'aspect-square',
    portrait:  'aspect-[3/4]',
    landscape: 'aspect-[4/3]',
    wide:      'aspect-[16/9]',
  }

  return (
    <div className={cn('overflow-hidden rounded-sm bg-neutral-100', aspectMap[aspect], className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-500 ease-premium hover:scale-105"
      />
    </div>
  )
}

function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mt-4 pt-4 border-t border-neutral-200 flex items-center gap-3', className)}>
      {children}
    </div>
  )
}

export { Card, CardHeader, CardMedia, CardFooter }
export type { CardProps, CardVariant }
