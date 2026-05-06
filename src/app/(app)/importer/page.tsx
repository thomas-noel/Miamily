'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, Check, Trash2,
  Mic, MicOff, Camera, FileText, ClipboardList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type StorageLocation = 'fridge' | 'pantry' | 'freezer'
type LocationHint = StorageLocation | 'mixed'
type InputMode = 'text' | 'voice' | 'photo' | 'pdf'

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

const INPUT_MODES: { key: InputMode; icon: React.ElementType; label: string }[] = [
  { key: 'text',  icon: ClipboardList, label: 'Texte' },
  { key: 'voice', icon: Mic,           label: 'Vocal' },
  { key: 'photo', icon: Camera,        label: 'Photo' },
  { key: 'pdf',   icon: FileText,      label: 'PDF' },
]

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
  const [inputMode, setInputMode] = useState<InputMode>('text')
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
  const photoRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)
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
    if (locationHint !== 'mixed') {
      parsed = parsed.map((i) => ({ ...i, storage_location: locationHint as StorageLocation }))
    }

    setImportId(data.importId ?? '')
    setItems(parsed)
    setStep('review')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, forceMime?: string) {
    const file = e.target.files?.[0]
    if (!file) return

    const isPdf = forceMime === 'application/pdf'
    const maxBytes = isPdf ? 10 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxBytes) {
      setError(`Fichier trop volumineux (max ${isPdf ? '10 Mo' : '5 Mo'}). Réduis la taille de l'image ou choisis un fichier plus petit.`)
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      const mimeType = forceMime ?? dataUrl.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
      analyze({ image: base64, mimeType })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function toggleVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return

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

  function resetInput() {
    setStep('input')
    setText('')
    setItems([])
    setUpserted(0)
    setError(null)
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
        <Button variant="outline" onClick={resetInput}>Nouvel import</Button>
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

          {/* Input mode selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Comment ajouter ?
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {INPUT_MODES.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setInputMode(key)}
                  disabled={step === 'loading'}
                  className={`rounded-xl py-2.5 text-xs font-medium transition-colors flex flex-col items-center gap-1 border ${
                    inputMode === key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode-specific input */}
          {inputMode === 'text' && (
            <div>
              <textarea
                className="w-full min-h-[180px] rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                placeholder={"6 œufs\n500g pâtes\n2 courgettes\n1 fromage râpé\n4 yaourts\n1 boîte thon\n1 bouteille lait"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={step === 'loading'}
              />
            </div>
          )}

          {inputMode === 'voice' && (
            <div className="space-y-3">
              {hasSpeech ? (
                <>
                  <div className="flex flex-col items-center gap-3 py-4">
                    <button
                      type="button"
                      onClick={toggleVoice}
                      disabled={step === 'loading'}
                      className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors shadow-md ${
                        listening
                          ? 'bg-destructive text-destructive-foreground animate-pulse'
                          : 'bg-primary text-primary-foreground'
                      }`}
                      aria-label={listening ? 'Arrêter la dictée' : 'Démarrer la dictée'}
                    >
                      {listening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                    </button>
                    <p className="text-sm text-muted-foreground text-center">
                      {listening ? 'Dictez votre liste…' : 'Appuyez pour dicter'}
                    </p>
                  </div>
                  {text && (
                    <textarea
                      className="w-full min-h-[100px] rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      disabled={step === 'loading'}
                    />
                  )}
                </>
              ) : (
                <div className="rounded-xl bg-muted px-4 py-6 text-center space-y-2">
                  <Mic className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    La dictée vocale nécessite Chrome sur Android ou un navigateur compatible.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Utilisez le mode Texte pour saisir manuellement.
                  </p>
                </div>
              )}
            </div>
          )}

          {inputMode === 'photo' && (
            <div>
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                disabled={step === 'loading'}
                className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors py-10 flex flex-col items-center gap-3 text-muted-foreground hover:text-foreground"
              >
                {step === 'loading'
                  ? <Loader2 className="w-8 h-8 animate-spin" />
                  : <Camera className="w-8 h-8" />
                }
                <span className="text-sm font-medium">
                  {step === 'loading' ? 'Analyse en cours…' : 'Prendre une photo ou choisir une image'}
                </span>
                <span className="text-xs">Frigo, placard, liste de courses…</span>
              </button>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e)}
              />
            </div>
          )}

          {inputMode === 'pdf' && (
            <div>
              <button
                type="button"
                onClick={() => pdfRef.current?.click()}
                disabled={step === 'loading'}
                className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors py-10 flex flex-col items-center gap-3 text-muted-foreground hover:text-foreground"
              >
                {step === 'loading'
                  ? <Loader2 className="w-8 h-8 animate-spin" />
                  : <FileText className="w-8 h-8" />
                }
                <span className="text-sm font-medium">
                  {step === 'loading' ? 'Analyse en cours…' : 'Choisir un PDF'}
                </span>
                <span className="text-xs">Commande Drive, ticket de caisse…</span>
              </button>
              <input
                ref={pdfRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFileChange(e, 'application/pdf')}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Analyze button — only for text and voice modes */}
          {(inputMode === 'text' || inputMode === 'voice') && (
            <Button
              className="w-full"
              onClick={() => analyze({ text })}
              disabled={step === 'loading' || !text.trim()}
            >
              {step === 'loading'
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyse en cours…</>
                : "Analyser avec l'IA"
              }
            </Button>
          )}
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
              {step === 'confirming'
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ajout en cours…</>
                : `Tout valider — ${items.length} produit${items.length > 1 ? 's' : ''}`
              }
            </Button>
            <Button variant="outline" className="w-full" onClick={resetInput} disabled={step === 'confirming'}>
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
