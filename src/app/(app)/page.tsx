import Link from 'next/link'
import { ChefHat, ScanText, Package, ChevronRight, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

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

  const [{ count: totalItems }, { count: urgentItems }] = await Promise.all([
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
  ])

  const firstName = profile?.display_name ?? 'vous'
  const stock = totalItems ?? 0
  const urgent = urgentItems ?? 0

  return (
    <div className="flex flex-col min-h-full px-4 pt-8 pb-6">
      {/* Salutation */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Bonjour, {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">Que prépare-t-on ?</p>
      </div>

      {/* Actions principales */}
      <div className="space-y-3">

        {/* Proposer un repas — action principale */}
        <Link
          href="/recettes"
          className="flex items-center gap-4 rounded-2xl bg-primary p-4 text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <div className="shrink-0 bg-white/20 rounded-xl p-2.5">
            <ChefHat className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base leading-snug">Proposer un repas</p>
            <p className="text-sm text-primary-foreground/75 mt-0.5">Suggestions basées sur votre stock</p>
          </div>
          <ChevronRight className="w-5 h-5 shrink-0 text-primary-foreground/60" />
        </Link>

        {/* Ajouter des produits */}
        <Link
          href="/importer"
          className="flex items-center gap-4 rounded-2xl bg-card border border-border p-4 hover:border-primary/30 transition-colors"
        >
          <div className="shrink-0 bg-muted rounded-xl p-2.5">
            <ScanText className="w-6 h-6 text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base leading-snug">Ajouter des produits</p>
            <p className="text-sm text-muted-foreground mt-0.5">Scan, photo ou saisie manuelle</p>
          </div>
          <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" />
        </Link>

        {/* Voir mon stock */}
        <Link
          href="/inventaire"
          className="flex items-center gap-4 rounded-2xl bg-card border border-border p-4 hover:border-primary/30 transition-colors"
        >
          <div className={`shrink-0 rounded-xl p-2.5 ${urgent > 0 ? 'bg-amber-50' : 'bg-muted'}`}>
            {urgent > 0
              ? <AlertTriangle className="w-6 h-6 text-amber-600" />
              : <Package className="w-6 h-6 text-foreground" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base leading-snug">Mon stock</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {stock === 0
                ? 'Aucun produit enregistré'
                : `${stock} produit${stock > 1 ? 's' : ''}${urgent > 0 ? ` · ${urgent} à consommer vite` : ''}`
              }
            </p>
          </div>
          <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" />
        </Link>

      </div>
    </div>
  )
}
