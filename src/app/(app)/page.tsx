import Link from 'next/link'
import { Package, Check, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { BetaChip } from '@/components/ui/beta-chip'
import { daysUntilExpiry, getExpiryStatus } from '@/lib/expiry'

const STORAGE_LABEL: Record<string, string> = {
  fridge: 'Frigo',
  pantry: 'Placard',
  freezer: 'Congélo',
}

type UrgentItem = {
  id: string
  name: string
  quantity: number
  unit: string
  storage_location: string
  estimated_expiry_date: string
}

export default async function AccueilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, household_id')
    .eq('id', user!.id)
    .single()

  const householdId = profile?.household_id
  const today = new Date().toISOString().split('T')[0]
  const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ count: totalItems }, { count: urgentCount }, { data: urgentList }] = await Promise.all([
    supabase
      .from('inventory_items')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId!),
    supabase
      .from('inventory_items')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId!)
      .gte('estimated_expiry_date', today)
      .lte('estimated_expiry_date', in7days),
    supabase
      .from('inventory_items')
      .select('id, name, quantity, unit, storage_location, estimated_expiry_date')
      .eq('household_id', householdId!)
      .gte('estimated_expiry_date', today)
      .lte('estimated_expiry_date', in7days)
      .order('estimated_expiry_date', { ascending: true })
      .limit(3),
  ])

  const firstName = profile?.display_name ?? 'vous'
  const stock = totalItems ?? 0
  const urgent = urgentCount ?? 0
  const urgentRows = (urgentList ?? []) as UrgentItem[]

  return (
    <div className="flex flex-col min-h-full px-5 pt-10 pb-24">

      {/* Header : greeting + badge bêta */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-1">
          <p className="text-sm text-ink-2">Bonjour, {firstName}</p>
          <div className="flex items-center gap-2">
            <Link href="/preferences" aria-label="Paramètres" className="text-ink-3 hover:text-foreground transition-colors">
              <Settings className="w-4 h-4" />
            </Link>
            <BetaChip />
          </div>
        </div>
        <h1 className="font-serif text-[32px] leading-[1.1] tracking-[-0.4px]">
          Que prépare-t-on aujourd'hui ?
        </h1>
      </div>

      {/* Hero — Suggestion IA */}
      <Link
        href="/recettes"
        className="block rounded-2xl bg-primary p-5 shadow-cta mb-6"
      >
        <p className="font-mono text-[10px] font-bold uppercase tracking-[1.4px] text-white/60 mb-2">
          Suggestion IA
        </p>
        <h2 className="font-serif text-[22px] leading-[1.2] text-white mb-1">
          3 idées avec votre stock
        </h2>
        <p className="text-sm text-white/70">
          Salé ou sucré, en 30 secondes.
        </p>
        <div className="mt-4">
          <span className="inline-flex items-center bg-white/20 text-white text-sm font-medium rounded-full px-4 py-1.5">
            Suggérer →
          </span>
        </div>
      </Link>

      {/* Section : À utiliser bientôt */}
      {urgent > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[1.4px] text-ink-3">
              À utiliser bientôt · {urgent}
            </p>
            <Link href="/inventaire" className="text-sm text-primary font-medium">
              Tout voir →
            </Link>
          </div>
          <div className="space-y-2">
            {urgentRows.map((item) => {
              const days = daysUntilExpiry(item.estimated_expiry_date)
              const status = getExpiryStatus(item.estimated_expiry_date)
              const label = days <= 0 ? 'Périmé' : days === 1 ? 'Demain' : `${days}j`
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3"
                >
                  <div className="shrink-0 size-8 rounded-lg bg-surface-muted flex items-center justify-center">
                    <Package className="w-4 h-4 text-ink-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-snug truncate">{item.name}</p>
                    <p className="text-xs text-ink-3">
                      {item.quantity} {item.unit} · {STORAGE_LABEL[item.storage_location] ?? item.storage_location}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium rounded-full px-2.5 py-0.5 ${
                    status === 'critical'
                      ? 'bg-danger-soft text-destructive'
                      : status === 'warning'
                        ? 'bg-accent-soft text-accent-ink'
                        : 'bg-primary-soft text-primary-ink'
                  }`}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tout sous contrôle — quand stock > 0 mais rien d'urgent */}
      {urgent === 0 && stock > 0 && (
        <div className="mb-6 rounded-2xl border border-border bg-surface px-5 py-4 flex items-center gap-4">
          <div className="size-10 rounded-full bg-primary-soft flex items-center justify-center shrink-0">
            <Check className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Tout est sous contrôle</p>
            <p className="text-xs text-ink-3 mt-0.5">Aucun produit à utiliser d'urgence.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-serif text-[28px] leading-none text-foreground">{stock}</p>
          <p className="text-xs text-ink-3 mt-1.5">produits en stock</p>
        </div>
        <Link
          href="/importer"
          className="rounded-xl border border-border bg-surface p-4 hover:border-primary/30 transition-colors"
        >
          <p className="font-serif text-[28px] leading-none text-primary">+</p>
          <p className="text-xs text-ink-3 mt-1.5">Ajouter des produits</p>
        </Link>
      </div>

    </div>
  )
}
