'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Check, Trash2, Mic, MicOff, Camera, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BetaChip } from '@/components/ui/beta-chip'
import { EmptyState } from '@/components/ui/empty-state'

type StorageLocation = 'fridge' | 'pantry' | 'freezer'
type LocationHint = StorageLocation | 'mixed'
type InputSource = 'ticket' | 'text' | 'voice'

type Item = {
  name: string
  canonical_name?: string
  quantity: number
  unit: string
  storage_location: StorageLocation
  estimated_expiry_days: number
}

const UNITS = ['unité(s)', 'g', 'kg', 'ml', 'cl', 'l', 'tranche(s)', 'portion(s)', 'boîte(s)', 'sachet(s)', 'bouteille(s)']

const STORAGE_EMOJI: Record<StorageLocation, string> = {
  fridge: '🧊', pantry: '🗄️', freezer: '❄️',
}

const FREQUENT_ITEMS = ['Lait', 'Pain', 'Beurre', 'Œufs', 'Pâtes', 'Riz', 'Yaourt', 'Tomates', 'Oignons']

type Step = 'input' | 'loading' | 'review' | 'confirming' | 'done'

function expiryLabel(days: number): string {
  if (days <= 0) return '?'
  if (days <= 3) return `${days}j`
  if (days <= 13) return `${Math.round(days / 7)}sem`
  return `${Math.round(days / 30)}mois`
}

