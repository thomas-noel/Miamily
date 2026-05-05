import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { toCanonicalName } from '@/lib/canonical'
import { daysUntilExpiry } from '@/lib/expiry'
import { CATEGORY_LABEL } from '@/lib/food-categories'

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export type RecipeMode = 'normal' | 'rapide' | 'leger' | 'familial'

export type RecipeIngredient = {
  name: string
  canonical_name: string
  quantity: number
  unit: string
  available: boolean
}

export type Recipe = {
  name: string
  duration_minutes: number
  persons: number
  steps: string[]
  ingredients: RecipeIngredient[]
  coverage_pct: number
  anti_gaspillage: boolean
  expiring_items: string[]
}

type InventoryRow = {
  canonical_name: string
  name: string
  quantity: number
  unit: string
  estimated_expiry_date: string
}

type AiIngredient = {
  name: string
  canonical_name: string
  quantity: number
  unit: string
}

type AiRecipe = {
  name: string
  duration_minutes: number
  persons: number
  steps: string[]
  ingredients: AiIngredient[]
}

type FoodMemberRow = {
  id: string
  name: string
  is_child: boolean
}

type MemberPrefRow = {
  food_member_id: string
  category: string
  preference: 'liked' | 'disliked' | 'forbidden'
}

function buildPreferencesText(members: FoodMemberRow[], memberPrefs: MemberPrefRow[]): string {
  if (members.length === 0) return ''
  const byMember: Record<string, { liked: string[]; disliked: string[]; forbidden: string[] }> = {}
  for (const m of members) byMember[m.id] = { liked: [], disliked: [], forbidden: [] }
  for (const p of memberPrefs) {
    byMember[p.food_member_id]?.[p.preference].push(CATEGORY_LABEL[p.category] ?? p.category)
  }
  const lines: string[] = ['PRÉFÉRENCES FAMILLE:']
  for (const m of members) {
    const mp = byMember[m.id]
    lines.push(`${m.name}${m.is_child ? ' (enfant 4 ans)' : ''}:`)
    if (mp.forbidden.length) lines.push(`  INTERDIT (allergie/refus absolu): ${mp.forbidden.join(', ')}`)
    if (mp.disliked.length) lines.push(`  À éviter: ${mp.disliked.join(', ')}`)
    if (mp.liked.length) lines.push(`  Aime: ${mp.liked.join(', ')}`)
    if (!mp.forbidden.length && !mp.disliked.length && !mp.liked.length) {
      lines.push('  (aucune préférence)')
    }
  }
  lines.push('Règles: ne JAMAIS utiliser un ingrédient INTERDIT. Éviter autant que possible les "À éviter". Favoriser les "Aime".')
  return lines.join('\n')
}

function prefsFingerprint(memberPrefs: MemberPrefRow[]): string {
  return memberPrefs
    .map((p) => `${p.food_member_id}:${p.category}:${p.preference}`)
    .sort()
    .join('|')
}

// ── Cache (TTL 2h) ───────────────────────────────────────────────────
type CacheEntry = { recipes: Recipe[]; ts: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 2 * 60 * 60 * 1000

function getCached(key: string): Recipe[] | null {
  const e = cache.get(key)
  if (!e) return null
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(key); return null }
  return e.recipes
}

function setCached(key: string, recipes: Recipe[]) {
  cache.set(key, { recipes, ts: Date.now() })
}

function cacheKey(householdId: string, mode: RecipeMode, inventory: InventoryRow[], lastMeal: string, lastHeaviness: string, prefsFp: string): string {
  const fingerprint = inventory.slice(0, 15).map((i) => i.canonical_name).sort().join(',')
  return `${householdId}:${mode}:${fingerprint}:${lastMeal}:${lastHeaviness}:${prefsFp.slice(0, 40)}`
}

// ── Matching ──────────────────────────────────────────────────────────
function matchIngredient(ingredientCanonical: string, inventory: InventoryRow[]): boolean {
  const canonical = toCanonicalName(ingredientCanonical)
  return inventory.some((item) => {
    if (item.canonical_name === canonical) return true
    const iWords = canonical.split(' ')
    const invWords = item.canonical_name.split(' ')
    if (iWords.length === 1 && invWords.includes(iWords[0])) return true
    if (invWords.length === 1 && iWords.includes(invWords[0])) return true
    return false
  })
}

