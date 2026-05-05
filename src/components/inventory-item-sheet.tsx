'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarIcon, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { estimateExpiryDate } from '@/lib/expiry'
import type { InventoryItem, ProductCategory, StorageLocation } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const UNITS = ['g', 'kg', 'ml', 'cl', 'l', 'unité(s)', 'tranche(s)', 'portion(s)', 'boîte(s)', 'sachet(s)', 'bouteille(s)']

const STORAGE_LABELS: Record<StorageLocation, string> = {
  fridge: '🧊 Frigo',
  pantry: '🗄️ Placard',
  freezer: '❄️ Congélo',
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  categories: ProductCategory[]
  item?: InventoryItem | null
  defaultStorage?: StorageLocation
  onSaved: () => void
}

export default function InventoryItemSheet({
  open,
  onOpenChange,
  householdId,
  categories,
  item,
  defaultStorage = 'fridge',
  onSaved,
}: Props) {
  const isEdit = !!item
  const supabase = createClient()

  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('unité(s)')
  const [categoryId, setCategoryId] = useState<string>('')
  const [storage, setStorage] = useState<StorageLocation>(defaultStorage)
  const [expiryDate, setExpiryDate] = useState<Date | undefined>()
  const [estimatedDays, setEstimatedDays] = useState<number>(7)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (item) {
      setName(item.name)
      setQuantity(String(item.quantity))
      setUnit(item.unit)
      setCategoryId(item.category_id ?? '')
      setStorage(item.storage_location)
      setExpiryDate(item.expiry_date ? new Date(item.expiry_date) : undefined)
    } else {
      setName('')
      setQuantity('1')
      setUnit('unité(s)')
      setCategoryId('')
      setStorage(defaultStorage)
      setExpiryDate(undefined)
      setEstimatedDays(7)
    }
    setSaveError(null)
  }, [item, open, defaultStorage])

  function handleCategoryChange(id: string | null) {
    setCategoryId(id ?? '')
    const cat = categories.find((c) => c.id === id)
    if (cat) {
      setStorage(cat.default_storage)
      setEstimatedDays(cat.default_expiry_days)
    }
  }

  const selectedCategory = categories.find((c) => c.id === categoryId)
  const finalEstimatedExpiry = expiryDate
    ? format(expiryDate, 'yyyy-MM-dd')
    : estimateExpiryDate(estimatedDays)

  async function handleSave() {
    if (!name.trim()) return
    setLoading(true)
    setSaveError(null)

    const normalized = name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const payload = {
      household_id: householdId,
      name: name.trim(),
      normalized_name: normalized,
      canonical_name: normalized,
      category_id: categoryId || null,
      quantity: parseFloat(quantity) || 1,
      unit,
      storage_location: storage,
      expiry_date: expiryDate ? format(expiryDate, 'yyyy-MM-dd') : null,
      estimated_expiry_date: finalEstimatedExpiry,
      is_expiry_estimated: !expiryDate,
      source: 'manual' as const,
    }

    const { error } = isEdit
      ? await supabase.from('inventory_items').update(payload).eq('id', item!.id)
      : await supabase.from('inventory_items').insert(payload)

    setLoading(false)

    if (error) {
      console.error('Supabase error:', error)
      setSaveError(`Erreur : ${error.message}`)
      return
    }

    onOpenChange(false)
    onSaved()
  }

  async function handleDelete() {
    if (!item) return
    setDeleting(true)
    await supabase.from('inventory_items').delete().eq('id', item.id)
    setDeleting(false)
    onOpenChange(false)
    onSaved()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between">
            <SheetTitle>{isEdit ? 'Modifier le produit' : 'Ajouter un produit'}</SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full p-1 hover:bg-muted transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </SheetHeader>

        <div className="space-y-4 pb-6">
          {/* Nom */}
          <div className="space-y-2">
            <Label htmlFor="item-name">Nom du produit</Label>
            <Input
              id="item-name"
              placeholder="Ex: Courgettes, Saumon, Pâtes..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus={!isEdit}
            />
          </div>

          {/* Quantité + Unité */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantité</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label>Unité</Label>
              <Select value={unit} onValueChange={(v) => { if (v !== null) setUnit(v) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Catégorie */}
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select value={categoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une catégorie">
                  {selectedCategory ? `${selectedCategory.emoji} ${selectedCategory.name}` : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Emplacement */}
          <div className="space-y-2">
            <Label>Emplacement</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(STORAGE_LABELS) as [StorageLocation, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStorage(key)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                    storage === key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Date de péremption */}
          <div className="space-y-2">
            <Label>Date de péremption</Label>
            <Popover>
              <PopoverTrigger
                className={cn(
                  'flex h-9 w-full items-center justify-start rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  !expiryDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {expiryDate
                  ? format(expiryDate, 'd MMMM yyyy', { locale: fr })
                  : 'Sélectionner (optionnel)'}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiryDate}
                  onSelect={setExpiryDate}
                  initialFocus
                  locale={fr}
                />
              </PopoverContent>
            </Popover>

            {!expiryDate && (
              <p className="text-xs text-muted-foreground">
                ✨ Date estimée :{' '}
                <span className="font-medium">
                  {format(new Date(finalEstimatedExpiry), 'd MMMM', { locale: fr })}
                </span>
                {selectedCategory && ` (${selectedCategory.default_expiry_days}j pour ${selectedCategory.name})`}
              </p>
            )}

            {expiryDate && (
              <button
                type="button"
                onClick={() => setExpiryDate(undefined)}
                className="text-xs text-muted-foreground underline"
              >
                Effacer la date
              </button>
            )}
          </div>

          <Separator />

          {saveError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{saveError}</p>
          )}

          <Button className="w-full" onClick={handleSave} disabled={loading || !name.trim()}>
            {loading ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter au stock'}
          </Button>

          {isEdit && (
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deleting ? 'Suppression…' : 'Supprimer ce produit'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
