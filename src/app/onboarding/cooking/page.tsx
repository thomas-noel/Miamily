'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboardingStore } from '@/store/onboarding'
import { onboarding } from '@/lib/copy'
import { LoadingRow } from '@/components/onboarding/LoadingRow'

type RowState = 'pending' | 'active' | 'done'
type FlushStatus = 'flushing' | 'done' | 'error'
type SuggestStatus = 'idle' | 'loading' | 'done' | 'error'

const STEP_TIMINGS = [1800, 3600, 5400, 7400]

function defaultMealMoment(): string {
  const h = new Date().getHours()
  if (h >= 6 && h < 10) return 'petit-dej'
  if (h >= 11 && h < 14) return 'dejeuner'
  if (h >= 15 && h < 18) return 'gouter'
  return 'diner'
}

export default function CookingPage() {
  const router = useRouter()
  const {
    cuisineStyles,
    allergies,
    fridgeItems,
    householdSize,
    hasKids,
    kidsAges,
    reset,
  } = useOnboardingStore()

  const copy = onboarding.cooking

  const [activeStep, setActiveStep] = useState(0)
  const [flushStatus, setFlushStatus] = useState<FlushStatus>('flushing')
  const [suggestStatus, setSuggestStatus] = useState<SuggestStatus>('idle')
  const isDone = activeStep >= 4

  const doSuggest = useCallback(async (hid: string) => {
    setSuggestStatus('loading')
    try {
      const mealMoment = defaultMealMoment()
      const res = await fetch('/api/recettes/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'normal', mealMoment, mealType: 'sale' }),
      })
      if (!res.ok) throw new Error('suggest_failed')
      const data = await res.json()
      try {
        sessionStorage.setItem(`miamily_recipes_${hid}`, JSON.stringify({
          recipes: data.recipes ?? [],
          mode: 'normal',
          mealMoment,
          mealType: 'sale',
          generatedAt: new Date().toISOString(),
        }))
      } catch {}
      setSuggestStatus('done')
    } catch {
      setSuggestStatus('error')
    }
  }, [])

  const doFlush = useCallback(async () => {
    setFlushStatus('flushing')
    try {
      const res = await fetch('/api/onboarding/flush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuisineStyles, allergies, fridgeItems }),
      })
      if (!res.ok) throw new Error('flush_failed')
      const { householdId } = await res.json()
      setFlushStatus('done')
      doSuggest(householdId)
    } catch {
      setFlushStatus('error')
    }
  }, [cuisineStyles, allergies, fridgeItems, doSuggest])

  // Trigger flush once on mount
  useEffect(() => {
    doFlush()
  }, [doFlush])

  // Animate rows independently of flush
  useEffect(() => {
    const timers = STEP_TIMINGS.map((delay, i) =>
      setTimeout(() => setActiveStep(i + 1), delay),
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  function handleNavigate() {
    reset()
    router.push('/recettes')
  }

  // Personalized row labels with store values, fallbacks if empty
  const stockLine = copy.checks.stock(fridgeItems.length)

  const tastesList =
    cuisineStyles.length > 0
      ? cuisineStyles.slice(0, 2).join(', ')
      : copy.tastesEmpty
  const tastesLine = copy.checks.tastes(tastesList)

  const totalPeople = householdSize ?? 2
  const kidCount = hasKids === true ? Math.max(1, kidsAges.length) : 0
  const adultCount = Math.max(1, totalPeople - kidCount)
  const familyLine = copy.checks.family(adultCount, kidCount)

  const rows: { key: string; label: string }[] = [
    { key: 'stock',      label: stockLine },
    { key: 'tastes',     label: tastesLine },
    { key: 'family',     label: familyLine },
    { key: 'generating', label: copy.checks.generating },
  ]

  function rowState(i: number): RowState {
    if (activeStep > i) return 'done'
    if (activeStep === i) return 'active'
    return 'pending'
  }

  function renderCTA() {
    if (!isDone) {
      return <p className="text-xs text-ink-3">{copy.footer}</p>
    }
    // Flush failed → retry
    if (flushStatus === 'error') {
      return (
        <button
          onClick={doFlush}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-base font-medium hover:opacity-90 transition-opacity"
        >
          {copy.footerRetry}
        </button>
      )
    }
    // Flush ok + suggest ok → CTA
    if (flushStatus === 'done' && suggestStatus === 'done') {
      return (
        <button
          onClick={handleNavigate}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-base font-medium hover:opacity-90 transition-opacity"
        >
          {copy.ctaDone}
        </button>
      )
    }
    // Flush ok + suggest failed → message + CTA quand même
    if (flushStatus === 'done' && suggestStatus === 'error') {
      return (
        <div className="flex flex-col gap-3 w-full">
          <p className="text-xs text-ink-2 text-center">{copy.suggestError}</p>
          <button
            onClick={handleNavigate}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-base font-medium hover:opacity-90 transition-opacity"
          >
            {copy.ctaDone}
          </button>
        </div>
      )
    }
    // Flush en cours OU flush ok + suggest en cours
    return (
      <p className="text-xs text-ink-3">
        {flushStatus === 'flushing' ? copy.footer : copy.footerSlow}
      </p>
    )
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-10">

        {/* Header */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-widest text-ink-3">
            {copy.kicker}
          </p>
          <h1 className="font-serif text-[32px] leading-[1.1] tracking-[-0.5px] text-foreground">
            {isDone ? copy.titleDone : copy.title}
          </h1>
        </div>

        {/* Progress rows */}
        <div className="flex flex-col gap-5">
          {rows.map(({ key, label }, i) => (
            <LoadingRow key={key} state={rowState(i)}>
              {label}
            </LoadingRow>
          ))}
        </div>

        {/* Footer / CTA */}
        <div className="min-h-12 flex items-center">
          {renderCTA()}
        </div>

      </div>
    </div>
  )
}
