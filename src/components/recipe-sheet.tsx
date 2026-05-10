'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, X, Check, Heart, ShoppingCart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Recipe, RecipeMode, MealMoment, MealType } from '@/app/api/recettes/suggest/route'
import { Badge } from '@/components/ui/badge'
import { BetaChip } from '@/components/ui/beta-chip'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'

const HEAVINESS: Record<RecipeMode, 'light' | 'normal' | 'heavy'> = {
  leger: 'light', normal: 'normal', rapide: 'normal',
}

const MODE_LABEL: Record<RecipeMode, string> = {
  normal: 'normal',
  rapide: 'rapide',
  leger: 'léger',
}

const MEAL_TYPE_LABEL: Record<MealType, string> = {
  sale: 'Salé',
  sucre: 'Sucré',
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipe: Recipe | null
  mode: RecipeMode
  householdId: string
  personCount: number
  mealType?: MealType
  mealMoment?: MealMoment
  savedRecipeId?: string | null
  onSaveChange?: (newId: string | null) => void
}

export default function RecipeSheet({ open, onOpenChange, recipe, mode, householdId, personCount, mealType, mealMoment, savedRecipeId, onSaveChange }: Props) {
  const supabase = createClient()
  const [cooking, setCooking] = useState(false)
  const [cooked, setCooked] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(savedRecipeId ?? null)
  const [saving, setSaving] = useState(false)
  const [addingToCart, setAddingToCart] = useState(false)
  const [cartToast, setCartToast] = useState<string | null>(null)

  useEffect(() => {
    setSavedId(savedRecipeId ?? null)
  }, [savedRecipeId])

  useEffect(() => {
    setCartToast(null)
    setAddingToCart(false)
  }, [recipe?.name])

  if (!recipe) return null

  const missing = recipe.ingredients.filter((i) => !i.available)
  const available = recipe.ingredients.filter((i) => i.available)

  async function handleToggleSave() {
    if (!recipe || saving) return
    setSaving(true)
    try {
      if (savedId) {
        await supabase.from('saved_recipes').delete().eq('id', savedId)
        setSavedId(null)
        onSaveChange?.(null)
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { data } = await supabase
          .from('saved_recipes')
          .insert({
            household_id: householdId,
            created_by: user?.id ?? null,
            name: recipe.name,
            recipe_data: recipe,
            mode,
            meal_moment: mealMoment ?? null,
            meal_type: mealType ?? null,
            status: 'saved',
          })
          .select('id')
          .single()
        if (data) {
          setSavedId(data.id)
          onSaveChange?.(data.id)
        }
      }
    } finally {
      setSaving(false)
    }
  }

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

  async function handleAddMissing() {
    if (!recipe || addingToCart || missing.length === 0) return
    setAddingToCart(true)

    const { data: existing } = await supabase
      .from('shopping_list_items')
      .select('canonical_name, unit')
      .eq('household_id', householdId)
      .eq('is_checked', false)

    const existingSet = new Set(
      (existing ?? []).map(e => `${e.canonical_name ?? ''}|${e.unit ?? ''}`)
    )

    const toInsert = missing.filter(ing =>
      !existingSet.has(`${ing.canonical_name}|${ing.unit}`)
    )
    const skipped = missing.length - toInsert.length

    if (toInsert.length > 0) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('shopping_list_items').insert(
        toInsert.map(ing => ({
          household_id: householdId,
          name: ing.name,
          canonical_name: ing.canonical_name,
          quantity: ing.quantity,
          unit: ing.unit,
          is_checked: false,
          added_by: user?.id ?? null,
          source: 'recipe' as const,
          recipe_name: recipe.name,
        }))
      )
    }

    let msg: string
    if (toInsert.length > 0 && skipped > 0) {
      msg = `${toInsert.length} produit${toInsert.length > 1 ? 's' : ''} ajouté${toInsert.length > 1 ? 's' : ''} · ${skipped} déjà présent${skipped > 1 ? 's' : ''}`
    } else if (toInsert.length > 0) {
      msg = `${toInsert.length} produit${toInsert.length > 1 ? 's' : ''} ajouté${toInsert.length > 1 ? 's' : ''} aux courses`
    } else {
      msg = 'Déjà dans la liste'
    }

    setCartToast(msg)
    setAddingToCart(false)
    setTimeout(() => setCartToast(null), 4000)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setCooked(false); setCartToast(null) } }} disablePointerDismissal>
      <SheetContent
        side="bottom"
        className="w-full max-w-full rounded-t-2xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-0 gap-0 bg-background"
        showCloseButton={false}
      >

        {/* ── Hero — motif diagonal CSS, compatible sans photo ── */}
        <div
          className="relative h-36 bg-surface-muted overflow-hidden rounded-t-2xl shrink-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(0,0,0,0.045) 8px, rgba(0,0,0,0.045) 9px)',
          }}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-3 left-3 rounded-full p-1.5 bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
            aria-label="Fermer"
          >
            <ChevronLeft className="w-5 h-5 text-ink-3" />
          </button>
          <div className="absolute top-3 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSave}
              disabled={saving}
              className="rounded-full p-1.5 bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
              aria-label={savedId ? 'Retirer des favoris' : 'Sauvegarder la recette'}
            >
              <Heart
                className={`w-5 h-5 transition-colors ${savedId ? 'text-destructive fill-destructive' : 'text-ink-3'}`}
              />
            </button>
            <BetaChip />
          </div>
        </div>

        {/* ── Contenu scrollable (pb-32 pour dégager le CTA sticky) ── */}
        <div className="px-5 pt-4 pb-32">

          {/* Badges */}
          {(recipe.anti_gaspillage || mealType) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {recipe.anti_gaspillage && (
                <Badge variant="success">
                  <Check className="w-3 h-3 mr-1" />Anti-gaspi
                </Badge>
              )}
              {mealType && (
                <Badge variant="neutral">{MEAL_TYPE_LABEL[mealType]}</Badge>
              )}
            </div>
          )}

          {/* Titre serif */}
          <h2 className="font-serif text-[28px] leading-[1.1] tracking-[-0.3px] break-words [overflow-wrap:anywhere]">
            {recipe.name}
          </h2>

          {/* Méta */}
          <p className="text-sm text-ink-3 mt-1.5">
            {recipe.duration_minutes} min · {recipe.persons} pers. · {MODE_LABEL[mode]}
          </p>

          {/* Stats row — données réelles seulement */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-lg font-semibold text-foreground leading-none">
                {available.length}
                <span className="text-sm font-normal text-ink-3">/{recipe.ingredients.length}</span>
              </p>
              <p className="text-xs text-ink-3 mt-1">ingrédients dispo</p>
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-lg font-semibold text-foreground leading-none">
                {recipe.coverage_pct}
                <span className="text-sm font-normal text-ink-3">%</span>
              </p>
              <p className="text-xs text-ink-3 mt-1">en stock</p>
            </div>
          </div>

          {/* Ingrédients */}
          <div className="mt-5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[1.4px] text-ink-3 mb-3">
              Ingrédients
            </p>
            <div className="space-y-2.5">
              {available.map((ing, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 shrink-0 text-primary" />
                  <span className="font-medium flex-1 truncate">{ing.name}</span>
                  <span className="text-ink-3 shrink-0 tabular-nums text-xs">
                    {ing.quantity} {ing.unit}
                  </span>
                </div>
              ))}
              {missing.map((ing, i) => (
                <div key={i} className="flex items-center gap-2 text-sm opacity-50">
                  <X className="w-4 h-4 shrink-0 text-destructive" />
                  <span className="flex-1 truncate">{ing.name}</span>
                  <span className="text-ink-3 shrink-0 tabular-nums text-xs">
                    {ing.quantity} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Étapes */}
          {recipe.steps.length > 0 && (
            <div className="mt-5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[1.4px] text-ink-3 mb-3">
                Étapes
              </p>
              <ol className="space-y-4">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary-soft text-primary-ink text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="flex-1 break-words [overflow-wrap:anywhere] leading-relaxed text-foreground">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

        </div>

        {/* ── CTA sticky — collé au bas de la zone de scroll ── */}
        <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border-t border-border px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            variant="dark"
            className="w-full"
            onClick={handleCook}
            disabled={cooking || cooked}
          >
            {cooked ? '✓ Bon appétit !' : cooking ? 'Enregistrement…' : 'Cuisiner ce repas'}
          </Button>

          {!cooked && missing.length > 0 && (
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={handleAddMissing}
              disabled={addingToCart}
            >
              <ShoppingCart className="w-4 h-4" />
              {addingToCart
                ? 'Ajout…'
                : `Ajouter les ${missing.length} manquant${missing.length > 1 ? 's' : ''} aux courses`}
            </Button>
          )}

          {cartToast && (
            <div className="flex items-center justify-between mt-2 px-0.5">
              <p className="text-[11px] text-ink-3">{cartToast}</p>
              <Link
                href="/courses"
                className="text-[11px] text-primary font-medium hover:underline underline-offset-2 ml-2 shrink-0"
              >
                Voir la liste →
              </Link>
            </div>
          )}

          {!cooked && available.length > 0 && (
            <p className="text-[11px] text-ink-3 text-center mt-2">
              Les ingrédients utilisés seront retirés du stock.
            </p>
          )}
        </div>

      </SheetContent>
    </Sheet>
  )
}
