'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type StorageLocation = 'fridge' | 'pantry' | 'freezer'

type Item = {
  name: string
  canonical_name?: string
  quantity: number
  unit: string
  storage_location: StorageLocation
  estimated_expiry_days: number
}

const UNITS = ['g', 'kg', 'ml', 'cl', 'l', 'unité(s)', 'tranche(s)', 'portion(s)', 'boîte(s)', 'sachet(s)', 'bouteille(s)']

const STORAGE_LABELS: Record<StorageLocation, string> = {
  fridge: '🧊 Frigo',
  pantry: '🗄️ Placard',
  freezer: '❄️ Congélo',
}

type Step = 'input' | 'loading' | 'review' | 'confirming' | 'done'

export default function ImporterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [text, setText] = useState('')
  const [importId, setImportId] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [upserted, setUpserted] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function handleAnalyze() {
    if (!text.trim()) return
    setStep('loading')
    setError(null)

    const res = await fetch('/api/import/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    let data: { error?: string; importId?: string; items?: Item[] }
    try {
      data = await res.json()
    } catch {
      setError('Erreur serveur inattendue — vérifiez que GEMINI_API_KEY est définie dans .env.local')
      setStep('input')
      return
    }

    if (!res.ok) {
      setError(data.error ?? 'Erreur lors de l\'analyse')
      setStep('input')
      return
    }

    setImportId(data.importId ?? '')
    setItems(data.items ?? [])
    setStep('review')
  }

  async function handleConfirm() {
    setStep('confirming')
    setError(null)

    const res = await fetch('/api/import/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importId, items }),
    })

    let data: { error?: string; errors?: string[]; upserted?: number }
    try {
      data = await res.json()
    } catch {
      setError('Erreur serveur inattendue lors de la confirmation')
      setStep('review')
      return
    }

    if (!res.ok && res.status !== 207) {
      setError(data.error ?? 'Erreur lors de la confirmation')
      setStep('review')
      return
    }

    if (data.errors?.length) {
      setError(`${data.errors.length} produit(s) n'ont pas pu être ajoutés : ${data.errors.join(' | ')}`)
    }

    setUpserted(data.upserted ?? items.length)
    setStep('done')
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold">Produits ajoutés !</h2>
        <p className="text-muted-foreground">{upserted} ligne{upserted > 1 ? 's' : ''} mise{upserted > 1 ? 's' : ''} à jour dans votre stock.</p>
        <Button onClick={() => router.push('/inventaire')} className="mt-2">
          Voir le stock
        </Button>
        <Button variant="outline" onClick={() => { setStep('input'); setText(''); setItems([]); setUpserted(0) }}>
          Nouvel import
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full p-2 hover:bg-muted transition-colors"
          aria-label="Retour"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Importer une commande</h1>
      </div>

      {/* Étape 1 : saisie */}
      {(step === 'input' || step === 'loading') && (
        <div className="px-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Colle le texte de ta commande ou de ta liste de courses. L&apos;IA va détecter tous les produits.
          </p>
          <textarea
            className="w-full min-h-[200px] rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            placeholder={"Exemple :\n2 bouteilles de lait\n500g de tomates cerises\n1 poulet rôti\nSaumon fumé x3..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={step === 'loading'}
          />
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}
          <Button
            className="w-full"
            onClick={handleAnalyze}
            disabled={step === 'loading' || !text.trim()}
          >
            {step === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyse en cours…
              </>
            ) : (
              'Analyser avec l\'IA'
            )}
          </Button>
        </div>
      )}

      {/* Étape 2 : validation */}
      {(step === 'review' || step === 'confirming') && (
        <div className="px-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            {items.length} produit{items.length > 1 ? 's' : ''} détecté{items.length > 1 ? 's' : ''}. Modifie ou supprime avant de confirmer.
          </p>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="rounded-2xl border border-border bg-card px-4 py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={item.name}
                    onChange={(e) => updateItem(idx, { name: e.target.value })}
                    className="flex-1 font-medium"
                    placeholder="Nom du produit"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="shrink-0 p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 1 })}
                    inputMode="decimal"
                    placeholder="Qté"
                  />
                  <Select
                    value={item.unit}
                    onValueChange={(v) => { if (v !== null) updateItem(idx, { unit: v }) }}
                  >
                    <SelectTrigger>
                      <SelectValue>{item.unit}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(Object.entries(STORAGE_LABELS) as [StorageLocation, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateItem(idx, { storage_location: key })}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        item.storage_location === key
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="pb-6 pt-2 space-y-2">
            <Button
              className="w-full"
              onClick={handleConfirm}
              disabled={step === 'confirming' || items.length === 0}
            >
              {step === 'confirming' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ajout en cours…
                </>
              ) : (
                `Ajouter ${items.length} produit${items.length > 1 ? 's' : ''} au stock`
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setStep('input')}
              disabled={step === 'confirming'}
            >
              Recommencer
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
