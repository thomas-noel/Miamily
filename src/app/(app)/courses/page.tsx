'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, ShoppingCart, Trash2, ChevronDown, ChevronUp, Check, Share2, Copy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ShoppingListItem } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const UNITS = [
  'unité(s)', 'g', 'kg', 'ml', 'cl', 'l',
  'tranche(s)', 'portion(s)', 'boîte(s)', 'sachet(s)', 'bouteille(s)',
]

function buildShareText(items: ShoppingListItem[]): string {
  const lines = items.map(item => {
    const qty = item.quantity && item.unit ? ` — ${item.quantity} ${item.unit}` : ''
    return `☐ ${item.name}${qty}`
  })
  return `Liste de courses Miamily\n\n${lines.join('\n')}`
}

export default function CoursesPage() {
  const supabase = createClient()
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [householdId, setHouseholdId] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [checkedOpen, setCheckedOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addQty, setAddQty] = useState('')
  const [addUnit, setAddUnit] = useState('unité(s)')
  const [adding, setAdding] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', user.id)
      .single()

    if (!profile?.household_id) return
    setHouseholdId(profile.household_id)

    const { data } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('household_id', profile.household_id)
      .order('created_at', { ascending: true })

    setItems(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const unchecked = items.filter(i => !i.is_checked)
  const checked = items.filter(i => i.is_checked)

  async function handleToggle(item: ShoppingListItem) {
    const newVal = !item.is_checked
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: newVal } : i))
    await supabase
      .from('shopping_list_items')
      .update({ is_checked: newVal })
      .eq('id', item.id)
  }

  async function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('shopping_list_items').delete().eq('id', id)
  }

  async function handleClearChecked() {
    if (checked.length === 0 || clearing) return
    setClearing(true)
    const ids = checked.map(i => i.id)
    setItems(prev => prev.filter(i => !ids.includes(i.id)))
    await supabase.from('shopping_list_items').delete().in('id', ids)
    setClearing(false)
    setCheckedOpen(false)
  }

  async function handleAdd() {
    if (!addName.trim() || adding || !householdId) return
    setAdding(true)
    const qty = addQty ? parseFloat(addQty) : null

    const { data: newItem } = await supabase
      .from('shopping_list_items')
      .insert({
        household_id: householdId,
        name: addName.trim(),
        quantity: qty,
        unit: qty !== null ? addUnit : null,
        is_checked: false,
        added_by: userId || null,
        source: 'manual',
      })
      .select()
      .single()

    if (newItem) setItems(prev => [...prev, newItem as ShoppingListItem])
    setAddName('')
    setAddQty('')
    setAddUnit('unité(s)')
    setSheetOpen(false)
    setAdding(false)
  }

  async function handleCopy() {
    const text = buildShareText(unchecked)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // clipboard non disponible — rien à faire
    }
  }

  async function handleShare() {
    const text = buildShareText(unchecked)
    try {
      await navigator.share({ title: 'Liste de courses Miamily', text })
    } catch {
      // annulé par l'utilisateur ou non supporté
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-4rem)] pb-20">
        <div className="px-5 pt-6 pb-4 flex items-center justify-between">
          <h1 className="font-serif text-2xl">Courses</h1>
        </div>
        <div className="px-4 space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 rounded-xl bg-surface-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col min-h-[calc(100vh-4rem)] pb-24">
        {/* Header */}
        <div className="px-5 pt-6 pb-4 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl">Courses</h1>
            {unchecked.length > 0 && (
              <p className="text-sm text-ink-3 mt-0.5">
                {unchecked.length} article{unchecked.length > 1 ? 's' : ''} à acheter
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShareOpen(true)}
              aria-label="Partager la liste"
            >
              <Share2 className="w-5 h-5" />
            </Button>
            <Button
              variant="soft"
              size="icon"
              onClick={() => setSheetOpen(true)}
              aria-label="Ajouter un article"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <EmptyState
            icon={<ShoppingCart className="w-6 h-6" />}
            title="Aucun article dans la liste"
            subtitle="Ajoutez un produit ou importez les ingrédients manquants depuis une recette."
            cta={
              <Button variant="soft" size="sm" onClick={() => setSheetOpen(true)}>
                <Plus className="w-4 h-4" />
                Ajouter un article
              </Button>
            }
          />
        )}

        {/* Unchecked items */}
        {unchecked.length > 0 && (
          <div className="px-4 space-y-2">
            {unchecked.map(item => (
              <ShoppingItemRow
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Checked section — "Déjà pris" */}
        {checked.length > 0 && (
          <div className="px-4 mt-4">
            <button
              type="button"
              onClick={() => setCheckedOpen(v => !v)}
              className="flex items-center gap-2 w-full text-left py-2"
            >
              {checkedOpen
                ? <ChevronUp className="w-4 h-4 text-ink-3" />
                : <ChevronDown className="w-4 h-4 text-ink-3" />}
              <span className="text-sm font-medium text-ink-3">
                Dans mon caddie ({checked.length})
              </span>
            </button>

            {checkedOpen && (
              <div className="space-y-2 mt-1">
                {checked.map(item => (
                  <ShoppingItemRow
                    key={item.id}
                    item={item}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
                <button
                  type="button"
                  onClick={handleClearChecked}
                  disabled={clearing}
                  className="flex items-center gap-1.5 text-sm text-ink-3 hover:text-destructive transition-colors mt-1 py-1 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {clearing ? 'Suppression…' : 'Vider mon caddie'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share Sheet */}
      <Sheet open={shareOpen} onOpenChange={(v) => { setShareOpen(v); if (!v) setCopied(false) }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          showCloseButton={false}
        >
          <SheetHeader className="p-0 mb-5">
            <SheetTitle className="font-serif text-xl font-normal text-left">
              Partager la liste
            </SheetTitle>
          </SheetHeader>

          {unchecked.length === 0 ? (
            <p className="text-sm text-ink-3">Aucun article à partager.</p>
          ) : (
            <div className="space-y-2">
              <Button
                variant="secondary"
                className="w-full justify-start gap-3"
                onClick={handleCopy}
              >
                <Copy className="w-4 h-4" />
                {copied ? '✓ Liste copiée' : 'Copier la liste'}
              </Button>
              {canShare && (
                <Button
                  variant="secondary"
                  className="w-full justify-start gap-3"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4" />
                  Partager
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          showCloseButton={false}
        >
          <SheetHeader className="p-0 mb-5">
            <SheetTitle className="font-serif text-xl font-normal text-left">
              Ajouter un article
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nom du produit (ex : Tomates)"
              value={addName}
              onChange={e => setAddName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              autoFocus
            />
            <div className="flex gap-2">
              <Input
                placeholder="Qté"
                type="number"
                min="0"
                step="any"
                className="w-24"
                value={addQty}
                onChange={e => setAddQty(e.target.value)}
              />
              <select
                value={addUnit}
                onChange={e => setAddUnit(e.target.value)}
                className="flex-1 h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setSheetOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="dark"
                className="flex-1"
                onClick={handleAdd}
                disabled={!addName.trim() || adding}
              >
                {adding ? 'Ajout…' : 'Ajouter'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function ShoppingItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingListItem
  onToggle: (item: ShoppingListItem) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-opacity',
      item.is_checked && 'opacity-50',
    )}>
      <button
        type="button"
        onClick={() => onToggle(item)}
        className={cn(
          'shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
          item.is_checked
            ? 'border-primary bg-primary'
            : 'border-border hover:border-primary/60',
        )}
        aria-label={item.is_checked ? 'Décocher' : 'Cocher'}
      >
        {item.is_checked && <Check className="w-3 h-3 text-white" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          item.is_checked && 'line-through text-ink-3',
        )}>
          {item.name}
        </p>
        {(item.quantity || item.recipe_name) && (
          <p className="text-xs text-ink-3 mt-0.5 truncate">
            {item.quantity && item.unit ? `${item.quantity} ${item.unit}` : ''}
            {item.quantity && item.recipe_name ? ' · ' : ''}
            {item.recipe_name ? `Pour : ${item.recipe_name}` : ''}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="shrink-0 p-1 text-ink-3 hover:text-destructive transition-colors rounded"
        aria-label="Supprimer"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
