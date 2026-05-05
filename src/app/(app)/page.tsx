import { createClient } from '@/lib/supabase/server'

export default async function AccueilPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, household_id')
    .eq('id', user!.id)
    .single()

  const { data: household } = await supabase
    .from('households')
    .select('name, invite_code')
    .eq('id', profile!.household_id!)
    .single()

  return (
    <div className="p-4 space-y-6">
      <div className="pt-6">
        <h1 className="text-2xl font-semibold">
          Bonjour, {profile?.display_name} 👋
        </h1>
        <p className="text-muted-foreground">Foyer : {household?.name}</p>
      </div>

      <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 space-y-3">
        <p className="text-sm font-medium text-primary">Sprint 1 — Fondations ✓</p>
        <p className="text-sm text-muted-foreground">Auth + household fonctionnels.</p>
        <div className="pt-1">
          <p className="text-xs text-muted-foreground mb-1">Code d&apos;invitation</p>
          <p className="font-mono font-bold tracking-widest text-lg">{household?.invite_code}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Partage ce code à Debora pour qu&apos;elle rejoigne le foyer
          </p>
        </div>
      </div>
    </div>
  )
}
