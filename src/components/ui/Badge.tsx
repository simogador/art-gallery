import { cn } from '@/lib/utils/cn'

const badgeVariants = {
  default:   'bg-neutral-100 text-neutral-700 border border-neutral-200',
  gold:      'bg-gold-muted text-gold-dark border border-gold/30',
  dark:      'bg-foreground text-background border border-foreground',
  success:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning:   'bg-amber-50 text-amber-700 border border-amber-200',
  error:     'bg-red-50 text-red-700 border border-red-200',
  outline:   'bg-transparent text-foreground border border-foreground',
} as const

const badgeSizes = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-3 py-1 text-xs',
  lg: 'px-4 py-1.5 text-sm',
} as const

type BadgeVariant = keyof typeof badgeVariants
type BadgeSize    = keyof typeof badgeSizes

interface BadgeProps {
  variant?:   BadgeVariant
  size?:      BadgeSize
  dot?:       boolean
  label:      string
  className?: string
}

function Badge({ variant = 'default', size = 'md', dot = false, label, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        'font-sans font-medium uppercase tracking-widest',
        'rounded-sm whitespace-nowrap',
        badgeVariants[variant],
        badgeSizes[size],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            variant === 'gold'    && 'bg-gold',
            variant === 'success' && 'bg-emerald-500',
            variant === 'warning' && 'bg-amber-500',
            variant === 'error'   && 'bg-red-500',
            variant === 'dark'    && 'bg-background',
            variant === 'default' && 'bg-neutral-400',
            variant === 'outline' && 'bg-foreground',
          )}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  )
}

export { Badge }
export type { BadgeProps, BadgeVariant, BadgeSize }
