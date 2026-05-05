'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronRight, Clock, Users, Flame, Check, RefreshCw, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Recipe, RecipeMode } from '@/app/api/recettes/suggest/route'
import RecipeSheet from '@/components/recipe-sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type FoodMember = { id: string; name: string; is_child: boolean }

const MODES: { key: RecipeMode; label: string; emoji: string }[] = [
  { key: 'normal', label: 'Normal', emoji: '🍽️' },
  { key: 'rapide', label: 'Rapide', emoji: '⚡' },
  { key: 'leger',  label: 'Léger',  emoji: '🥗' },
]

type Step = 'idle' | 'loading' | 'results' | 'error'

export default function RecettesPage() {
  const supabase = createClient()

  const [mode, setMode] = useState<RecipeMode>('normal')
  const [step, setStep] = useState<Step>('idle')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [householdId, setHouseholdId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [resultsMode, setResultsMode] = useState<RecipeMode | null>(null)
  const [members, setMembers] = useState<FoodMember[]>([])
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const fetchingRef = useRef(false)

  useEffect(() => {
    async function loadMembers() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('household_id').eq('id', user.id).single()
      if (!profile?.household_id) return
      setHouseholdId(profile.household_id as string)
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

  const isStale = step === 'results' && resultsMode !== null && mode !== resultsMode

  function toggleMember(id: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
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
        body: JSON.stringify({ mode, selectedMemberIds }),
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
      setStep('results')
    } finally {
      fetchingRef.current = false
    }
  }

  function openRecipe(recipe: Recipe) {
    setSelectedRecipe(recipe)
    setSheetOpen(true)
  }

  return (
    <div className="flex flex-col min-h-full overflow-x-hidden">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-semibold">Recettes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Basées sur votre stock</p>
      </div>

      {/* Sélecteur de mode */}
      <div className="px-4 mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Mode</p>
        <div className="grid grid-cols-3 gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              disabled={step === 'loading'}
              className={`rounded-xl py-2 text-xs font-medium transition-colors flex flex-col items-center gap-0.5 border ${
                mode === m.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              <span className="text-base">{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Qui mange ? */}
      {members.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Qui mange ?</p>
          <div className="flex items-center gap-2 flex-wrap">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => toggleMember(m.id)}
                disabled={step === 'loading'}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  selectedMemberIds.includes(m.id)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                {m.name}{m.is_child ? ' 👶' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bouton principal */}
      <div className="px-4 mb-4">
        {step === 'loading' ? (
          <Button className="w-full" disabled>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyse en cours…
          </Button>
        ) : isStale ? (
          <Button className="w-full" onClick={handleSuggest} disabled={fetchingRef.current}>
            <RefreshCw className="w-4 h-4 mr-2" />Mettre à jour les suggestions
          </Button>
        ) : step === 'results' ? (
          <Button variant="outline" className="w-full" onClick={handleSuggest} disabled={fetchingRef.current}>
            <RefreshCw className="w-4 h-4 mr-2" />Relancer
          </Button>
        ) : (
          <Button className="w-full" onClick={handleSuggest}>
            Suggérer des recettes
          </Button>
        )}
      </div>

      {/* Erreur */}
      {step === 'error' && error && (
        <div className="mx-4 mb-4 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive break-words">
          {error}
        </div>
      )}

      {/* Skeleton loading */}
      {step === 'loading' && (
        <div className="px-4 space-y-3 pb-6">
          <p className="text-xs text-muted-foreground text-center mb-2">Gemini analyse votre stock…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-border p-4 space-y-3 animate-pulse">
              <div className="flex items-start justify-between gap-2">
                <div className="h-4 bg-muted rounded w-3/5" />
                <div className="h-4 bg-muted rounded w-4" />
              </div>
              <div className="flex gap-3">
                <div className="h-3 bg-muted rounded w-14" />
                <div className="h-3 bg-muted rounded w-10" />
                <div className="h-3 bg-muted rounded w-10" />
              </div>
              <div className="flex gap-2">
                <div className="h-5 bg-muted rounded-full w-20" />
                <div className="h-5 bg-muted rounded-full w-28" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Résultats */}
      {step === 'results' && (
        <div className="px-4 space-y-3 pb-6">
          {/* Indicateur de stale */}
          {isStale && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              Mode modifié — mettez à jour les suggestions
            </div>
          )}
          {/* Mode des recettes affichées */}
          {resultsMode && (
            <p className="text-xs text-muted-foreground">
              Recettes en mode <strong className="text-foreground">{MODES.find((m) => m.key === resultsMode)?.label}</strong>
            </p>
          )}
          {recipes.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Aucune recette trouvée avec votre stock actuel.
            </p>
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
        personCount={selectedMemberIds.length > 0 ? selectedMemberIds.length : 2}
      />
    </div>
  )
}

function RecipeCard({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  const missing = recipe.ingredients.filter((i) => !i.available)

  return (
    <button
      onClick={onClick}
      className="w-full max-w-full rounded-2xl bg-card border border-border p-4 text-left hover:border-primary/30 transition-colors overflow-hidden box-border"
    >
      {/* Titre + flèche */}
      <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
        <p className="font-semibold leading-snug line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere]">{recipe.name}</p>
        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground mt-0.5" />
      </div>

      {/* Méta */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1 shrink-0">
          <Clock className="w-3.5 h-3.5" />{recipe.duration_minutes} min
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <Users className="w-3.5 h-3.5" />{recipe.persons} pers.
        </span>
        <span className="flex items-center gap-1 shrink-0 font-medium text-green-700">
          <Check className="w-3.5 h-3.5" />{recipe.coverage_pct}%
        </span>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {recipe.anti_gaspillage && (
          <Badge variant="outline" className="text-xs border-amber-300 bg-amber-50 text-amber-700">
            <Flame className="w-3 h-3 mr-1" />Anti-gaspi
          </Badge>
        )}
        {missing.slice(0, 2).map((ing, i) => (
          <Badge
            key={i}
            variant="outline"
            className="text-xs border-red-200 bg-red-50 text-red-600 max-w-[9rem] overflow-hidden"
          >
            <span className="truncate">Manque : {ing.name}</span>
          </Badge>
        ))}
        {missing.length > 2 && (
          <Badge variant="outline" className="text-xs border-red-200 bg-red-50 text-red-600">
            +{missing.length - 2}
          </Badge>
        )}
        {missing.length === 0 && (
          <Badge variant="outline" className="text-xs border-green-300 bg-green-50 text-green-700">
            Tout disponible ✓
          </Badge>
        )}
      </div>
    </button>
  )
}