// Flags items that are ambiguous: very short, code-like, or barely alphabetic.
// All-caps names are NOT flagged — ticket receipts commonly use uppercase.
function isUncertain(item: Item): boolean {
  const name = item.name.trim()
  if (name.length < 3) return true
  if (/\d{3,}/.test(name)) return true
  const letterCount = (name.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length
  if (letterCount < 2) return true
  return false
}

export default function ImporterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [text, setText] = useState('')
  // locationHint kept for future UI use; default 'mixed' lets the AI assign per-product locations
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
  // inputSource state: used during render (e.g. loading message)
  // inputSourceRef: used inside async analyze() to avoid stale-closure issues
  const [inputSource, setInputSource] = useState<InputSource>('text')
  const ticketRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const inputSourceRef = useRef<InputSource>('text')
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutAbortedRef = useRef(false)

  // ── Business logic (unchanged) ─────────────────────────────────────────────

  async function analyze(payload: { text?: string; image?: string; mimeType?: string }) {
    setStep('loading')
    setError(null)
    timeoutAbortedRef.current = false

    const controller = new AbortController()
    abortControllerRef.current = controller
    const timeoutId = setTimeout(() => {
      timeoutAbortedRef.current = true
      controller.abort()
    }, 45_000)

    let res: Response
    try {
      res = await fetch('/api/import/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, locationHint }),
        signal: controller.signal,
      })
    } catch (e) {
      clearTimeout(timeoutId)
      abortControllerRef.current = null
      if (e instanceof Error && e.name === 'AbortError') {
        if (timeoutAbortedRef.current) {
          setError("L'analyse du ticket a pris trop de temps. Essayez une photo plus nette ou ajoutez vos produits sous forme de liste.")
        }
        // Annulation utilisateur : retour silencieux à l'écran de saisie
      } else {
        setError('Erreur réseau. Vérifiez votre connexion.')
      }
      setStep('input')
      return
    }

    clearTimeout(timeoutId)
    abortControllerRef.current = null

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

    if (parsed.length === 0) {
      setError(
        inputSourceRef.current === 'ticket'
          ? 'Aucun produit alimentaire détecté sur ce document. Essayez avec une photo plus nette ou saisissez manuellement.'
          : 'Aucun produit détecté. Vérifiez votre saisie et réessayez.'
      )
      setStep('input')
      return
    }

    setImportId(data.importId ?? '')
    setItems(parsed)
    setStep('review')
  }

  function cancelAnalysis() {
    abortControllerRef.current?.abort()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, forceMime?: string) {
    const file = e.target.files?.[0]
    if (!file) return

    const isPdf = forceMime === 'application/pdf' || file.type === 'application/pdf'
    const maxBytes = isPdf ? 10 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxBytes) {
      setError(`Fichier trop volumineux (max ${isPdf ? '10 Mo' : '5 Mo'}). Réduisez la taille ou choisissez un fichier plus petit.`)
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      const mimeType = forceMime ?? file.type ?? dataUrl.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
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
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setStep('input')
    setText('')
    setItems([])
    setUpserted(0)
    setError(null)
    setLocationHint('mixed')
    inputSourceRef.current = 'text'
    setInputSource('text')
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (step === 'loading') {
    const isTicket = inputSource === 'ticket'
    return (
      <div className="flex flex-col min-h-full">
        <div className="flex items-center gap-3 px-4 pt-6 pb-4">
          <div className="w-9 h-9 shrink-0" />
          <h1 className="text-base font-semibold">Ajouter au stock</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 pb-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {isTicket ? 'Analyse du ticket en cours…' : 'Analyse de votre liste…'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isTicket
                ? 'Nous détectons les produits lisibles.'
                : 'Identification des produits en cours…'}
            </p>
          </div>
          <button
            type="button"
            onClick={cancelAnalysis}
            className="text-sm text-ink-3 underline mt-2 hover:text-foreground transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    )
  }

  // ── Done ──────────────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <div className="flex flex-col min-h-full">
        <div className="flex items-center gap-3 px-4 pt-6 pb-4">
          <button
            type="button"
            onClick={() => router.push('/inventaire')}
            className="rounded-full p-2 hover:bg-muted transition-colors"
            aria-label="Aller au stock"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold">Ajouter au stock</h1>
        </div>
        <EmptyState
          icon={<Check className="w-5 h-5" />}
          tone="success"
          title="Produits ajoutés !"
          subtitle={`${upserted} produit${upserted > 1 ? 's' : ''} mis à jour dans votre stock.`}
          cta={
            <div className="flex flex-col gap-2 w-full mt-2">
              <Button className="w-full" onClick={() => router.push('/inventaire')}>
                Voir le stock
              </Button>
              <Button variant="outline" className="w-full" onClick={resetInput}>
                Nouvel import
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  // ── Review / Confirming ───────────────────────────────────────────────────

  if (step === 'review' || step === 'confirming') {
    const confirmed = items.filter((item) => !isUncertain(item))
    const uncertain = items.filter((item) => isUncertain(item))

    return (
      <div className="flex flex-col min-h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-6 pb-4">
          <button
            type="button"
            onClick={resetInput}
            disabled={step === 'confirming'}
            className="rounded-full p-2 hover:bg-muted transition-colors disabled:opacity-40"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold flex-1">Produits détectés</h1>
          <BetaChip />
        </div>

        {/* Scrollable content — pb-48 clears sticky CTA + nav */}
        <div className="px-4 space-y-5 pb-48">
          <p className="text-sm text-muted-foreground">
            {items.length} produit{items.length > 1 ? 's' : ''} détecté{items.length > 1 ? 's' : ''}.{' '}
            Modifiez ou supprimez avant de confirmer.
          </p>

          {error && (
            <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {confirmed.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[1.4px] text-muted-foreground">
                Confirmés · {confirmed.length}
              </p>
              {confirmed.map((item) => {
                const idx = items.indexOf(item)
                return (
                  <CompactItemRow
                    key={idx}
                    item={item}
                    onUpdate={(patch) => updateItem(idx, patch)}
                    onRemove={() => removeItem(idx)}
                    disabled={step === 'confirming'}
                  />
                )
              })}
            </div>
          )}

          {uncertain.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[1.4px] text-accent-ink">
                À vérifier · {uncertain.length}
              </p>
              {uncertain.map((item) => {
                const idx = items.indexOf(item)
                return (
                  <CompactItemRow
                    key={idx}
                    item={item}
                    onUpdate={(patch) => updateItem(idx, patch)}
                    onRemove={() => removeItem(idx)}
                    disabled={step === 'confirming'}
                    uncertain
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Sticky CTA — sits above nav bar (pb-20 matches main layout) */}
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-6 px-4 pb-20 space-y-2">
          <Button
            className="w-full"
            onClick={handleConfirm}
            disabled={step === 'confirming' || items.length === 0}
          >
            {step === 'confirming'
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ajout en cours…</>
              : `Ajouter ${items.length} produit${items.length > 1 ? 's' : ''} au stock`}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={resetInput}
            disabled={step === 'confirming'}
          >
            Recommencer
          </Button>
        </div>
      </div>
    )
  }

  // ── Input screen ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full p-2 hover:bg-muted transition-colors"
          aria-label="Retour"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold flex-1">Ajouter au stock</h1>
        <BetaChip />
      </div>

      <div className="px-4 space-y-4 pb-8">

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-destructive">
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 underline"
            >
              Fermer
            </button>
          </div>
        )}

        {/* ── Bloc 1 : Ticket de caisse (action principale) ─────────────── */}
        <div className="rounded-xl border border-border bg-surface shadow-sm p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Importer un ticket de caisse</p>
            <p className="text-sm text-ink-3 mt-0.5">PDF, capture ou photo.</p>
          </div>
          <p className="rounded-lg bg-surface-muted px-3 py-1.5 text-xs text-ink-3">
            Nous détectons les produits lisibles. Vous vérifiez avant ajout.
          </p>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => ticketRef.current?.click()}
          >
            <FileText className="w-4 h-4 mr-2" />
            Importer un ticket
          </Button>
          <input
            ref={ticketRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              inputSourceRef.current = 'ticket'
              setInputSource('ticket')
              handleFileChange(e)
            }}
          />
        </div>

        {/* ── Bloc 2 : Saisie manuelle (action secondaire) ──────────────── */}
        <div className="rounded-xl border border-border bg-surface shadow-sm p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Ajouter manuellement</p>
          <textarea
            className="w-full min-h-[90px] rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-ink-3"
            placeholder={`Tapez ou collez votre liste…\n\nExemple : yaourts x4, riz, œufs, jambon`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              inputSourceRef.current = 'text'
              setInputSource('text')
              analyze({ text })
            }}
            disabled={!text.trim()}
          >
            Vérifier la liste
          </Button>
        </div>

        {/* ── Bloc 3 : Méthodes secondaires (scan + voix) ───────────────── */}
        <div className="flex gap-2">
          {/* Scan — visible, non implémenté en V1 */}
          <button
            type="button"
            disabled
            title="Disponible prochainement"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface py-2.5 text-sm text-ink-4 cursor-not-allowed"
          >
            <Camera className="w-4 h-4" />
            Scanner
          </button>

          {/* Voix — fonctionnel si supporté par le navigateur */}
          {hasSpeech ? (
            <button
              type="button"
              onClick={() => {
                inputSourceRef.current = 'voice'
                setInputSource('voice')
                toggleVoice()
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm transition-colors ${
                listening
                  ? 'border-destructive bg-danger-soft text-destructive'
                  : 'border-border bg-surface text-ink-3 hover:text-foreground hover:bg-muted'
              }`}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {listening ? 'Arrêter' : 'Dicter'}
            </button>
          ) : (
            <button
              type="button"
              disabled
              title="Dictée non supportée sur ce navigateur"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface py-2.5 text-sm text-ink-4 cursor-not-allowed"
            >
              <Mic className="w-4 h-4" />
              Dicter
            </button>
          )}
        </div>

        {/* ── Bloc 4 : Habitudes / produits fréquents ───────────────────── */}
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[1.4px] text-ink-3 px-0.5">
            Habitudes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FREQUENT_ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setText((prev) => prev ? `${prev}\n${item}` : item)}
                className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-foreground hover:bg-primary-soft hover:border-primary hover:text-primary-ink transition-colors"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* ── Bloc 5 : Ajoutés récemment ────────────────────────────────── */}
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[1.4px] text-ink-3 px-0.5">
            Ajoutés récemment
          </p>
          <p className="text-sm text-ink-3 px-0.5">Aucun ajout récent.</p>
        </div>

      </div>
    </div>
  )
}

// ── CompactItemRow ─────────────────────────────────────────────────────────────

type ItemRowProps = {
  item: Item
  onUpdate: (patch: Partial<Item>) => void
  onRemove: () => void
  disabled: boolean
  uncertain?: boolean
}

function CompactItemRow({ item, onUpdate, onRemove, disabled, uncertain = false }: ItemRowProps) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 space-y-2 ${
      uncertain
        ? 'border-accent-amber/50 bg-accent-soft/40'
        : 'border-border bg-surface'
    }`}>
      {/* Row 1: name + expiry hint + delete */}
      <div className="flex items-center gap-2">
        <Input
          value={item.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 h-8 text-sm font-medium px-2"
          placeholder="Nom du produit"
          disabled={disabled}
        />
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          ~{expiryLabel(item.estimated_expiry_days)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="shrink-0 rounded p-1 hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Row 2: quantity + unit + storage location */}
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
        {/* Storage location selector — kept per user requirement */}
        <div className="flex gap-1 shrink-0">
          {(['fridge', 'pantry', 'freezer'] as StorageLocation[]).map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => onUpdate({ storage_location: loc })}
              disabled={disabled}
              title={loc === 'fridge' ? 'Frigo' : loc === 'pantry' ? 'Placard' : 'Congélo'}
              className={`size-8 rounded-lg border text-sm flex items-center justify-center transition-colors ${
                item.storage_location === loc
                  ? 'border-primary bg-primary-soft'
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
