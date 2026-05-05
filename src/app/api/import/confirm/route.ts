import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { estimateExpiryDate } from '@/lib/expiry'
import { toCanonicalName } from '@/lib/canonical'

type ConfirmedItem = {
  name: string
  canonical_name?: string
  quantity: number
  unit: string
  storage_location: 'fridge' | 'pantry' | 'freezer'
  estimated_expiry_days: number
}

type GroupEntry = {
  name: string
  canonical_name: string
  unit: string
  storage_location: 'fridge' | 'pantry' | 'freezer'
  estimated_expiry_days: number
  totalQty: number
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile?.household_id) {
    return Response.json({ error: 'No household' }, { status: 400 })
  }

  const householdId = profile.household_id as string
  const body = await request.json()
  const importId: string = body.importId
  const items: ConfirmedItem[] = body.items ?? []

  console.log('[confirm] received items:', JSON.stringify(items.map(i => ({ name: i.name, canonical_name: i.canonical_name, qty: i.quantity, unit: i.unit }))))

  if (!importId || items.length === 0) {
    return Response.json({ error: 'Missing importId or items' }, { status: 400 })
  }

  const enriched = items.map((item) => ({
    ...item,
    canonical_name: toCanonicalName(item.canonical_name ?? item.name),
  }))

  console.log('[confirm] enriched canonical_names:', enriched.map(i => ({ name: i.name, canonical: i.canonical_name })))

  const groups = new Map<string, GroupEntry>()
  for (const item of enriched) {
    const key = `${item.canonical_name}|${item.unit}|${item.storage_location}`
    const g = groups.get(key)
    if (g) {
      g.totalQty += item.quantity
    } else {
      groups.set(key, {
        name: item.name,
        canonical_name: item.canonical_name,
        unit: item.unit,
        storage_location: item.storage_location,
        estimated_expiry_days: item.estimated_expiry_days,
        totalQty: item.quantity,
      })
    }
  }

  console.log('[confirm] groups:', [...groups.entries()].map(([k, g]) => ({ key: k, qty: g.totalQty })))

  let inserted = 0
  let updated = 0
  const errors: string[] = []

  for (const [, g] of groups) {
    const { data: existing, error: selectError } = await supabase
      .from('inventory_items')
      .select('id, quantity')
      .eq('household_id', householdId)
      .eq('canonical_name', g.canonical_name)
      .eq('unit', g.unit)
      .eq('storage_location', g.storage_location)
      .maybeSingle()

    if (selectError) {
      console.error('[confirm] select error for', g.canonical_name, ':', selectError.message)
      errors.push(`select(${g.canonical_name}): ${selectError.message}`)
      continue
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          quantity: existing.quantity + g.totalQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('[confirm] update error for', g.canonical_name, ':', updateError.message)
        errors.push(`update(${g.canonical_name}): ${updateError.message}`)
        continue
      }
      updated++
    } else {
      const payload = {
        household_id: householdId,
        name: g.name,
        normalized_name: g.canonical_name,
        canonical_name: g.canonical_name,
        category_id: null,
        quantity: g.totalQty,
        unit: g.unit,
        storage_location: g.storage_location,
        expiry_date: null,
        estimated_expiry_date: estimateExpiryDate(g.estimated_expiry_days),
        is_expiry_estimated: true,
        source: 'paste' as const,
        added_by: user.id,
      }
      console.log('[confirm] inserting:', JSON.stringify(payload))

      const { error: insertError } = await supabase.from('inventory_items').insert(payload)

      if (insertError) {
        console.error('[confirm] insert error for', g.canonical_name, ':', insertError.message)
        errors.push(`insert(${g.canonical_name}): ${insertError.message}`)
        continue
      }
      inserted++
    }
  }

  await supabase
    .from('imports')
    .update({ status: errors.length === 0 ? 'confirmed' : 'failed' })
    .eq('id', importId)
    .eq('household_id', householdId)

  if (errors.length > 0) {
    return Response.json({ inserted, updated, upserted: inserted + updated, errors }, { status: 207 })
  }

  return Response.json({ inserted, updated, upserted: inserted + updated })
}
