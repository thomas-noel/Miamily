'use client'

import { cn } from '@/lib/utils'

interface Props {
  on?: boolean
  large?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

export function Chip({ on, large, disabled, onClick, children }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled && !on}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors',
        large ? 'px-5 py-2.5 text-base' : 'px-4 py-2 text-sm',
        on
          ? 'bg-primary text-primary-foreground border-transparent'
          : disabled
            ? 'bg-surface border-border text-foreground opacity-35 cursor-not-allowed'
            : 'bg-surface border-border text-foreground hover:bg-surface-muted',
      )}
    >
      {on && <span aria-hidden>✓</span>}
      {children}
    </button>
  )
}
