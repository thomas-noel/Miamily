'use client'

import { useState } from 'react'
import { X, Check, Clock, Users, Flame } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Recipe, RecipeMode } from '@/app/api/recettes/suggest/route'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const HEAVINESS: Record<RecipeMode, 'light' | 'normal' | 'heavy'> = {
  leger: 'light', normal: 'normal', rapide: 'normal',
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipe: Recipe | null
  mode: RecipeMode
  householdId: string
}

export default function RecipeSheet({ open, onOpenChange, recipe, mode, householdId }: Props) {
  const supabase = createClient()
  const [cooking, setCooking] = useState(false)
  const [cooked, setCooked] = useState(false)

  if (!recipe) return null

  const missing = recipe.ingredients.filter((i) => !i.available)
  const available = recipe.ingredients.filter((i) => i.available)

  async function handleCook() {
    if (!recipe) return
    setCooking(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('meal_history').insert({
      household_id: householdId,
      name: recipe.name,
      heaviness: HEAVINESS[mode],
      created_by: user?.id ?? null,
    })
    setCooking(false)
    setCooked(true)
    setTimeout(() => onOpenChange(false), 1200)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setCooked(false) }} disablePointerDismissal>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto overflow-x-hidden" showCloseButton={false}>
        <SheetHeader className="mb-1">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="text-left leading-snug line-clamp-3 min-w-0">{recipe.name}</SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="shrink-0 rounded-full p-1 hover:bg-muted transition-colors mt-0.5"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </SheetHeader>

        {/* Méta — flex-wrap pour petits écrans */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="w-4 h-4" />{recipe.duration_minutes} min
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Users className="w-4 h-4" />{recipe.persons} pers.
          </span>
          <span className="flex items-center gap-1 shrink-0 font-medium text-green-700">
            <Check className="w-4 h-4" />{recipe.coverage_pct}% dispo
          </span>
          {recipe.anti_gaspillage && (
            <span className="flex items-center gap-1 shrink-0 text-amber-700 font-medium">
              <Flame className="w-4 h-4" />Anti-gaspi
            </span>
          )}
        </div>

        <Separator className="mb-4" />

        {/* Ingrédients */}
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Ingrédients</p>
          <div className="space-y-1.5">
            {available.map((ing, i) => (
              <div key={i} className="flex items-center gap-2 text-sm min-w-0">
                <Check className="w-4 h-4 shrink-0 text-green-600" />
                <span className="font-medium truncate min-w-0 flex-1">{ing.name}</span>
                <span className="text-muted-foreground shrink-0 ml-2 tabular-nums">
                  {ing.quantity} {ing.unit}
                </span>
              </div>
            ))}
            {missing.map((ing, i) => (
              <div key={i} className="flex items-center gap-2 text-sm min-w-0">
                <X className="w-4 h-4 shrink-0 text-red-400" />
                <span className="text-muted-foreground truncate min-w-0 flex-1">{ing.name}</span>
                <span className="text-muted-foreground shrink-0 ml-2 tabular-nums">
                  {ing.quantity} {ing.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Separator className="mb-4" />

        {/* Étapes */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Étapes</p>
          <ol className="space-y-3">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="break-words min-w-0">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <Button
          className="w-full"
          onClick={handleCook}
          disabled={cooking || cooked}
        >
          {cooked ? '✓ Bon appétit !' : cooking ? 'Enregistrement…' : 'On fait ça ce soir 🍽️'}
        </Button>
      </SheetContent>
    </Sheet>
  )
}
