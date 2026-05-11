import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { toCanonicalName } from '@/lib/canonical'
import { daysUntilExpiry } from '@/lib/expiry'
import { CATEGORY_LABEL, FOOD_CATEGORIES, type FoodCategoryId } from '@/lib/food-categories'
import { cuisineStylesPromptLine } from '@/lib/cuisine-styles'
import { getTemplatesForContext, buildTemplatesBlock } from '@/lib/dish-templates'
import { checkUsage, logUsage, rateLimitMessage } from '@/lib/ai-rate-limit'

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export type RecipeMode = 'normal' | 'rapide' | 'leger'
export type MealMoment = 'petit-dej' | 'dejeuner' | 'gouter' | 'diner'
export type MealType = 'sale' | 'sucre'

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

// Build a global aggregated exclusion list (union of all members' disliked + forbidden)
function buildPreferencesText(members: FoodMemberRow[], memberPrefs: MemberPrefRow[]): string {
  if (members.length === 0) return ''
  const excluded = new Set<string>()
  for (const p of memberPrefs) {
    if (p.preference === 'liked') continue
    excluded.add(CATEGORY_LABEL[p.category] ?? p.category)
  }
  if (excluded.size === 0) return ''
  return [
    `EXCLUSIONS STRICTES (allergies + refus + non-aimés) : ${[...excluded].join(', ')}`,
    `N'inclus AUCUN de ces aliments ni ingrédients de ces catégories dans aucune des recettes.`,
  ].join('\n')
}

// ── Post-generation filter ─────────────────────────────────────────────
// Strip accents + trailing 's' for fuzzy matching
function normalizeWord(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/s$/, '').trim()
}

// Free-text exclusions (not category IDs) — used for hard post-filter
const CATEGORY_ID_SET = new Set<FoodCategoryId>(FOOD_CATEGORIES.map((c) => c.id))

function isFoodCategoryId(value: string): value is FoodCategoryId {
  return CATEGORY_ID_SET.has(value as FoodCategoryId)
}

function buildExclusionRoots(memberPrefs: MemberPrefRow[]): string[] {
  return [...new Set(
    memberPrefs
      .filter((p) => p.preference !== 'liked' && !isFoodCategoryId(p.category))
      .map((p) => normalizeWord(p.category))
      .filter((w) => w.length >= 2),
  )]
}

function recipeContainsExclusion(recipe: Recipe, exclusionRoots: string[]): boolean {
  if (exclusionRoots.length === 0) return false
  return recipe.ingredients.some((ing) => {
    const words = [
      ...ing.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\W+/),
      ...ing.canonical_name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\W+/),
    ].map((w) => w.replace(/s$/, ''))
    return exclusionRoots.some((exc) => words.includes(exc))
  })
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

function buildMealContextBlock(moment: MealMoment, type: MealType): string {
  const RULES: Record<MealMoment, Record<MealType, string>> = {
    'petit-dej': {
      sale:  'PETIT-DÉJEUNER SALÉ → œufs brouillés, omelette, toast salé, avocado toast. JAMAIS gâteaux, crêpes sucrées, yaourts sucrés.',
      sucre: 'PETIT-DÉJEUNER SUCRÉ → pancakes, crêpes, pain perdu, porridge, smoothie bowl, céréales. JAMAIS plats salés.',
    },
    dejeuner: {
      sale:  'DÉJEUNER SALÉ → plat principal complet et nourrissant : viande ou poisson + légumes + féculents. JAMAIS desserts, plats sucrés.',
      sucre: 'DÉJEUNER SUCRÉ → dessert ou plat sucré pour le midi : tarte, gâteau, crêpes. JAMAIS plats salés principaux.',
    },
    gouter: {
      sale:  'GOÛTER SALÉ → petite portion légère : toast, dips, fromage, œufs durs. JAMAIS plats complets, desserts sucrés.',
      sucre: 'GOÛTER SUCRÉ → petite douceur sucrée : gâteau, cookies, compote, fruits cuits, yaourt. JAMAIS plats principaux salés.',
    },
    diner: {
      sale:  'DÎNER SALÉ → plat principal du soir : repas chaud équilibré, viande/poisson/œufs + légumes. JAMAIS desserts, crêpes sucrées.',
      sucre: 'DÎNER SUCRÉ → repas du soir sucré : crêpes sucrées, pain perdu, dessert copieux. JAMAIS plats salés principaux.',
    },
  }
  return RULES[moment][type]
}

