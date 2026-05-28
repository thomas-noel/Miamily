'use client'

import { cn } from '@/lib/utils'

type RowState = 'pending' | 'active' | 'done'

interface Props {
  state: RowState
  children: React.ReactNode
}

export function LoadingRow({ state, children }: Props) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 transition-opacity duration-500',
        state === 'pending' ? 'opacity-25' : 'opacity-100',
      )}
    >
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        {state === 'done' && (
          <span className="text-primary text-base leading-none">✓</span>
        )}
        {state === 'active' && (
          <span className="block w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
        )}
        {state === 'pending' && (
          <span className="block w-2.5 h-2.5 rounded-full bg-border" />
        )}
      </div>
      <p className="text-sm text-foreground leading-snug">{children}</p>
    </div>
  )
}
