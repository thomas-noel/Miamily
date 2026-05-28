'use client'

import { useRouter } from 'next/navigation'
import { useOnboardingStore } from '@/store/onboarding'
import { onboarding } from '@/lib/copy'
import { TopBar } from '@/components/onboarding/TopBar'
import { ProgressDots } from '@/components/onboarding/ProgressDots'
import { NumberPicker } from '@/components/onboarding/NumberPicker'
import { YesNo } from '@/components/onboarding/YesNo'
import { Chip } from '@/components/onboarding/Chip'
import { StickyCTA } from '@/components/onboarding/StickyCTA'
import { cn } from '@/lib/utils'

const TRANSITION = 'grid-template-rows 250ms ease-out, opacity 250ms ease-out'

export default function HouseholdPage() {
  const router = useRouter()
  const {
    householdSize,
    hasKids,
    kidsAges,
    setHouseholdSize,
    setHasKids,
    setKidsAges,
  } = useOnboardingStore()

  const copy = onboarding.household

  function handleHasKids(value: boolean) {
    setHasKids(value)
    if (!value) setKidsAges([])
  }

  function toggleAge(age: string) {
    setKidsAges(
      kidsAges.includes(age)
        ? kidsAges.filter((a) => a !== age)
        : [...kidsAges, age],
    )
  }

  const canContinue = householdSize !== null && hasKids !== null

  return (
    <div className="flex flex-col min-h-dvh bg-background">

      <TopBar backHref="/onboarding/welcome" />
      <ProgressDots current={1} total={5} />

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

        {/* Household size */}
        <NumberPicker value={householdSize} onChange={setHouseholdSize} />

        {/* Kids question — progressive disclosure */}
        <div
          className={cn(
            'grid',
            householdSize !== null
              ? 'grid-rows-[1fr] opacity-100'
              : 'grid-rows-[0fr] opacity-0 pointer-events-none',
          )}
          style={{ transition: TRANSITION }}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-3 pb-2">
              <p className="text-xs font-medium uppercase tracking-widest text-ink-3">
                {copy.kidsQ}
              </p>
              <YesNo value={hasKids} onChange={handleHasKids} />
            </div>
          </div>
        </div>

        {/* Ages — progressive disclosure */}
        <div
          className={cn(
            'grid',
            hasKids === true
              ? 'grid-rows-[1fr] opacity-100'
              : 'grid-rows-[0fr] opacity-0 pointer-events-none',
          )}
          style={{ transition: TRANSITION }}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-3 pb-2">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-widest text-ink-3">
                  {copy.agesQ}
                </p>
                <p className="text-xs text-ink-3 leading-relaxed">
                  {copy.agesNote}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {copy.ageOptions.map((age) => (
                  <Chip
                    key={age}
                    on={kidsAges.includes(age)}
                    onClick={() => toggleAge(age)}
                  >
                    {age}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      <StickyCTA
        onPress={() => router.push('/onboarding/tastes')}
        disabled={!canContinue}
      >
        {copy.cta}
      </StickyCTA>

    </div>
  )
}