function cacheKey(householdId: string, mode: RecipeMode, moment: MealMoment, type: MealType, inventory: InventoryRow[], lastMeal: string, lastHeaviness: string, prefsFp: string, selectedFp: string, stylesFp: string): string {
  const fingerprint = inventory.slice(0, 15).map((i) => i.canonical_name).sort().join(',')
  return `${householdId}:${mode}:${moment}:${type}:${fingerprint}:${lastMeal}:${lastHeaviness}:${prefsFp.slice(0, 40)}:${selectedFp}:${stylesFp}`
}

// ── Pantry basics — always considered available, never counted as missing ─
const PANTRY_BASICS = new Set([
  'sel', 'poivre', 'eau', 'huile', 'ail', 'oignon', 'echalote',
  'herbe', 'epice', 'thym', 'laurier', 'persil', 'paprika',
  'cumin', 'curry', 'curcuma', 'cannelle', 'bouillon',
])

function isPantryBasic(ingredientCanonical: string): boolean {
  const canonical = toCanonicalName(ingredientCanonical)
  return canonical.split(' ').some((w) => PANTRY_BASICS.has(w))
}

// ── Qualificatifs stricts ─────────────────────────────────────────────
// Un produit transformé ne doit pas satisfaire une demande générique
// Ex : "poulet pané" (stock) ≠ "poulet" (recette)
const STRICT_QUALIFIERS = new Set([
  'pane', 'fume', 'seche', 'marine', 'confit', 'grille',
  'concasse', 'concentre', 'coulis', 'rape',
  'feuillete', 'brise', 'cerise', 'cru',
])

function hasStrictQualifier(canonical: string): boolean {
  return canonical.split(' ').some((w) => STRICT_QUALIFIERS.has(w))
}

// ── Matching ──────────────────────────────────────────────────────────
function matchIngredient(ingredientCanonical: string, inventory: InventoryRow[]): boolean {
  const canonical = toCanonicalName(ingredientCanonical)
  return inventory.some((item) => {
    const itemCanonical = toCanonicalName(item.canonical_name)

    // Règle 1 — correspondance exacte (prioritaire, insensible aux accents)
    if (itemCanonical === canonical) return true

    const iWords = canonical.split(' ')
    const invWords = itemCanonical.split(' ')

    // Règle 2 — l'ingrédient recette est 1 mot, contenu dans les mots du stock
    // Bloqué si le stock contient un qualificatif strict (ex: "pané", "fumé", "cerise")
    if (iWords.length === 1 && invWords.includes(iWords[0]) && !hasStrictQualifier(itemCanonical)) return true

    // Règle 3 — le stock est 1 mot, contenu dans les mots de l'ingrédient recette
    if (invWords.length === 1 && iWords.includes(invWords[0])) return true

    return false
  })
}

// ── Scoring ───────────────────────────────────────────────────────────
// Racines structurantes (1 mot) : leur absence est rédhibitoire
const STRUCTURING_WORDS = new Set([
  'poulet', 'boeuf', 'porc', 'agneau', 'veau', 'dinde',
  'saumon', 'thon', 'cabillaud', 'crevette', 'merlu',
  'oeuf', 'tofu', 'seitan',
  'lentille', 'haricot',
  'pate', 'riz', 'semoule', 'quinoa', 'boulghour',
  'tomate', 'courgette', 'aubergine', 'carotte', 'poireau',
  'epinard', 'champignon', 'poivron', 'brocoli', 'chou',
])

// Racines multi-mots — vérifiées par inclusion exacte dans le canonical
const STRUCTURING_PHRASES = ['pomme de terre', 'pois chiche']

