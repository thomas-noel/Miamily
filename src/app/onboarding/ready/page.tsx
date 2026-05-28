'use client'

import { useRouter } from 'next/navigation'
import { useOnboardingStore } from '@/store/onboarding'
import { onboarding } from '@/lib/copy'
import { TopBar } from '@/components/onboarding/TopBar'
import { ProgressDots } from '@/components/onboarding/ProgressDots'
import { StickyCTA } from '@/components/onboarding/StickyCTA'

export default function ReadyPage() {
  const router = useRouter()
  const { householdSize, hasKids, cuisineStyles, allergies, fridgeItems } =
    useOnboardingStore()

  const copy = onboarding.ready

  const householdLine =
    householdSize !== null
      ? copy.summaryHousehold(householdSize, hasKids)
      : copy.summaryNone
  const tastesLine =
    cuisineStyles.length > 0 ? cuisineStyles.join(', ') : copy.summaryNone
  const allergiesLine =
    allergies.length > 0 ? allergies.join(', ') : copy.summaryNone
  const fridgeLine = copy.summaryFridgeCount(fridgeItems.length)

  const summaryRows = [
    { label: copy.summaryLabels.household, value: householdLine },
    { label: copy.summaryLabels.tastes,    value: tastesLine },
    { label: copy.summaryLabels.allergies, value: allergiesLine },
    { label: copy.summaryLabels.fridge,    value: fridgeLine },
  ]

  return (
    <div className="flex flex-col min-h-dvh bg-background">

      <TopBar backHref="/onboarding/fridge" />
      <ProgressDots current={5} total={5} />

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

        {/* Summary */}
        <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
          {summaryRows.map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-widest text-ink-3 shrink-0 pt-0.5">
                {label}
              </p>
              <p className="text-sm text-foreground text-right leading-snug">
                {value}
              </p>
            </div>
          ))}
          <div className="px-4 py-3 flex justify-end">
            <button
              onClick={() => router.push('/onboarding/household')}
              className="text-xs text-ink-2 underline-offset-4 hover:underline"
            >
              {copy.editLink}
            </button>
          </div>
        </div>

        {/* Teaser cards */}
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-ink-3">
            {copy.teaserKicker}
          </p>
          <div className="flex flex-col gap-2">
            {copy.teaserPlaceholders.map((title, i) => (
              <div
                key={i}
                className="rounded-2xl bg-surface border border-border px-4 py-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-surface-muted flex-shrink-0" />
                <p className="text-sm font-medium text-foreground">{title}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      <StickyCTA
        onPress={() => router.push('/onboarding/cooking')}
        sub={copy.subCta}
      >
        {copy.cta}
      </StickyCTA>

    </div>
  )
}
