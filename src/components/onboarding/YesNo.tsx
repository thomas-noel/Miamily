'use client'

import { cn } from '@/lib/utils'

interface Props {
  value: boolean | null
  onChange: (value: boolean) => void
}

const ACTIVE = 'bg-primary text-primary-foreground border-transparent shadow-cta'
const IDLE   = 'bg-surface border-border text-foreground hover:bg-surface-muted'

export function YesNo({ value, onChange }: Props) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onChange(true)}
        className={cn('flex-1 h-14 rounded-xl text-base font-medium border transition-colors', value === true ? ACTIVE : IDLE)}
      >
        Oui
      </button>
      <button
        onClick={() => onChange(false)}
        className={cn('flex-1 h-14 rounded-xl text-base font-medium border transition-colors', value === false ? ACTIVE : IDLE)}
      >
        Non
      </button>
    </div>
  )
}