function isExpiringIngredient(canonical: string, expiringSet: Set<string>): boolean {
  if (expiringSet.has(canonical)) return true
  for (const ec of expiringSet) {
    const a = canonical.split(' ')
    const b = ec.split(' ')
    if (a.length === 1 && b.includes(a[0])) return true
    if (b.length === 1 && a.includes(b[0])) return true
  }
  return false
}

// ── Sélection intelligente des ingrédients ───────────────────────────
// Top 15 : urgents en premier, puis par quantité décroissante
function selectTopIngredients(items: InventoryRow[]): InventoryRow[] {
  const urgent = items.filter((i) => daysUntilExpiry(i.estimated_expiry_date) <= 7)
  const others = items.filter((i) => daysUntilExpiry(i.estimated_expiry_date) > 7)
    .sort((a, b) => b.quantity - a.quantity)
  return [...urgent, ...others].slice(0, 15)
}

function buildInventoryText(items: InventoryRow[]): string {
  return items.map((item) => {
    const days = daysUntilExpiry(item.estimated_expiry_date)
    const flag = days <= 0 ? '!P' : days <= 3 ? `!${days}j` : days <= 7 ? `${days}j` : ''
    return `${flag ? flag + ' ' : ''}${item.canonical_name} x${item.quantity} ${item.unit}`
  }).join('\n')
}

const MODE_PROMPT: Record<RecipeMode, string> = {
  normal:   '2 pers. Équilibre goût/simplicité, pas de contrainte particulière.',
  rapide:   '2 pers. MAX 20 min, ≤5 étapes. JAMAIS four, mijoter, ou cuisson longue. Types imposés: omelette, poêlée, pâtes-express, wrap, sauté rapide. duration_minutes ≤20.',
  leger:    '2 pers. <500 kcal par portion. JAMAIS pâtes en plat principal, crème fraîche, gratin, fromage fondu en grande quantité. Imposer: légumes, œufs, poisson, salade composée, soupe légère.',
  familial: '4 pers. Compatible enfant 4 ans: goût doux, pas épicé, présentation simple. Types: gratin, pâtes, omelette, croquettes maison. 30-50 min. persons=4.',
}

const MODE_HEAVINESS: Record<RecipeMode, 'light' | 'normal' | 'heavy'> = {
  leger: 'light', normal: 'normal', rapide: 'normal', familial: 'heavy',
}

const TIMEOUT_MS = 10_000

