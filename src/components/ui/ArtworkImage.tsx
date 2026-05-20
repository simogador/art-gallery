'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

interface ArtworkImageProps {
  imageUrl?:   string | null
  title:       string
  gradient:    string
  accentColor: string
  className?:  string
  sizes?:      string
  priority?:   boolean
  fill?:       boolean
}

export function ArtworkImage({
  imageUrl,
  title,
  gradient,
  accentColor,
  className,
  sizes = '(max-width: 768px) 100vw, 50vw',
  priority = false,
  fill = true,
}: ArtworkImageProps) {
  if (imageUrl) {
    return (
      <>
        <Image
          src={imageUrl}
          alt={title}
          fill={fill}
          sizes={sizes}
          priority={priority}
          className={cn('object-cover', className)}
        />
      </>
    )
  }

  // Gradient + SVG motif fallback
  const h  = title.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const s  = 120
  const r1 = s * 0.35 + (h % (s * 0.1))
  const r2 = r1 * 0.6
  const cx = s / 2
  const cy = s / 2

  return (
    <>
      <div className={cn('absolute inset-0 bg-gradient-to-br', gradient)} />
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" aria-hidden="true">
          <circle cx={cx} cy={cy} r={r1} stroke={accentColor} strokeWidth="1" opacity="0.7" />
          <circle cx={cx} cy={cy} r={r2} stroke={accentColor} strokeWidth="0.6" opacity="0.5" />
          <line x1={cx - r1} y1={cy} x2={cx + r1} y2={cy} stroke={accentColor} strokeWidth="0.5" opacity="0.4" />
          <line x1={cx} y1={cy - r1} x2={cx} y2={cy + r1} stroke={accentColor} strokeWidth="0.5" opacity="0.4" />
          {h % 2 === 0 && (
            <rect x={cx - r2 * 0.7} y={cy - r2 * 0.7} width={r2 * 1.4} height={r2 * 1.4}
              stroke={accentColor} strokeWidth="0.5" opacity="0.3" />
          )}
          <circle cx={cx} cy={cy} r={4} fill={accentColor} opacity="0.5" />
        </svg>
      </div>
    </>
  )
}
