'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { InventoryItem, ProductCategory, StorageLocation } from '@/types/database'
import ExpiryBadge from '@/components/expiry-badge'
import InventoryItemSheet from '@/components/inventory-item-sheet'
import { Button } from '@/components/ui/button'

const TABS: { key: StorageLocation; label: string; emoji: string }[] = [
  { key: 'fridge', label: 'Frigo', emoji: '🧊' },
  { key: 'pantry', label: 'Placards', emoji: '🗄️' },
  { key: 'freezer', label: 'Congélo', emoji: '❄️' },
]

export default function InventairePage() {
  const supabase = createClient()

  const [items, setItems] = useState<InventoryItem[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [householdId, setHouseholdId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<StorageLocation>('fridge')
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

  const tabItems = items.filter((i) => i.storage_location === activeTab)

  function openAdd() {
    setSelectedItem(null)
    setSheetOpen(true)
  }

  function openEdit(item: InventoryItem) {
    setSelectedItem(item)
    setSheetOpen(true)
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-3">
        <h1 className="text-2xl font-semibold">Mon stock</h1>
        <Button size="sm" onClick={openAdd} className="rounded-full h-9 w-9 p-0">
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mb-4">
        {TABS.map((tab) => {
          const count = items.filter((i) => i.storage_location === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.emoji} {tab.label}
              {count > 0 && (
                <span className={`ml-1 text-xs ${activeTab === tab.key ? 'opacity-80' : 'opacity-60'}`}>
                  ({count})
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Liste */}
      <div className="flex-1 px-4 space-y-2">
        {loading && (
          <p className="text-center text-muted-foreground py-8">Chargement…</p>
        )}

        {!loading && tabItems.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <p className="text-4xl">{TABS.find((t) => t.key === activeTab)?.emoji}</p>
            <p className="text-muted-foreground">Rien dans ce compartiment</p>
            <Button variant="outline" size="sm" onClick={openAdd} className="mt-2">
              <Plus className="w-4 h-4 mr-1" /> Ajouter un produit
            </Button>
          </div>
        )}

        {tabItems.map((item) => (
          <button
            key={item.id}
            onClick={() => openEdit(item)}
            className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border px-4 py-3 text-left hover:border-primary/30 transition-colors"
          >
            <span className="text-2xl shrink-0">
              {item.product_categories?.emoji ?? '📦'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.name}</p>
              <p className="text-sm text-muted-foreground">
                {item.quantity} {item.unit}
              </p>
            </div>
            <ExpiryBadge
              estimatedExpiryDate={item.estimated_expiry_date}
              isEstimated={item.is_expiry_estimated}
            />
          </button>
        ))}
      </div>

      {/* FAB mobile */}
      <button
        onClick={openAdd}
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
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
        defaultStorage={activeTab}
        onSaved={loadData}
      />
    </div>
  )
}
