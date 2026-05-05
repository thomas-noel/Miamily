'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Check, Trash2, Camera, Mic, MicOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type StorageLocation = 'fridge' | 'pantry' | 'freezer'
type LocationHint = StorageLocation | 'mixed'

type Item = {
  name: string
  canonical_name?: string
  quantity: number
  unit: string
  storage_location: StorageLocation
  estimated_expiry_days: number
}

const UNITS = ['unité(s)', 'g', 'kg', 'ml', 'cl', 'l', 'tranche(s)', 'portion(s)', 'boîte(s)', 'sachet(s)', 'bouteille(s)']

const LOCATION_OPTIONS: { key: LocationHint; label: string; emoji: string }[] = [
  { key: 'fridge',  label: 'Frigo',   emoji: '🧊' },
  { key: 'pantry',  label: 'Placard', emoji: '🗄️' },
  { key: 'freezer', label: 'Congélo', emoji: '❄️' },
  { key: 'mixed',   label: 'Auto',    emoji: '🤖' },
]

const STORAGE_EMOJI: Record<StorageLocation, string> = {
  fridge: '🧊', pantry: '🗄️', freezer: '❄️',
}

type Step = 'input' | 'loading' | 'review' | 'confirming' | 'done'

function expiryLabel(days: number): string {
  if (days <= 0) return '?'
  if (days <= 3) return `${days}j`
  if (days <= 13) return `${Math.round(days / 7)}sem`
  return `${Math.round(days / 30)}mois`
}

export default function ImporterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [text, setText] = useState('')
  const [locationHint, setLocationHint] = useState<LocationHint>('mixed')
  const [importId, setImportId] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [upserted, setUpserted] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [hasSpeech] = useState(() => {
    if (typeof window === 'undefined') return false
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  async function analyze(payload: { text?: string; image?: string; mimeType?: string }) {
    setStep('loading')
    setError(null)

    const res = await fetch('/api/import/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, locationHint }),
    })

    let data: { error?: string; importId?: string; items?: Item[] }
    try { data = await res.json() }
    catch {
      setError('Erreur serveur inattendue')
      setStep('input')
      return
    }

    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'analyse")
      setStep('input')
      return
    }

    let parsed = data.items ?? []
    // If user chose a specific location, apply it to all items
    if (locationHint !== 'mixed') {
      parsed = parsed.map((i) => ({ ...i, storage_location: locationHint as StorageLocation }))
    }

    setImportId(data.importId ?? '')
    setItems(parsed)
    setStep('review')
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      const mimeType = dataUrl.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
      analyze({ image: base64, mimeType })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function toggleVoice() {
    if (!hasSpeech) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const recognition = new SR()
    recognition.lang = 'fr-FR'
    recognition.continuous = false
    recognition.interimResults = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript
      setText((prev) => prev ? `${prev}\n${transcript}` : transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.start()
    recognitionRef.current = recognition
    setListening(true)
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
    try { data = await res.json() }
    catch {
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
      setError(`${data.errors.length} produit(s) non ajoutés : ${data.errors.join(' | ')}`)
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
        <p className="text-muted-foreground">
          {upserted} ligne{upserted > 1 ? 's' : ''} mise{upserted > 1 ? 's' : ''} à jour dans votre stock.
        </p>
        <Button onClick={() => router.push('/inventaire')} className="mt-2">Voir le stock</Button>
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
        <h1 className="text-xl font-semibold">
          {step === 'review' || step === 'confirming' ? 'Vérifier les produits' : 'Ajouter au stock'}
        </h1>
      </div>

      {/* Input step */}
      {(step === 'input' || step === 'loading') && (
        <div className="px-4 space-y-4 pb-6">
          {/* Location hint */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Où ajouter ces produits ?
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {LOCATION_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setLocationHint(opt.key)}
                  disabled={step === 'loading'}
                  className={`rounded-xl py-2 text-xs font-medium transition-colors flex flex-col items-center gap-0.5 border ${
                    locationHint === opt.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  <span className="text-base">{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea + actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Liste de produits
              </p>
              <div className="flex gap-1.5">
                {hasSpeech && (
                  <button
                    type="button"
                    onClick={toggleVoice}
                    disabled={step === 'loading'}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      listening
                        ? 'border-red-300 bg-red-50 text-red-600'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {listening ? 'Arrêter' : 'Dicter'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={step === 'loading'}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
            </div>
            <textarea
              className="w-full min-h-[180px] rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              placeholder={"6 œufs\n500g pâtes\n2 courgettes\n1 fromage râpé\n4 yaourts\n1 boîte thon\n1 bouteille lait"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={step === 'loading'}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button
            className="w-full"
            onClick={() => analyze({ text })}
            disabled={step === 'loading' || !text.trim()}
          >
            {step === 'loading' ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyse en cours…</>
            ) : (
              "Analyser avec l'IA"
            )}
          </Button>
        </div>
      )}

      {/* Review step */}
      {(step === 'review' || step === 'confirming') && (
        <div className="px-4 space-y-2.5 pb-6">
          <p className="text-sm text-muted-foreground">
            {items.length} produit{items.length > 1 ? 's' : ''} détecté{items.length > 1 ? 's' : ''}.
            Modifie ou supprime avant de confirmer.
          </p>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {items.map((item, idx) => (
            <CompactItemRow
              key={idx}
              item={item}
              onUpdate={(patch) => updateItem(idx, patch)}
              onRemove={() => removeItem(idx)}
              disabled={step === 'confirming'}
            />
          ))}

          <div className="pt-2 space-y-2">
            <Button
              className="w-full"
              onClick={handleConfirm}
              disabled={step === 'confirming' || items.length === 0}
            >
              {step === 'confirming' ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ajout en cours…</>
              ) : (
                `Tout valider — ${items.length} produit${items.length > 1 ? 's' : ''}`
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

type ItemRowProps = {
  item: Item
  onUpdate: (patch: Partial<Item>) => void
  onRemove: () => void
  disabled: boolean
}

function CompactItemRow({ item, onUpdate, onRemove, disabled }: ItemRowProps) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 space-y-2">
      {/* Row 1: name + expiry badge + delete */}
      <div className="flex items-center gap-2">
        <Input
          value={item.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 h-8 text-sm font-medium px-2"
          placeholder="Nom"
          disabled={disabled}
        />
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          ~{expiryLabel(item.estimated_expiry_days)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {/* Row 2: qty + unit + storage emoji buttons */}
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min="0"
          step="0.1"
          value={item.quantity}
          onChange={(e) => onUpdate({ quantity: parseFloat(e.target.value) || 1 })}
          inputMode="decimal"
          className="w-16 h-8 text-sm px-2 shrink-0"
          disabled={disabled}
        />
        <Select
          value={item.unit}
          onValueChange={(v) => { if (v) onUpdate({ unit: v }) }}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-sm flex-1 min-w-0">
            <SelectValue>{item.unit}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1 shrink-0">
          {(['fridge', 'pantry', 'freezer'] as StorageLocation[]).map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => onUpdate({ storage_location: loc })}
              disabled={disabled}
              title={loc === 'fridge' ? 'Frigo' : loc === 'pantry' ? 'Placard' : 'Congélo'}
              className={`w-8 h-8 rounded-lg border text-sm flex items-center justify-center transition-colors ${
                item.storage_location === loc
                  ? 'border-primary bg-primary/10'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {STORAGE_EMOJI[loc]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
