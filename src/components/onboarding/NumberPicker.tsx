'use client'

import { cn } from '@/lib/utils'

const SIZES = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5+' },
]

interface Props {
  value: number | null
  onChange: (value: number) => void
}

export function NumberPicker({ value, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {SIZES.map((size) => (
        <button
          key={size.value}
          onClick={() => onChange(size.value)}
          className={cn(
            'flex-1 h-14 rounded-xl text-base font-medium border transition-colors',
            value === size.value
              ? 'bg-primary text-primary-foreground border-transparent shadow-cta'
              : 'bg-surface border-border text-foreground hover:bg-surface-muted',
          )}
        >
          {size.label}
        </button>
      ))}
    </div>
  )
}
