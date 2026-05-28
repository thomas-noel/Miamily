'use client'

import { useRouter } from 'next/navigation'
import { useOnboardingStore } from '@/store/onboarding'
import { onboarding } from '@/lib/copy'
import { TopBar } from '@/components/onboarding/TopBar'
import { ProgressDots } from '@/components/onboarding/ProgressDots'
import { Chip } from '@/components/onboarding/Chip'
import { StickyCTA } from '@/components/onboarding/StickyCTA'

export default function FridgePage() {
  const router = useRouter()
  const { fridgeItems, setFridgeItems } = useOnboardingStore()
  const copy = onboarding.fridge

  function toggle(item: string) {
    if (fridgeItems.includes(item)) {
      setFridgeItems(fridgeItems.filter((i) => i !== item))
    } else {
      setFridgeItems([...fridgeItems, item])
    }
  }

  const count = fridgeItems.length
  const maxReached = count >= copy.maxItems
  const ctaLabel = count === 0 ? copy.ctaEmpty : copy.cta(count)

  function handleNext() {
    router.push('/onboarding/ready')
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background">

      <TopBar
        backHref="/onboarding/allergies"
        skip={
          <button
            onClick={handleNext}
            className="text-sm text-ink-2 hover:text-foreground transition-colors"
          >
            {copy.skipLink}
          </button>
        }
      />
      <ProgressDots current={4} total={5} />

      <div className="flex-1 px-6 pt-4 pb-36 flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-widest text-ink-3">
            {copy.kicker}
          </p>
          <h1 className="font-serif text-[32px] leading-[1.1] tracking-[-0.5px] text-foreground">
            {copy.title}
          </h1>
          <p className="text-sm text-ink-2 leading-relaxed">
            {copy.sub}
          </p>
        </div>

        {/* Hero express block */}
        <div className="rounded-2xl bg-surface border border-border px-5 py-4 flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-primary">
              {copy.heroKicker}
            </p>
            <p className="font-semibold text-foreground text-base">{copy.heroTitle}</p>
            <p className="text-xs text-ink-2">{copy.heroSub}</p>
          </div>
          <ul className="flex flex-col gap-1">
            {copy.promises.map((promise) => (
              <li key={promise} className="text-xs text-ink-2">{promise}</li>
            ))}
          </ul>
        </div>

        {/* Checklist produits */}
        <div className="flex flex-col gap-4">
          <p className="text-xs text-ink-3">
            {copy.counter(count, copy.maxItems)}
          </p>
          <div className="flex flex-wrap gap-2">
            {copy.items.map((item) => {
              const isOn = fridgeItems.includes(item)
              return (
                <Chip
                  key={item}
                  on={isOn}
                  disabled={maxReached && !isOn}
                  onClick={() => toggle(item)}
                >
                  {item}
                </Chip>
              )
            })}
          </div>
        </div>

      </div>

      <StickyCTA
        onPress={handleNext}
        sub={copy.subCta}
      >
        {ctaLabel}
      </StickyCTA>

    </div>
  )
}
