import Link from 'next/link'
import { BetaChip } from '@/components/ui/beta-chip'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { onboarding } from '@/lib/copy'

export default function WelcomePage() {
  return (
    <div className="flex flex-col min-h-dvh bg-background">

      {/* Hero — remplacer par <Image priority> en Phase 3 */}
      <div className="relative flex-1 bg-surface-muted flex items-center justify-center min-h-[45vh]">
        <BetaChip className="absolute top-12 right-5" />
        <span className="text-[80px] select-none opacity-25" aria-hidden>🍽️</span>
      </div>

      {/* Contenu */}
      <div className="px-6 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] flex flex-col gap-8 bg-background">

        <div className="flex flex-col gap-3">
          <h1 className="font-serif text-[36px] leading-[1.1] tracking-[-0.5px] text-foreground">
            {onboarding.welcome.title}
          </h1>
          <p className="text-base text-ink-2 leading-relaxed">
            {onboarding.welcome.body}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/onboarding/household"
            className={cn(
              buttonVariants({ variant: 'primary' }),
              'w-full h-12 text-base rounded-xl'
            )}
          >
            {onboarding.welcome.cta}
          </Link>
          <p className="text-center text-xs text-ink-3">
            {onboarding.welcome.subCta}
          </p>
        </div>

      </div>
    </div>
  )
}