function isStructuring(canonical: string): boolean {
  if (STRUCTURING_PHRASES.some((p) => canonical.includes(p))) return true
  return canonical.split(' ').some((w) => STRUCTURING_WORDS.has(w))
}

const STYLE_SCORE_KEYWORDS: Record<string, string[]> = {
  wok:           ['wok', 'saute', 'poele'],
  asiatique:     ['asiatique', 'japonais', 'chinois', 'thai', 'wok', 'saute', 'riz saute', 'nouilles', 'soja', 'gingembre', 'sesame', 'bol de riz'],
  curry:         ['curry', 'massaman', 'tikka', 'korma'],
  bowl:          ['bowl', 'bol', 'salade'],
  salade:        ['salade', 'bowl', 'bol'],
  soupe:         ['soupe', 'veloute', 'potage'],
  risotto:       ['risotto'],
  mediterraneen: ['provencal', 'ratatouille'],
  gratin:        ['gratin', 'dauphinois'],
  pates:         ['pates', 'carbonara', 'bolognese'],
  pizza:         ['pizza', 'tarte'],
  burger:        ['burger'],
  traditionnel:  ['bourguignon', 'blanquette', 'cassoulet'],
  proteine:      [],
  enfant:        [],
}

function normalizeRecipeName(name: string): string {
  return name
    .replace(/[œŒ]/g, 'oe').replace(/[æÆ]/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function scoreRecipe(recipe: Recipe, cuisineStyleIds: string[]): number {
  const nameLower = normalizeRecipeName(recipe.name)
  const styleBonus = cuisineStyleIds.reduce((acc, styleId) => {
    const keywords = STYLE_SCORE_KEYWORDS[styleId] ?? []
    return acc + (keywords.some((kw) => nameLower.includes(kw)) ? 15 : 0)
  }, 0)
  const missingStructuring = recipe.ingredients.filter((i) => !i.available && isStructuring(i.canonical_name)).length
  const missingOther = recipe.ingredients.filter((i) => !i.available && !isStructuring(i.canonical_name)).length
  return recipe.coverage_pct - missingStructuring * 35 - missingOther * 8 + (recipe.anti_gaspillage ? 10 : 0) + Math.min(styleBonus, 20)
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
  normal: 'Recettes familiales sans limite de temps : plats mijotés, gratins, tartes salées, risottos bienvenus. Peut demander plus de préparation.',
  rapide: '10 à 25 min, ≤5 étapes. JAMAIS four, mijoter, ou cuisson longue. Types imposés: omelette, poêlée, pâtes-express, wrap, sauté rapide. duration_minutes ≤25.',
  leger:  '<500 kcal par portion. JAMAIS pâtes en plat principal, crème fraîche, gratin, fromage fondu en grande quantité. Imposer: légumes, œufs, poisson, salade composée, soupe légère.',
}

const MODE_HEAVINESS: Record<RecipeMode, 'light' | 'normal' | 'heavy'> = {
  leger: 'light', normal: 'normal', rapide: 'normal',
}

function buildModeBlock(mode: RecipeMode, personCount: number, hasChild: boolean, cuisineStyleIds: string[]): string {
  let modeDesc = MODE_PROMPT[mode]
  if (mode === 'normal' && cuisineStyleIds.some((s) => ['wok', 'asiatique', 'salade', 'bowl'].includes(s))) {
    modeDesc = modeDesc
      .replace(/gratins?,\s*/gi, '')
      .replace(/tartes? salées?,\s*/gi, '')
  }
  const childNote = hasChild
    ? ' ENFANTS présents : recettes rassurantes et simples (pas épicé, pas amer, pas trop original), goûts doux, présentation simple.'
    : ''
  return `${personCount} pers. ${modeDesc}${childNote}`
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
  const mealMoment: MealMoment = body.mealMoment ?? 'diner'
  const mealType: MealType = body.mealType ?? 'sale'
  const noCache: boolean = body.noCache === true
  const selectedMemberIds: string[] | undefined = body.selectedMemberIds
  console.log(`[recettes] ── REQUÊTE ── MODE="${mode}" moment="${mealMoment}" type="${mealType}" noCache=${noCache} selectedMembers=${selectedMemberIds?.length ?? 'all'}`)

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
  const cuisineStyleIds = (prefsData ?? []).filter((p) => p.type === 'cuisine_style').map((p) => p.value as string)
  const recentMeals = (mealsData ?? []).map((m) => m.name as string)
  const lastHeaviness = (mealsData ?? [])[0]?.heaviness as string ?? ''
  const allMembers = (membersData ?? []) as FoodMemberRow[]
  const allMemberPrefs = (memberPrefsData ?? []) as MemberPrefRow[]

  const members = selectedMemberIds && selectedMemberIds.length > 0
    ? allMembers.filter((m) => selectedMemberIds.includes(m.id))
    : allMembers
  const memberPrefs = selectedMemberIds && selectedMemberIds.length > 0
    ? allMemberPrefs.filter((p) => selectedMemberIds.includes(p.food_member_id))
    : allMemberPrefs

  const prefsFp = prefsFingerprint(memberPrefs)
  const selectedFp = selectedMemberIds && selectedMemberIds.length > 0
    ? [...selectedMemberIds].sort().join(',')
    : 'all'
  const stylesFp = [...cuisineStyleIds].sort().join(',')
  console.log(`[recettes] lastHeaviness="${lastHeaviness || 'aucun'}" | recentMeals=${JSON.stringify(recentMeals)} | membres=${members.length}/${allMembers.length} | prefs=${memberPrefs.length}`)

  // Cache check
  const key = cacheKey(householdId, mode, mealMoment, mealType, inventory, recentMeals[0] ?? '', lastHeaviness, prefsFp, selectedFp, stylesFp)
  console.log(`[recettes] cacheKey: ${key}`)

  if (!noCache) {
    const cached = getCached(key)
    if (cached) {
      console.log(`[recettes] cache HIT — total: ${Date.now() - t_start}ms`)
      return Response.json({ recipes: cached, mode, heaviness: MODE_HEAVINESS[mode], cached: true })
    }
  }
  console.log(`[recettes] cache MISS${noCache ? ' (bypass forcé)' : ''}`)

  const rateCheck = await checkUsage(supabase, user.id, 'recipe_generation')
  if (!rateCheck.allowed) {
    return Response.json({ error: rateLimitMessage(rateCheck) }, { status: 429 })
  }

  // Construction du prompt
  const t_prompt = Date.now()
  const selected = selectTopIngredients(inventory)
  const inventoryText = buildInventoryText(selected)
  const excludeText = excludes.length > 0 ? excludes.join(',') : 'aucun'
  const recentText = recentMeals.length > 0 ? recentMeals.join(',') : 'aucun'

  const personCount = members.length > 0 ? members.length : 2
  const hasChild = members.some((m) => m.is_child)
  const modeBlock = buildModeBlock(mode, personCount, hasChild, cuisineStyleIds)

  const prefsText = buildPreferencesText(members, memberPrefs)

  const mealContextBlock = buildMealContextBlock(mealMoment, mealType)
  const stylesLine = cuisineStylesPromptLine(cuisineStyleIds)
  const { mainTemplates, fallbackTemplates } = getTemplatesForContext({ mode, mealMoment, cuisineStyleIds })
  const templatesBlock = buildTemplatesBlock(mainTemplates, fallbackTemplates)

  const prompt = `Tu es un assistant culinaire pour une famille française. Génère 3 recettes FAMILIALES, CLASSIQUES et RÉALISTES.

RÈGLES ABSOLUES :
- Propose uniquement des plats qu'une famille cuisinerait en semaine : pâtes, riz, omelette, poêlée, soupe, gratin, curry doux, salade composée.
- Utilise les ingrédients du stock SEULEMENT s'ils s'intègrent naturellement dans un plat classique.
- N'invente PAS de combinaisons pour utiliser le stock. Il vaut mieux ignorer un ingrédient que forcer une association bizarre.
- N'associe JAMAIS fruits et viande sauf plat réellement classique (ex : canard à l'orange).
- Évite toute association sucrée/salée non conventionnelle.
- Les titres doivent être simples et appétissants : "Pâtes au thon", "Riz sauté au poulet", "Gratin de courgettes".
- Priorité aux ingrédients signalés !j (bientôt périmés) uniquement s'ils s'intègrent naturellement dans la recette.
- Chaque recette doit utiliser 2 à 4 ingrédients du stock. Vise ≥60 % d'ingrédients disponibles dans la recette.
- Les basiques de cuisine (sel, poivre, eau, huile, ail, oignon, herbes, épices courantes, bouillon) sont toujours disponibles et ne doivent pas compter comme ingrédients manquants structurants.
- Limite les ingrédients vraiment manquants (hors basiques) à 2 ou 3 maximum.
- Si ≥60 % est impossible sans forcer une association bizarre, une recette à 50 % est acceptable.

Stock disponible (!Nj = périme dans N jours) :
${inventoryText}

Mode: ${modeBlock}
Contexte repas: ${mealContextBlock}
${templatesBlock ? templatesBlock + '\n' : ''}${stylesLine ? stylesLine + '\n' : ''}Éviter (déjà cuisiné): ${recentText} | Exclure: ${excludeText}
${prefsText ? '\n' + prefsText : ''}
Génère 3 recettes JSON différentes, adaptées au contexte repas et au mode. Jusqu'à 3 ingrédients courants non listés acceptés. canonical_name=racine générique du composant en minuscules sans accent (ex: "poulet" non "poulet rôti", "riz" non "riz express") — sauf produit transformé qui est l'ingrédient réel de la recette (ex: "poulet pane", "saumon fume", "tomate concassee").

{"recipes":[{"name":"...","duration_minutes":20,"persons":2,"steps":["..."],"ingredients":[{"name":"Courgettes","canonical_name":"courgette","quantity":2,"unit":"unité(s)"}]}]}`

  console.log(`[recettes] prompt: ${Date.now() - t_prompt}ms — ${prompt.length} chars — ${selected.length} ingrédients`)
  console.log(`[recettes] modeBlock: "${modeBlock}"`)


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
      available: isPantryBasic(ing.canonical_name) || matchIngredient(ing.canonical_name, inventory),
    }))
    const available = ingredients.filter((i) => i.available).length
    const coverage_pct = ingredients.length > 0 ? Math.round((available / ingredients.length) * 100) : 0
    const expiringUsed = ingredients
      .filter((i) => i.available)
      .map((i) => toCanonicalName(i.canonical_name))
      .filter((c) => isExpiringIngredient(c, expiringSet))

    return { ...recipe, ingredients, coverage_pct, anti_gaspillage: expiringUsed.length > 0, expiring_items: expiringUsed }
  })

  // Post-filter: remove any recipe containing a free-text excluded ingredient
  const exclusionRoots = buildExclusionRoots(memberPrefs)
  const filteredRecipes = exclusionRoots.length > 0
    ? recipes.filter((r) => !recipeContainsExclusion(r, exclusionRoots))
    : recipes
  if (exclusionRoots.length > 0) {
    console.log(`[recettes] post-filter: ${recipes.length}→${filteredRecipes.length} recettes | exclusions: ${exclusionRoots.join(', ')}`)
  }

  // Tri par pertinence : coverage + malus structurants manquants + bonus anti-gaspi
  const finalRecipes = [...filteredRecipes].sort((a, b) => scoreRecipe(b, cuisineStyleIds) - scoreRecipe(a, cuisineStyleIds))
  console.log(`[recettes] scores: ${finalRecipes.map(r => `${r.name}(${scoreRecipe(r, cuisineStyleIds)})`).join(' / ')}`)

  await logUsage(supabase, user.id, 'recipe_generation')
  if (!noCache) setCached(key, finalRecipes)
  console.log(`[recettes] total: ${Date.now() - t_start}ms | recipes: ${finalRecipes.map(r => r.name).join(' / ')}`)
  return Response.json({ recipes: finalRecipes, mode, heaviness: MODE_HEAVINESS[mode] })
}
