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
  personCount: number
}

export default function RecipeSheet({ open, onOpenChange, recipe, mode, householdId, personCount }: Props) {
  const supabase = createClient()
  const [cooking, setCooking] = useState(false)
  const [cooked, setCooked] = useState(false)

  if (!recipe) return null

  const missing = recipe.ingredients.filter((i) => !i.available)
  const available = recipe.ingredients.filter((i) => i.available)

  async function decrementStock(r: Recipe, actualPersons: number) {
    const ratio = actualPersons / Math.max(1, r.persons)
    const toDecrement = r.ingredients.filter((i) => i.available)
    if (toDecrement.length === 0) return

    const { data: items } = await supabase
      .from('inventory_items')
      .select('id, canonical_name, quantity')
      .eq('household_id', householdId)

    if (!items?.length) return

    await Promise.allSettled(
      toDecrement.map(async (ing) => {
        const canon = ing.canonical_name.toLowerCase()
        const match = items.find((item) => {
          const ic = item.canonical_name.toLowerCase()
          if (ic === canon) return true
          const iw = canon.split(' ')
          const mw = ic.split(' ')
          if (iw.length === 1 && mw.includes(iw[0])) return true
          if (mw.length === 1 && iw.includes(mw[0])) return true
          return false
        })
        if (!match) return

        const newQty = Math.round((match.quantity - ing.quantity * ratio) * 10) / 10
        if (newQty <= 0) {
          await supabase.from('inventory_items').delete().eq('id', match.id)
        } else {
          await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', match.id)
        }
      })
    )
  }

  async function handleCook() {
    if (!recipe) return
    setCooking(true)
    const { data: { user } } = await supabase.auth.getUser()
    await Promise.all([
      supabase.from('meal_history').insert({
        household_id: householdId,
        name: recipe.name,
        heaviness: HEAVINESS[mode],
        created_by: user?.id ?? null,
      }),
      decrementStock(recipe, Math.max(1, personCount)),
    ])
    setCooking(false)
    setCooked(true)
    setTimeout(() => onOpenChange(false), 1200)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setCooked(false) }} disablePointerDismissal>
      <SheetContent
        side="bottom"
        className="w-full max-w-full rounded-t-2xl max-h-[92vh] overflow-y-auto overflow-x-hidden"
        showCloseButton={false}
      >
        {/* En-tête — SheetHeader a p-4 en base, on surcharge px-0 et on gère l'horizontal dans le wrapper */}
        <SheetHeader className="px-4 pb-0">
          <div className="flex items-start justify-between gap-3 min-w-0 overflow-hidden">
            <SheetTitle className="text-left leading-snug min-w-0 break-words [overflow-wrap:anywhere]">
              {recipe.name}
            </SheetTitle>
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

        {/* Corps — conteneur avec padding horizontal uniforme */}
        <div className="px-4 pb-6 space-y-4 min-w-0 w-full overflow-x-hidden">
          {/* Méta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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

          <Separator />

          {/* Ingrédients */}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Ingrédients
            </p>
            <div className="space-y-1.5 min-w-0">
              {available.map((ing, i) => (
                <div key={i} className="flex items-center gap-2 text-sm min-w-0">
                  <Check className="w-4 h-4 shrink-0 text-green-600" />
                  <span className="font-medium truncate min-w-0 flex-1">{ing.name}</span>
                  <span className="text-muted-foreground shrink-0 tabular-nums text-xs">
                    {ing.quantity} {ing.unit}
                  </span>
                </div>
              ))}
              {missing.map((ing, i) => (
                <div key={i} className="flex items-center gap-2 text-sm min-w-0">
                  <X className="w-4 h-4 shrink-0 text-red-400" />
                  <span className="text-muted-foreground truncate min-w-0 flex-1">{ing.name}</span>
                  <span className="text-muted-foreground shrink-0 tabular-nums text-xs">
                    {ing.quantity} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Étapes */}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Étapes
            </p>
            <ol className="space-y-3 min-w-0">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm min-w-0 overflow-hidden">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <Button
            className="w-full"
            onClick={handleCook}
            disabled={cooking || cooked}
          >
            {cooked ? '✓ Bon appétit !' : cooking ? 'Enregistrement…' : 'Cuisiner ce repas 🍽️'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