export async function POST(request: NextRequest) {
  const t_start = Date.now()

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY manquant dans .env.local' }, { status: 500 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile?.household_id) return Response.json({ error: 'No household' }, { status: 400 })

  const householdId = profile.household_id as string
  const body = await request.json()
  const mode: RecipeMode = body.mode ?? 'normal'
  const noCache: boolean = body.noCache === true
  console.log(`[recettes] ── REQUÊTE ── MODE="${mode}" noCache=${noCache}`)

  // DB en parallèle
  const t_db = Date.now()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [{ data: inventoryData }, { data: prefsData }, { data: mealsData }, { data: membersData }, { data: memberPrefsData }] = await Promise.all([
    supabase
      .from('inventory_items')
      .select('canonical_name, name, quantity, unit, estimated_expiry_date')
      .eq('household_id', householdId)
      .order('estimated_expiry_date', { ascending: true }),
    supabase
      .from('food_preferences')
      .select('type, value')
      .eq('household_id', householdId),
    supabase
      .from('meal_history')
      .select('name, heaviness')
      .eq('household_id', householdId)
      .gte('cooked_at', sevenDaysAgo.toISOString())
      .order('cooked_at', { ascending: false })
      .limit(3),
    supabase
      .from('food_members')
      .select('id, name, is_child')
      .eq('household_id', householdId)
      .order('created_at'),
    supabase
      .from('member_preferences')
      .select('food_member_id, category, preference')
      .eq('household_id', householdId),
  ])
  console.log(`[recettes] DB: ${Date.now() - t_db}ms`)

  const inventory = (inventoryData ?? []) as InventoryRow[]
  if (inventory.length === 0) return Response.json({ error: 'empty_inventory' }, { status: 400 })

  const excludes = (prefsData ?? []).filter((p) => p.type === 'exclude').map((p) => p.value as string)
  const recentMeals = (mealsData ?? []).map((m) => m.name as string)
  const lastHeaviness = (mealsData ?? [])[0]?.heaviness as string ?? ''
  const members = (membersData ?? []) as FoodMemberRow[]
  const memberPrefs = (memberPrefsData ?? []) as MemberPrefRow[]
  const prefsFp = prefsFingerprint(memberPrefs)
  console.log(`[recettes] lastHeaviness="${lastHeaviness || 'aucun'}" | recentMeals=${JSON.stringify(recentMeals)} | membres=${members.length} | prefs=${memberPrefs.length}`)

  // Cache check
  const key = cacheKey(householdId, mode, inventory, recentMeals[0] ?? '', lastHeaviness, prefsFp)
  console.log(`[recettes] cacheKey: ${key}`)

  if (!noCache) {
    const cached = getCached(key)
    if (cached) {
      console.log(`[recettes] cache HIT — total: ${Date.now() - t_start}ms`)
      return Response.json({ recipes: cached, mode, heaviness: MODE_HEAVINESS[mode], cached: true })
    }
  }
  console.log(`[recettes] cache MISS${noCache ? ' (bypass forcé)' : ''}`)

  // Construction du prompt
  const t_prompt = Date.now()
  const selected = selectTopIngredients(inventory)
  const inventoryText = buildInventoryText(selected)
  const excludeText = excludes.length > 0 ? excludes.join(',') : 'aucun'
  const recentText = recentMeals.length > 0 ? recentMeals.join(',') : 'aucun'

  const prefsText = buildPreferencesText(members, memberPrefs)

  const prompt = `Stock (!Nj=périme dans N jours):
${inventoryText}

Mode: ${MODE_PROMPT[mode]}
Exclure: ${excludeText} | Éviter (déjà cuisiné): ${recentText}
${prefsText ? '\n' + prefsText : ''}
3 recettes JSON DIFFÉRENTES adaptées strictement au mode et aux préférences. ≥60% du stock·!j priorité·max 3 manquants·pates=salé jamais sucré·canonical=singulier

{"recipes":[{"name":"...","duration_minutes":20,"persons":2,"steps":["..."],"ingredients":[{"name":"Courgettes","canonical_name":"courgette","quantity":2,"unit":"unité(s)"}]}]}`

  console.log(`[recettes] prompt: ${Date.now() - t_prompt}ms — ${prompt.length} chars — ${selected.length} ingrédients`)
  console.log(`[recettes] prompt MODE block: "${MODE_PROMPT[mode]}"`)


  // Appel Gemini — thinking désactivé, timeout 10s
  const model = ai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 2500,
      thinkingConfig: { thinkingBudget: 0 },
    } as never,
  })

  const t_ai = Date.now()
  let result
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: réponse IA > 10s')), TIMEOUT_MS)
    )
    result = await Promise.race([model.generateContent(prompt), timeoutPromise])
    console.log(`[recettes] Gemini: ${Date.now() - t_ai}ms`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[recettes] Gemini error après ${Date.now() - t_ai}ms:`, msg)
    const isQuota = msg.includes('429') || msg.includes('quota')
    return Response.json({
      error: isQuota
        ? 'Quota Gemini dépassé. Active la facturation sur aistudio.google.com.'
        : `Erreur IA : ${msg}`,
    }, { status: 500 })
  }

  const aiText = result.response.text()
  let aiResponse: { recipes: AiRecipe[] }
  try {
    aiResponse = JSON.parse(aiText)
  } catch {
    console.error('[recettes] JSON parse error, raw response:', aiText?.slice(0, 500))
    return Response.json({ error: 'AI parse error', raw: aiText }, { status: 500 })
  }

  // Enrichissement côté serveur
  const expiringSet = new Set(
    inventory
      .filter((item) => daysUntilExpiry(item.estimated_expiry_date) <= 3)
      .map((item) => item.canonical_name)
  )

  const recipes: Recipe[] = aiResponse.recipes.map((recipe) => {
    const ingredients: RecipeIngredient[] = recipe.ingredients.map((ing) => ({
      ...ing,
      available: matchIngredient(ing.canonical_name, inventory),
    }))
    const available = ingredients.filter((i) => i.available).length
    const coverage_pct = ingredients.length > 0 ? Math.round((available / ingredients.length) * 100) : 0
    const expiringUsed = ingredients
      .filter((i) => i.available)
      .map((i) => toCanonicalName(i.canonical_name))
      .filter((c) => isExpiringIngredient(c, expiringSet))

    return { ...recipe, ingredients, coverage_pct, anti_gaspillage: expiringUsed.length > 0, expiring_items: expiringUsed }
  })

  if (!noCache) setCached(key, recipes)
  console.log(`[recettes] total: ${Date.now() - t_start}ms | recipes: ${recipes.map(r => r.name).join(' / ')}`)
  return Response.json({ recipes, mode, heaviness: MODE_HEAVINESS[mode] })
}
