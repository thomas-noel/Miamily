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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return Response.json({ error: 'profile_not_found' }, { status: 500 })
  }

  // 3. Payload
  const body = await request.json() as FlushPayload
  const { cuisineStyles = [], allergies = [], fridgeItems = [] } = body

  // 4. Ensure household
  let householdId: string
  if (profile.household_id) {
    householdId = profile.household_id as string
  } else {
    const { error: rpcError } = await supabase.rpc('create_household', {
      p_name: 'Mon foyer',
    })
    if (rpcError) {
      return Response.json({ error: 'household_creation_failed' }, { status: 500 })
    }
    const { data: refreshed } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', user.id)
      .single()
    if (!refreshed?.household_id) {
      return Response.json({ error: 'household_id_missing_after_create' }, { status: 500 })
    }
    householdId = refreshed.household_id as string
  }

  // 5. Purge existing onboarding prefs (idempotence)
  const { error: deletePrefsError } = await supabase
    .from('food_preferences')
    .delete()
    .eq('household_id', householdId)
    .in('type', ['cuisine_style', 'exclude'])

  if (deletePrefsError) {
    return Response.json({ error: 'delete_prefs_failed' }, { status: 500 })
  }

  // 6. Insert cuisine styles
  if (cuisineStyles.length > 0) {
    const { error } = await supabase.from('food_preferences').insert(
      cuisineStyles.map((value) => ({ household_id: householdId, type: 'cuisine_style', value })),
    )
    if (error) return Response.json({ error: 'insert_styles_failed' }, { status: 500 })
  }

  // 7. Insert allergies (skip "Aucune")
  const allergiesToStore = allergies.filter((a) => a !== 'Aucune')
  if (allergiesToStore.length > 0) {
    const { error } = await supabase.from('food_preferences').insert(
      allergiesToStore.map((value) => ({ household_id: householdId, type: 'exclude', value })),
    )
    if (error) return Response.json({ error: 'insert_allergies_failed' }, { status: 500 })
  }

  // 8. Pre-check existing inventory, then insert only missing items
  if (fridgeItems.length > 0) {
    const { data: existing, error: existingError } = await supabase
      .from('inventory_items')
      .select('canonical_name')
      .eq('household_id', householdId)

    if (existingError) {
      return Response.json({ error: 'inventory_check_failed' }, { status: 500 })
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

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('inventory_items')
        .insert(toInsert)
      if (insertError) {
        return Response.json({ error: 'insert_inventory_failed' }, { status: 500 })
      }
    }
  }

  // 9. Commit — only if everything above succeeded
  const { error: onboardedError } = await supabase
    .from('profiles')
    .update({ onboarded: true })
    .eq('id', user.id)

  if (onboardedError) {
    return Response.json({ error: 'onboarded_flag_failed' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
