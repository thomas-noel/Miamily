'use client'

import { cn } from '@/lib/utils'

interface Props {
  title: string
  sub: string
  on?: boolean
  onClick: () => void
}

export function MoodCard({ title, sub, on, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl border px-5 py-4 text-left transition-colors',
        on
          ? 'bg-primary text-primary-foreground border-transparent'
          : 'bg-surface border-border text-foreground hover:bg-surface-muted',
      )}
    >
      <p className="font-medium text-base leading-snug">{title}</p>
      <p className={cn('text-sm mt-1 leading-relaxed', on ? 'opacity-80' : 'text-ink-2')}>
        {sub}
      </p>
    </button>
  )
}
