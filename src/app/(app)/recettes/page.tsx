'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Clock, Users, Flame, Check, RefreshCw, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Recipe, RecipeMode, MealMoment, MealType } from '@/app/api/recettes/suggest/route'
import RecipeSheet from '@/components/recipe-sheet'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { BetaChip } from '@/components/ui/beta-chip'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

type FoodMember = { id: string; name: string; is_child: boolean }
type OptionSheet = 'moment' | 'mode' | 'personnes' | null

const MODES: { key: RecipeMode; label: string; description: string }[] = [
  { key: 'normal', label: 'Normal', description: 'Recettes équilibrées du quotidien' },
  { key: 'rapide', label: 'Rapide', description: 'Prêt en moins de 20 minutes'       },
  { key: 'leger',  label: 'Léger',  description: 'Peu caloriques, légères'            },
]

const MOMENTS: { key: MealMoment; label: string }[] = [
  { key: 'petit-dej', label: 'Matin'   },
  { key: 'dejeuner',  label: 'Midi'    },
  { key: 'gouter',    label: 'Goûter'  },
  { key: 'diner',     label: 'Soir'    },
]

const TYPES: { key: MealType; label: string; emoji: string }[] = [
  { key: 'sale',  label: 'Salé',  emoji: '🥗' },
  { key: 'sucre', label: 'Sucré', emoji: '🍰' },
]

function defaultMealMoment(): MealMoment {
  const h = new Date().getHours()
  if (h >= 6 && h < 10) return 'petit-dej'
  if (h >= 11 && h < 14) return 'dejeuner'
  if (h >= 15 && h < 18) return 'gouter'
  return 'diner'
}

type Step = 'idle' | 'loading' | 'results' | 'error'

function relativeTime(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `il y a ${hours}h`
}

