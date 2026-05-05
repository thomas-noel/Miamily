import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SYSTEM_PROMPT = `Tu es un assistant qui extrait une liste de produits alimentaires à partir d'un texte de commande ou de courses.

Pour chaque produit détecté, retourne un objet JSON avec ces champs :
- name: string — nom d'affichage propre en français, singulier, sans marque ni qualificatif d'origine ou de qualité (ex: "Courgette", "Lait demi-écrémé", "Tomate cerise")
- canonical_name: string — nom racine singulier strict, uniquement le type d'aliment, en minuscules, sans aucun adjectif (ex: "courgette" pour "Courgettes bio", "lait" pour "Lait demi-écrémé Président", "tomate cerise" pour "Tomates cerises")
- quantity: number — quantité numérique (ex: 2)
- unit: string — unité parmi : "g", "kg", "ml", "cl", "l", "unité(s)", "tranche(s)", "portion(s)", "boîte(s)", "sachet(s)", "bouteille(s)"
- storage_location: "fridge" | "pantry" | "freezer" — emplacement probable
- estimated_expiry_days: number — durée de conservation estimée en jours

Règle importante sur canonical_name : "courgette", "courgettes", "courgette bio", "courgettes bio Label Rouge" doivent tous donner canonical_name = "courgette".

Retourne UNIQUEMENT un JSON valide de la forme :
{ "items": [ { "name": "Courgette", "canonical_name": "courgette", "quantity": 1, "unit": "unité(s)", "storage_location": "fridge", "estimated_expiry_days": 7 }, ... ] }

Ne retourne rien d'autre que ce JSON.`

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
  if (!rawText.trim()) {
    return Response.json({ error: 'Empty text' }, { status: 400 })
  }

  const model = ai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  })

  let result
  try {
    result = await model.generateContent([SYSTEM_PROMPT, rawText])
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

  const { data: importRecord, error: dbError } = await supabase
    .from('imports')
    .insert({
      household_id: profile.household_id,
      source: 'paste',
      raw_text: rawText,
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

type ImportedItem = {
  name: string
  canonical_name: string
  quantity: number
  unit: string
  storage_location: 'fridge' | 'pantry' | 'freezer'
  estimated_expiry_days: number
}
