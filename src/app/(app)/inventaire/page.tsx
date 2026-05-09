'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { InventoryItem, ProductCategory, StorageLocation } from '@/types/database'
import { getExpiryStatus } from '@/lib/expiry'
import ExpiryBadge from '@/components/expiry-badge'
import InventoryItemSheet from '@/components/inventory-item-sheet'
import { BetaChip } from '@/components/ui/beta-chip'
import { Button } from '@/components/ui/button'

type Filter = 'all' | StorageLocation

const STORAGE_LABEL: Record<StorageLocation, string> = {
  fridge: 'Frigo',
  pantry: 'Placard',
  freezer: 'Congelé',
}

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Tout',
  fridge: 'Frigo',
  pantry: 'Placard',
  freezer: 'Congelé',
}

const LOCATION_SECTIONS: { key: StorageLocation; label: string }[] = [
  { key: 'fridge', label: 'Frigo' },
  { key: 'pantry', label: 'Placard' },
  { key: 'freezer', label: 'Congelé' },
]

function isUrgent(item: InventoryItem): boolean {
  const status = getExpiryStatus(item.estimated_expiry_date)
  return status === 'critical' || status === 'warning'
}

export default function InventairePage() {
  const supabase = createClient()

  const [items, setItems] = useState<InventoryItem[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [householdId, setHouseholdId] = useState<string>('')
  const [activeFilter, setActiveFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', user.id)
      .single()

    if (!profile?.household_id) return
    setHouseholdId(profile.household_id)

    const [{ data: itemsData }, { data: catsData }] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('*, product_categories(*)')
        .eq('household_id', profile.household_id)
        .order('estimated_expiry_date', { ascending: true }),
      supabase.from('product_categories').select('*').order('name'),
    ])

    setItems(itemsData ?? [])
    setCategories(catsData ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  function openAdd() {
    setSelectedItem(null)
    setSheetOpen(true)
  }

  function openEdit(item: InventoryItem) {
    setSelectedItem(item)
    setSheetOpen(true)
  }

  // ── Filtering logic ────────────────────────────────────────────────────────

  const searchedItems = query.trim()
    ? items.filter(i => i.name.toLowerCase().includes(query.toLowerCase().trim()))
    : items

  const pool = activeFilter === 'all'
    ? searchedItems
    : searchedItems.filter(i => i.storage_location === activeFilter)

  const urgentItems = pool.filter(isUrgent)
  const nonUrgentItems = pool.filter(i => !isUrgent(i))

  const locationSections = LOCATION_SECTIONS
    .map(loc => ({
      key: loc.key,
      label: loc.label,
      items: nonUrgentItems.filter(i => i.storage_location === loc.key),
    }))
    .filter(s => s.items.length > 0)

  const counts: Record<Filter, number> = {
    all: searchedItems.length,
    fridge: searchedItems.filter(i => i.storage_location === 'fridge').length,
    pantry: searchedItems.filter(i => i.storage_location === 'pantry').length,
    freezer: searchedItems.filter(i => i.storage_location === 'freezer').length,
  }

  const hasResults = urgentItems.length > 0 || locationSections.length > 0
  const stockIsEmpty = !loading && items.length === 0
  const searchEmpty = !loading && !stockIsEmpty && !hasResults

  const defaultStorage: StorageLocation = activeFilter !== 'all' ? activeFilter : 'fridge'

  return (
    <div className="flex flex-col min-h-full pb-24">

      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-10 pb-4">
        <h1 className="font-serif text-[26px] leading-[1.15] tracking-[-0.2px]">Mon stock</h1>
        <BetaChip />
      </div>

      {/* Search */}
      <div className="px-5 mb-4">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-4 py-2.5">
          <Search className="w-4 h-4 text-ink-3 shrink-0" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-ink-3 outline-none min-w-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="shrink-0 rounded-full p-0.5 hover:bg-surface-muted transition-colors"
              aria-label="Effacer la recherche"
            >
              <X className="w-3.5 h-3.5 text-ink-3" />
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 px-5 mb-5 overflow-x-auto pb-0.5">
        {(['all', 'fridge', 'pantry', 'freezer'] as Filter[]).map((key) => {
          const active = activeFilter === key
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? key === 'all'
                    ? 'bg-foreground text-background'
                    : 'bg-primary text-primary-foreground'
                  : 'bg-surface border border-border text-foreground hover:border-primary/30'
              }`}
            >
              {FILTER_LABELS[key]} · {counts[key]}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 px-5 space-y-5">

        {loading && (
          <p className="text-center text-ink-3 text-sm py-8">Chargement…</p>
        )}

        {stockIsEmpty && (
          <div className="py-16 flex flex-col items-center gap-2 text-center">
            <p className="font-medium text-foreground">Votre stock est vide.</p>
            <p className="text-sm text-ink-3">Ajoutez vos premiers produits pour démarrer.</p>
            <Button onClick={openAdd} className="mt-3">
              <Plus className="w-4 h-4 mr-1" />Ajouter un produit
            </Button>
          </div>
        )}

        {searchEmpty && (
          <p className="text-center text-ink-3 text-sm py-12">
            Aucun produit trouvé pour cette recherche.
          </p>
        )}

        {urgentItems.length > 0 && (
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[1.4px] text-destructive mb-3">
              À utiliser vite · {urgentItems.length}
            </p>
            <div className="space-y-2">
              {urgentItems.map(item => (
                <ProductRow key={item.id} item={item} onClick={() => openEdit(item)} />
              ))}
            </div>
          </div>
        )}

        {locationSections.map(section => (
          <div key={section.key}>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[1.4px] text-ink-3 mb-3">
              {section.label} · {section.items.length}
            </p>
            <div className="space-y-2">
              {section.items.map(item => (
                <ProductRow key={item.id} item={item} onClick={() => openEdit(item)} />
              ))}
            </div>
          </div>
        ))}

      </div>

      {/* FAB */}
      <button
        onClick={openAdd}
        className="fixed bottom-20 right-5 size-14 rounded-full bg-primary text-primary-foreground shadow-cta flex items-center justify-center hover:bg-primary/90 transition-colors"
        aria-label="Ajouter un produit"
      >
        <Plus className="w-6 h-6" />
      </button>

      <InventoryItemSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        householdId={householdId}
        categories={categories}
        item={selectedItem}
        defaultStorage={defaultStorage}
        onSaved={loadData}
      />

    </div>
  )
}

// ── ProductRow ──────────────────────────────────────────────────────────────

function ProductRow({ item, onClick }: { item: InventoryItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 text-left hover:border-primary/30 transition-colors"
    >
      <div className="shrink-0 size-9 rounded-lg bg-surface-muted flex items-center justify-center">
        <span className="text-base leading-none">{item.product_categories?.emoji ?? '📦'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
        <p className="text-xs text-ink-3">
          {item.quantity} {item.unit} · {STORAGE_LABEL[item.storage_location]}
        </p>
      </div>
      <ExpiryBadge
        estimatedExpiryDate={item.estimated_expiry_date}
        isEstimated={item.is_expiry_estimated}
      />
    </button>
  )
}
