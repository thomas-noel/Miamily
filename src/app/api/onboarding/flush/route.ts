import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toCanonicalName } from '@/lib/canonical'
import { estimateExpiryDate } from '@/lib/expiry'

type FlushPayload = {
  cuisineStyles: string[]
  allergies: string[]
  fridgeItems: string[]
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // 1. Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  console.log('[flush] 1. auth — user:', user?.id ?? null, '| error:', authError?.message ?? null)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  console.log('[flush] 2. profile — household_id:', profile?.household_id ?? null, '| error:', profileError?.message ?? null, '| code:', profileError?.code ?? null)
  if (profileError || !profile) {
    return Response.json({ error: 'profile_not_found' }, { status: 500 })
  }

  // 3. Payload
  const body = await request.json() as FlushPayload
  const { cuisineStyles = [], allergies = [], fridgeItems = [] } = body
  console.log('[flush] 3. payload — cuisineStyles:', cuisineStyles.length, '| allergies:', allergies.length, '| fridgeItems:', fridgeItems.length)

  // 4. Ensure household
  let householdId: string
  if (profile.household_id) {
    householdId = profile.household_id as string
    console.log('[flush] 4. household — existing:', householdId)
  } else {
    console.log('[flush] 4. household — null, calling create_household RPC')
    const { error: rpcError } = await supabase.rpc('create_household', {
      p_name: 'Mon foyer',
    })
    console.log('[flush] 4. RPC result — error:', rpcError?.message ?? null, '| code:', rpcError?.code ?? null)
    if (rpcError) {
      return Response.json({ error: 'household_creation_failed', detail: rpcError.message }, { status: 500 })
    }
    const { data: refreshed, error: refreshError } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', user.id)
      .single()
    console.log('[flush] 4. re-query — household_id:', refreshed?.household_id ?? null, '| error:', refreshError?.message ?? null)
    if (!refreshed?.household_id) {
      return Response.json({ error: 'household_id_missing_after_create' }, { status: 500 })
    }
    householdId = refreshed.household_id as string
  }

  // 5. Purge existing onboarding prefs (idempotence)
  const { error: deletePrefsError, count: deletedCount } = await supabase
    .from('food_preferences')
    .delete()
    .eq('household_id', householdId)
    .in('type', ['include', 'exclude'])

  console.log('[flush] 5. delete prefs — deleted:', deletedCount ?? 'n/a', '| error:', deletePrefsError?.message ?? null, '| code:', deletePrefsError?.code ?? null)
  if (deletePrefsError) {
    return Response.json({ error: 'delete_prefs_failed', detail: deletePrefsError.message }, { status: 500 })
  }

  // 6. Insert cuisine styles
  if (cuisineStyles.length > 0) {
    const { error, count } = await supabase.from('food_preferences').insert(
      cuisineStyles.map((value) => ({ household_id: householdId, type: 'include', value })),
    )
    console.log('[flush] 6. insert styles — count:', count ?? cuisineStyles.length, '| error:', error?.message ?? null, '| code:', error?.code ?? null)
    if (error) return Response.json({ error: 'insert_styles_failed', detail: error.message }, { status: 500 })
  } else {
    console.log('[flush] 6. insert styles — skipped (empty)')
  }

  // 7. Insert allergies (skip "Aucune")
  const allergiesToStore = allergies.filter((a) => a !== 'Aucune')
  if (allergiesToStore.length > 0) {
    const { error, count } = await supabase.from('food_preferences').insert(
      allergiesToStore.map((value) => ({ household_id: householdId, type: 'exclude', value })),
    )
    console.log('[flush] 7. insert allergies — count:', count ?? allergiesToStore.length, '| error:', error?.message ?? null, '| code:', error?.code ?? null)
    if (error) return Response.json({ error: 'insert_allergies_failed', detail: error.message }, { status: 500 })
  } else {
    console.log('[flush] 7. insert allergies — skipped (none or Aucune)')
  }

  // 8. Pre-check existing inventory, then insert only missing items
  if (fridgeItems.length > 0) {
    const { data: existing, error: existingError } = await supabase
      .from('inventory_items')
      .select('canonical_name')
      .eq('household_id', householdId)

    console.log('[flush] 8. inventory check — existing:', existing?.length ?? 0, '| error:', existingError?.message ?? null, '| code:', existingError?.code ?? null)
    if (existingError) {
      return Response.json({ error: 'inventory_check_failed', detail: existingError.message }, { status: 500 })
    }

    const existingCanonicals = new Set(
      (existing ?? []).map((r) => r.canonical_name as string),
    )

    const toInsert = fridgeItems
      .map((name) => ({ name, canonical: toCanonicalName(name) }))
      .filter(({ canonical }) => !existingCanonicals.has(canonical))
      .map(({ name, canonical }) => ({
        household_id:          householdId,
        name,
        normalized_name:       canonical,
        canonical_name:        canonical,
        category_id:           null,
        quantity:              1,
        unit:                  'unité(s)',
        storage_location:      'fridge' as const,
        expiry_date:           null,
        estimated_expiry_date: estimateExpiryDate(7),
        is_expiry_estimated:   true,
        source:                'manual' as const,
        added_by:              user.id,
      }))

    console.log('[flush] 8. inventory insert — toInsert:', toInsert.length, 'of', fridgeItems.length, 'items')

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('inventory_items')
        .insert(toInsert)
      console.log('[flush] 8. inventory insert result — error:', insertError?.message ?? null, '| code:', insertError?.code ?? null)
      if (insertError) {
        return Response.json({ error: 'insert_inventory_failed', detail: insertError.message }, { status: 500 })
      }
    }
  } else {
    console.log('[flush] 8. inventory — skipped (no fridgeItems)')
  }

  // 9. Commit — only if everything above succeeded
  const { error: onboardedError } = await supabase
    .from('profiles')
    .update({ onboarded: true })
    .eq('id', user.id)

  console.log('[flush] 9. onboarded — error:', onboardedError?.message ?? null, '| code:', onboardedError?.code ?? null)
  if (onboardedError) {
    return Response.json({ error: 'onboarded_flag_failed', detail: onboardedError.message }, { status: 500 })
  }

  console.log('[flush] done — ok')
  return Response.json({ ok: true, householdId })
}
