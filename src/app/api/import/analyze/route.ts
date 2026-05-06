import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { parseProductList } from '@/lib/parse-product-list'
import { checkUsage, logUsage, rateLimitMessage, type AiAction } from '@/lib/ai-rate-limit'

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Prompt for TEXT input: quantities are pre-parsed, Gemini only enriches
const ENRICH_PROMPT = `Tu es un assistant qui enrichit une liste de produits alimentaires déjà parsée.

Pour chaque entrée tu reçois : rawName (texte brut), quantity (quantité déjà extraite), unit (unité déjà extraite).
Tu dois retourner un JSON enrichi avec :
- name: string — nom d'affichage propre en français, singulier, sans marque (ex: "Pâtes", "Yaourt nature")
- canonical_name: string — nom racine singulier strict, en minuscules, sans adjectif ni marque (ex: "pate", "yaourt", "lait")
- quantity: number — REPRENDS EXACTEMENT la valeur fournie dans "quantity", ne la modifie jamais
- unit: string — REPRENDS EXACTEMENT la valeur fournie dans "unit", ne la modifie jamais
- storage_location: "fridge" | "pantry" | "freezer" — emplacement probable
- estimated_expiry_days: number — durée de conservation estimée en jours

RÈGLE ABSOLUE : quantity et unit sont définitifs. Ne les modifie sous aucun prétexte.

Retourne UNIQUEMENT un JSON valide de la forme :
{ "items": [ { "name": "Pâtes", "canonical_name": "pate", "quantity": 500, "unit": "g", "storage_location": "pantry", "estimated_expiry_days": 730 }, ... ] }

Ne retourne rien d'autre que ce JSON.`

// Prompt for PDF input: ignore prices/totals, extract food items only
const PDF_PROMPT = `Tu es un assistant qui extrait une liste de produits alimentaires à partir d'un document PDF (liste de courses, commande en ligne, ticket de caisse).

Pour chaque produit alimentaire détecté, retourne :
- name: string — nom d'affichage propre en français, singulier, sans marque
- canonical_name: string — nom racine singulier strict, en minuscules, sans adjectif (ex: "pate", "yaourt", "lait")
- quantity: number — nombre d'unités commandées/achetées
- unit: string — parmi : "g", "kg", "ml", "cl", "l", "unité(s)", "tranche(s)", "portion(s)", "boîte(s)", "sachet(s)", "bouteille(s)"
- storage_location: "fridge" | "pantry" | "freezer"
- estimated_expiry_days: number

RÈGLES IMPORTANTES :
- Ignore complètement : prix unitaires, remises, promotions, totaux, TVA, codes-barres, références produits, frais de livraison
- Extrait UNIQUEMENT les produits alimentaires
- La quantité est le nombre d'articles commandés, pas le poids contenu dans l'emballage
- "Yaourts nature x4" → quantity: 4, unit: "unité(s)"

Retourne UNIQUEMENT un JSON valide de la forme :
{ "items": [ { "name": "Pâtes", "canonical_name": "pate", "quantity": 1, "unit": "sachet(s)", "storage_location": "pantry", "estimated_expiry_days": 730 }, ... ] }

Ne retourne rien d'autre que ce JSON.`

// Prompt for PHOTO input: Gemini extracts everything from the image
const PHOTO_PROMPT = `Tu es un assistant qui extrait une liste de produits alimentaires à partir d'une image (photo de frigo, placard, courses, ou ticket de caisse).

Pour chaque produit visible, retourne :
- name: string — nom d'affichage propre en français, singulier, sans marque
- canonical_name: string — nom racine singulier strict, en minuscules, sans adjectif (ex: "courgette", "lait", "yaourt")
- quantity: number — quantité estimée visible ; si impossible à déterminer, utilise 1
- unit: string — parmi : "g", "kg", "ml", "cl", "l", "unité(s)", "tranche(s)", "portion(s)", "boîte(s)", "sachet(s)", "bouteille(s)"
- storage_location: "fridge" | "pantry" | "freezer"
- estimated_expiry_days: number

Liste tous les produits visibles, même partiellement. Ne cherche pas la perfection sur les quantités.

Retourne UNIQUEMENT un JSON valide de la forme :
{ "items": [ { "name": "Courgette", "canonical_name": "courgette", "quantity": 1, "unit": "unité(s)", "storage_location": "fridge", "estimated_expiry_days": 7 }, ... ] }

Ne retourne rien d'autre que ce JSON.`

type ImportedItem = {
  name: string
  canonical_name: string
  quantity: number
  unit: string
  storage_location: 'fridge' | 'pantry' | 'freezer'
  estimated_expiry_days: number
}

export async function POST(request: NextRequest) {
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

  if (!profile?.household_id) {
    return Response.json({ error: 'No household' }, { status: 400 })
  }

  const body = await request.json()
  const rawText: string = body.text ?? ''
  const image: string | undefined = body.image
  const mimeType: string = body.mimeType ?? 'image/jpeg'
  const locationHint: string = body.locationHint ?? 'mixed'

  if (!rawText.trim() && !image) {
    return Response.json({ error: 'Empty input' }, { status: 400 })
  }

  const action: AiAction = image
    ? mimeType === 'application/pdf' ? 'pdf_import' : 'photo_import'
    : 'text_import'

  const rateCheck = await checkUsage(supabase, user.id, action)
  if (!rateCheck.allowed) {
    return Response.json({ error: rateLimitMessage(rateCheck) }, { status: 429 })
  }

  const locationNote = locationHint !== 'mixed'
    ? `\n\nEmplacement par défaut pour tous les produits : "${locationHint}". Utilise cet emplacement pour tous les produits détectés.`
    : ''

  const model = ai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  })

  let result
  try {
    if (image) {
      // Photo or PDF: full extraction by Gemini (choose prompt based on mimeType)
      const mediaPrompt = mimeType === 'application/pdf' ? PDF_PROMPT : PHOTO_PROMPT
      result = await model.generateContent([
        mediaPrompt + locationNote,
        { inlineData: { mimeType, data: image } },
      ])
    } else {
      // Text: pre-parse quantities, then enrich with Gemini
      const parsed = parseProductList(rawText)
      if (parsed.length === 0) {
        return Response.json({ error: 'Aucun produit détecté dans le texte.' }, { status: 400 })
      }
      const inputJson = JSON.stringify(parsed.map((p) => ({
        rawName: p.rawName,
        quantity: p.quantity,
        unit: p.unit,
      })))
      result = await model.generateContent([ENRICH_PROMPT + locationNote, inputJson])
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isQuota = msg.includes('429') || msg.includes('quota')
    return Response.json({
      error: isQuota
        ? 'Quota Gemini dépassé. Réessaie dans quelques minutes ou active la facturation sur aistudio.google.com.'
        : `Erreur IA : ${msg}`,
    }, { status: 500 })
  }

  const aiText = result.response.text()
  let aiResponse: { items: ImportedItem[] }
  try {
    aiResponse = JSON.parse(aiText)
  } catch {
    return Response.json({ error: 'AI parse error', raw: aiText }, { status: 500 })
  }

  await logUsage(supabase, user.id, action)

  const { data: importRecord, error: dbError } = await supabase
    .from('imports')
    .insert({
      household_id: profile.household_id,
      source: image ? 'photo' : 'paste',
      raw_text: image ? '[photo import]' : rawText,
      ai_response: aiResponse,
      status: 'analyzed',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (dbError) {
    return Response.json({ error: dbError.message }, { status: 500 })
  }

  return Response.json({ importId: importRecord.id, items: aiResponse.items })
}
