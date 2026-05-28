'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboardingStore } from '@/store/onboarding'
import { onboarding } from '@/lib/copy'
import { TopBar } from '@/components/onboarding/TopBar'
import { ProgressDots } from '@/components/onboarding/ProgressDots'
import { Chip } from '@/components/onboarding/Chip'
import { StickyCTA } from '@/components/onboarding/StickyCTA'

export default function AllergiesPage() {
  const router = useRouter()
  const { allergies, setAllergies } = useOnboardingStore()

  const copy = onboarding.allergies
  const NONE = copy.options[0]

  const [showMore, setShowMore] = useState(false)

  // Restaurer showMore après refresh si un extended est déjà sélectionné
  useEffect(() => {
    if (allergies.some((a) => copy.extendedOptions.includes(a))) {
      setShowMore(true)
    }
  }, [allergies, copy.extendedOptions])

  const noneSelected = allergies.includes(NONE)

  function toggleAllergy(allergy: string) {
    if (allergy === NONE) {
      // Toggle "Aucune" : si déjà sélectionné → vide, sinon → exclusif
      setAllergies(noneSelected ? [] : [NONE])
    } else {
      // Toute autre allergie retire "Aucune" automatiquement
      const withoutNone = allergies.filter((a) => a !== NONE)
      if (withoutNone.includes(allergy)) {
        setAllergies(withoutNone.filter((a) => a !== allergy))
      } else {
        setAllergies([...withoutNone, allergy])
      }
    }
  }

  const visibleOptions = showMore
    ? [...copy.options, ...copy.extendedOptions]
    : copy.options

  return (
    <div className="flex flex-col min-h-dvh bg-background">

      <TopBar backHref="/onboarding/tastes" />
      <ProgressDots current={3} total={5} />

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

        {/* Chips allergies */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {visibleOptions.map((option) => {
              const isOn = allergies.includes(option)
              // Désactiver les non-Aucune si "Aucune" est sélectionné
              const isDisabled = noneSelected && option !== NONE
              return (
                <Chip
                  key={option}
                  on={isOn}
                  disabled={isDisabled}
                  onClick={() => toggleAllergy(option)}
                >
                  {option}
                </Chip>
              )
            })}
          </div>

          {!showMore && (
            <button
              onClick={() => setShowMore(true)}
              className="text-sm text-ink-2 underline-offset-4 hover:underline text-left w-fit"
            >
              {copy.otherLink}
            </button>
          )}
        </div>

        {/* Mention confidentialité */}
        <p className="text-xs text-ink-3">
          {copy.privacy}
        </p>

      </div>

      <StickyCTA onPress={() => router.push('/onboarding/fridge')}>
        {copy.cta}
      </StickyCTA>

    </div>
  )
}
