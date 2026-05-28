'use client'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  children: React.ReactNode
  sub?: string
  secondary?: React.ReactNode
  disabled?: boolean
  onPress: () => void
}

export function StickyCTA({ children, sub, secondary, disabled, onPress }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-background via-background to-background/0 flex flex-col gap-2">
      <button
        onClick={onPress}
        disabled={disabled}
        className={cn(
          buttonVariants({ variant: 'primary' }),
          'w-full h-12 text-base rounded-xl',
        )}
      >
        {children}
      </button>
      {sub && (
        <p className="text-center text-xs text-ink-3">{sub}</p>
      )}
      {secondary && (
        <div className="flex justify-center">{secondary}</div>
      )}
    </div>
  )
}