export default function RecettesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<RecipeMode>('normal')
  const [mealMoment, setMealMoment] = useState<MealMoment>(() => defaultMealMoment())
  const [mealType, setMealType] = useState<MealType>('sale')
  const [step, setStep] = useState<Step>('idle')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [householdId, setHouseholdId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [resultsMode, setResultsMode] = useState<RecipeMode | null>(null)
  const [resultsMoment, setResultsMoment] = useState<MealMoment | null>(null)
  const [resultsType, setResultsType] = useState<MealType | null>(null)
  const [members, setMembers] = useState<FoodMember[]>([])
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [optionSheet, setOptionSheet] = useState<OptionSheet>(null)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)
  const fetchingRef = useRef(false)

  useEffect(() => {
    async function loadMembers() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('household_id').eq('id', user.id).single()
      if (!profile?.household_id) return
      const hid = profile.household_id as string
      setHouseholdId(hid)
      try {
        const raw = sessionStorage.getItem(`miamily_recipes_${hid}`)
        if (raw) {
          const cached = JSON.parse(raw) as {
            recipes: Recipe[]; mode: RecipeMode; mealMoment: MealMoment
            mealType: MealType; generatedAt: string
          }
          const age = Date.now() - new Date(cached.generatedAt).getTime()
          if (age < 6 * 60 * 60 * 1000) {
            setRecipes(cached.recipes)
            setMode(cached.mode)
            setMealMoment(cached.mealMoment)
            setMealType(cached.mealType)
            setResultsMode(cached.mode)
            setResultsMoment(cached.mealMoment)
            setResultsType(cached.mealType)
            setGeneratedAt(new Date(cached.generatedAt))
            setStep('results')
          } else {
            sessionStorage.removeItem(`miamily_recipes_${hid}`)
          }
        }
      } catch {}
      const { data } = await supabase
        .from('food_members').select('id, name, is_child')
        .eq('household_id', profile.household_id).order('created_at')
      const ms = (data ?? []) as FoodMember[]
      setMembers(ms)
      setSelectedMemberIds(ms.map((m) => m.id))
    }
    loadMembers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isStale = step === 'results' && resultsMode !== null && (
    mode !== resultsMode || mealMoment !== resultsMoment || mealType !== resultsType
  )

  function toggleMember(id: string) {
    setSelectedMemberIds((prev) => {
      if (prev.includes(id) && prev.length === 1) return prev // empêche la dernière désélection
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    })
  }

  async function handleSuggest() {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setStep('loading')
    setError(null)
    console.log(`[recettes][client] mode="${mode}"`)

    try {
      let hid = householdId
      if (!hid) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setStep('error'); setError('Non connecté'); return }
        const { data: profile } = await supabase
          .from('profiles').select('household_id').eq('id', user.id).single()
        hid = profile?.household_id ?? ''
        setHouseholdId(hid)
      }

      const res = await fetch('/api/recettes/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, mealMoment, mealType, selectedMemberIds }),
      })

      let data: { error?: string; recipes?: Recipe[] }
      try {
        data = await res.json()
      } catch {
        setError('Erreur serveur inattendue — vérifiez que GEMINI_API_KEY est définie dans .env.local')
        setStep('error')
        return
      }

      if (!res.ok) {
        setError(
          data.error === 'empty_inventory'
            ? 'Votre stock est vide. Ajoutez des produits pour obtenir des suggestions.'
            : data.error?.startsWith('GEMINI_API_KEY')
              ? data.error
              : `Erreur : ${data.error ?? 'inconnue'}`
        )
        setStep('error')
        return
      }

      setRecipes(data.recipes ?? [])
      setResultsMode(mode)
      setResultsMoment(mealMoment)
      setResultsType(mealType)
      const now = new Date()
      setGeneratedAt(now)
      setStep('results')
      try {
        sessionStorage.setItem(`miamily_recipes_${hid}`, JSON.stringify({
          recipes: data.recipes ?? [],
          mode,
          mealMoment,
          mealType,
          generatedAt: now.toISOString(),
        }))
      } catch {}
    } finally {
      fetchingRef.current = false
    }
  }

  function openRecipe(recipe: Recipe) {
    setSelectedRecipe(recipe)
    setSheetOpen(true)
  }

  const personCount = selectedMemberIds.length > 0
    ? selectedMemberIds.length
    : members.length > 0 ? members.length : 2
  const currentMoment = MOMENTS.find((m) => m.key === mealMoment)!
  const currentMode = MODES.find((m) => m.key === mode)!

  return (
    <div className="flex flex-col min-h-full overflow-x-hidden pb-44">

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-10 pb-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full p-1.5 hover:bg-surface-muted transition-colors -ml-1.5"
          aria-label="Retour"
        >
          <ChevronLeft className="w-5 h-5 text-ink-3" />
        </button>
        <BetaChip />
      </div>

      {/* Titre */}
      <div className="px-5 pt-2 pb-6">
        <h1 className="font-serif text-[32px] leading-[1.1] tracking-[-0.4px] mb-2">
          Suggérer 3 recettes
        </h1>
        <p className="text-sm text-ink-3">
          On regarde votre stock et on vous propose 3 idées.
        </p>
      </div>

      {/* TYPE — grandes cartes */}
      <div className="px-5 mb-6">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[1.4px] text-ink-3 mb-3">Type</p>
        <div className="grid grid-cols-2 gap-3">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMealType(t.key)}
              disabled={step === 'loading'}
              className={cn(
                'rounded-2xl border p-5 flex flex-col items-center gap-3 transition-colors',
                mealType === t.key
                  ? 'bg-primary-soft border-primary'
                  : 'bg-surface border-border hover:border-primary/30'
              )}
            >
              <span className="text-4xl leading-none">{t.emoji}</span>
              <span className={cn(
                'text-sm font-semibold',
                mealType === t.key ? 'text-primary-ink' : 'text-foreground'
              )}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* OPTIONS */}
      <div className="px-5 mb-6">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[1.4px] text-ink-3 mb-3">Options</p>
        <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
          <OptionRow
            label="Moment"
            value={currentMoment.label}
            onClick={step !== 'loading' ? () => setOptionSheet('moment') : undefined}
          />
          <OptionRow
            label="Personnes"
            value={members.length > 0 ? `${personCount}` : '–'}
            onClick={step !== 'loading' && members.length > 0 ? () => setOptionSheet('personnes') : undefined}
          />
          <OptionRow
            label="Mode"
            value={currentMode.label}
            onClick={step !== 'loading' ? () => setOptionSheet('mode') : undefined}
          />
        </div>
      </div>

      {/* Erreur */}
      {step === 'error' && error && (
        <div className="mx-5 mb-5 rounded-xl bg-danger-soft px-4 py-3 text-sm text-destructive break-words">
          {error}
        </div>
      )}

      {/* Skeleton */}
      {step === 'loading' && (
        <div className="px-5 space-y-3">
          <p className="text-xs text-ink-3 text-center mb-2">Gemini analyse votre stock…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-border p-4 space-y-3 animate-pulse">
              <div className="flex items-start justify-between gap-2">
                <div className="h-4 bg-surface-muted rounded w-3/5" />
                <div className="h-4 bg-surface-muted rounded w-4" />
              </div>
              <div className="flex gap-3">
                <div className="h-3 bg-surface-muted rounded w-14" />
                <div className="h-3 bg-surface-muted rounded w-10" />
                <div className="h-3 bg-surface-muted rounded w-10" />
              </div>
              <div className="flex gap-2">
                <div className="h-5 bg-surface-muted rounded-full w-20" />
                <div className="h-5 bg-surface-muted rounded-full w-28" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Résultats */}
      {step === 'results' && (
        <div className="px-5 space-y-3">
          {isStale && (
            <div className="rounded-xl bg-accent-soft px-3 py-2.5 text-xs text-accent-ink flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              Paramètres modifiés — mettez à jour les suggestions
            </div>
          )}
          {resultsMode && (
            <p className="text-xs text-ink-3">
              Recettes en mode{' '}
              <strong className="text-foreground">{MODES.find((m) => m.key === resultsMode)?.label}</strong>
              {generatedAt && <> · {relativeTime(generatedAt)}</>}
            </p>
          )}
          {recipes.length === 0 && (
            <EmptyState
              tone="warning"
              title="Aucune recette trouvée"
              subtitle="Votre stock actuel ne permet pas de générer des suggestions pour ces paramètres."
              inline
              cta={
                <Button variant="secondary" onClick={handleSuggest}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Réessayer
                </Button>
              }
            />
          )}
          {recipes.map((recipe, i) => (
            <RecipeCard key={i} recipe={recipe} onClick={() => openRecipe(recipe)} />
          ))}
        </div>
      )}

      <RecipeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        recipe={selectedRecipe}
        mode={resultsMode ?? mode}
        householdId={householdId}
        personCount={personCount}
        mealType={resultsType ?? mealType}
      />

      {/* ── Sheets d'options ────────────────────────────────────────────── */}
      <Sheet open={optionSheet !== null} onOpenChange={(open) => { if (!open) setOptionSheet(null) }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto pb-safe" showCloseButton={false}>

          {/* Moment */}
          {optionSheet === 'moment' && (
            <>
              <SheetHeader className="pb-2">
                <SheetTitle>Moment du repas</SheetTitle>
              </SheetHeader>
              <div className="divide-y divide-border">
                {MOMENTS.map((m) => {
                  const isActive = mealMoment === m.key
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => { setMealMoment(m.key); setOptionSheet(null) }}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-4 transition-colors text-left',
                        isActive ? 'bg-primary-soft' : 'hover:bg-surface-muted'
                      )}
                    >
                      <span className={cn('text-sm font-medium', isActive ? 'text-primary-ink' : 'text-foreground')}>
                        {m.label}
                      </span>
                      {isActive && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Mode */}
          {optionSheet === 'mode' && (
            <>
              <SheetHeader className="pb-2">
                <SheetTitle>Mode de recette</SheetTitle>
              </SheetHeader>
              <div className="divide-y divide-border">
                {MODES.map((m) => {
                  const isActive = mode === m.key
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => { setMode(m.key); setOptionSheet(null) }}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-4 transition-colors text-left',
                        isActive ? 'bg-primary-soft' : 'hover:bg-surface-muted'
                      )}
                    >
                      <div>
                        <p className={cn('text-sm font-medium', isActive ? 'text-primary-ink' : 'text-foreground')}>
                          {m.label}
                        </p>
                        <p className="text-xs text-ink-3 mt-0.5">{m.description}</p>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-primary shrink-0 ml-3" />}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Personnes */}
          {optionSheet === 'personnes' && (
            <>
              <SheetHeader className="pb-2">
                <SheetTitle>Qui mange ?</SheetTitle>
              </SheetHeader>
              <div className="divide-y divide-border">
                {members.map((m) => {
                  const isSelected = selectedMemberIds.includes(m.id)
                  const isLast = isSelected && selectedMemberIds.length === 1
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMember(m.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-4 transition-colors text-left',
                        isSelected ? 'bg-primary-soft' : 'hover:bg-surface-muted',
                        isLast && 'opacity-60'
                      )}
                    >
                      <div>
                        <span className={cn('text-sm font-medium', isSelected ? 'text-primary-ink' : 'text-foreground')}>
                          {m.name}{m.is_child ? ' 👶' : ''}
                        </span>
                        {isLast && (
                          <p className="text-[11px] text-ink-3 mt-0.5">Au moins 1 personne requise</p>
                        )}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ml-3" />}
                    </button>
                  )
                })}
              </div>
              <div className="px-4 pt-3 pb-2">
                <Button variant="secondary" className="w-full" onClick={() => setOptionSheet(null)}>
                  Confirmer
                </Button>
              </div>
            </>
          )}

        </SheetContent>
      </Sheet>

      {/* CTA sticky — au-dessus de la bottom nav + safe-area iOS */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 bg-background/95 backdrop-blur-sm border-t border-border px-5 py-3">
        {step === 'loading' ? (
          <Button variant="dark" className="w-full" disabled>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyse en cours…
          </Button>
        ) : isStale ? (
          <Button variant="dark" className="w-full" onClick={handleSuggest} disabled={fetchingRef.current}>
            <RefreshCw className="w-4 h-4 mr-2" />Mettre à jour les suggestions
          </Button>
        ) : step === 'results' ? (
          <Button variant="secondary" className="w-full" onClick={handleSuggest} disabled={fetchingRef.current}>
            <RefreshCw className="w-4 h-4 mr-2" />Relancer
          </Button>
        ) : (
          <Button variant="dark" className="w-full" onClick={handleSuggest}>
            Suggérer 3 recettes
          </Button>
        )}
      </div>

    </div>
  )
}

// ── OptionRow ──────────────────────────────────────────────────────────────

function OptionRow({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'w-full flex items-center justify-between px-4 py-3.5 bg-surface text-left transition-colors',
        onClick ? 'hover:bg-surface-muted cursor-pointer' : 'cursor-default'
      )}
    >
      <span className="text-sm text-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground flex items-center gap-1">
        {value}
        {onClick && <ChevronRight className="w-3.5 h-3.5 text-ink-3" />}
      </span>
    </button>
  )
}

// ── RecipeCard ─────────────────────────────────────────────────────────────

function RecipeCard({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  const missing = recipe.ingredients.filter((i) => !i.available)

  return (
    <button
      onClick={onClick}
      className="w-full max-w-full rounded-2xl bg-surface border border-border p-4 text-left hover:border-primary/30 transition-colors overflow-hidden box-border"
    >
      <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
        <p className="font-medium leading-snug line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere]">
          {recipe.name}
        </p>
        <ChevronRight className="w-4 h-4 shrink-0 text-ink-3 mt-0.5" />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3 mb-3">
        <span className="flex items-center gap-1 shrink-0">
          <Clock className="w-3.5 h-3.5" />{recipe.duration_minutes} min
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <Users className="w-3.5 h-3.5" />{recipe.persons} pers.
        </span>
        <span className="flex items-center gap-1 shrink-0 font-medium text-primary">
          <Check className="w-3.5 h-3.5" />{recipe.coverage_pct}%
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {recipe.anti_gaspillage && (
          <Badge variant="warning">
            <Flame className="w-3 h-3 mr-1" />Anti-gaspi
          </Badge>
        )}
        {missing.slice(0, 2).map((ing, i) => (
          <Badge key={i} variant="danger" className="max-w-[9rem] overflow-hidden">
            <span className="truncate">Manque : {ing.name}</span>
          </Badge>
        ))}
        {missing.length > 2 && (
          <Badge variant="danger">+{missing.length - 2}</Badge>
        )}
        {missing.length === 0 && (
          <Badge variant="success">Tout disponible ✓</Badge>
        )}
      </div>
    </button>
  )
}
