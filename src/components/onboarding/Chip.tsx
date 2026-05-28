'use client'

import { cn } from '@/lib/utils'

interface Props {
  on?: boolean
  large?: boolean
  onClick: () => void
  children: React.ReactNode
}

export function Chip({ on, large, onClick, children }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors',
        large ? 'px-5 py-2.5 text-base' : 'px-4 py-2 text-sm',
        on
          ? 'bg-primary text-primary-foreground border-transparent'
          : 'bg-surface border-border text-foreground hover:bg-surface-muted',
      )}
    >
      {on && <span aria-hidden>✓</span>}
      {children}
    </button>
  )
}
