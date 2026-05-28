'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboardingStore } from '@/store/onboarding'
import { onboarding } from '@/lib/copy'
import { TopBar } from '@/components/onboarding/TopBar'
import { ProgressDots } from '@/components/onboarding/ProgressDots'
import { Chip } from '@/components/onboarding/Chip'
import { MoodCard } from '@/components/onboarding/MoodCard'
import { StickyCTA } from '@/components/onboarding/StickyCTA'

const MAX_STYLES = 3

export default function TastesPage() {
  const router = useRouter()
  const {
    cuisineStyles,
    openToDiscovery,
    setCuisineStyles,
    setOpenToDiscovery,
  } = useOnboardingStore()

  const copy = onboarding.tastes
  const [showMore, setShowMore] = useState(false)

  // Si des styles étendus sont déjà sélectionnés (après refresh), on les révèle
  useEffect(() => {
    if (cuisineStyles.some((s) => copy.extendedStyles.includes(s))) {
      setShowMore(true)
    }
  }, [cuisineStyles, copy.extendedStyles])

  const visibleStyles = showMore
    ? [...copy.styles, ...copy.extendedStyles]
    : copy.styles

  const atMax = cuisineStyles.length >= MAX_STYLES

  function toggleStyle(style: string) {
    if (cuisineStyles.includes(style)) {
      setCuisineStyles(cuisineStyles.filter((s) => s !== style))
    } else if (!atMax) {
      setCuisineStyles([...cuisineStyles, style])
    }
  }

  const canContinue = cuisineStyles.length > 0 && openToDiscovery !== null

  return (
    <div className="flex flex-col min-h-dvh bg-background">

      <TopBar backHref="/onboarding/household" />
      <ProgressDots current={2} total={5} />

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

        {/* Styles culinaires */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {visibleStyles.map((style) => (
              <Chip
                key={style}
                on={cuisineStyles.includes(style)}
                disabled={atMax && !cuisineStyles.includes(style)}
                onClick={() => toggleStyle(style)}
              >
                {style}
              </Chip>
            ))}
          </div>

          {!showMore && (
            <button
              onClick={() => setShowMore(true)}
              className="text-sm text-ink-2 underline-offset-4 hover:underline text-left w-fit"
            >
              {copy.moreLink}
            </button>
          )}
        </div>

        {/* Mood — ouvert aux nouveautés */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-widest text-ink-3">
            {copy.discoveryLabel}
          </p>
          <div className="flex flex-col gap-2">
            {copy.moodOptions.map((mood) => (
              <MoodCard
                key={mood.value}
                title={mood.title}
                sub={mood.sub}
                on={openToDiscovery === mood.value}
                onClick={() => setOpenToDiscovery(mood.value)}
              />
            ))}
          </div>
        </div>

      </div>

      <StickyCTA
        onPress={() => router.push('/onboarding/allergies')}
        disabled={!canContinue}
        sub={copy.subCta}
      >
        {copy.cta}
      </StickyCTA>

    </div>
  )
}
