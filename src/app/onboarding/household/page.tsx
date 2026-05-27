import Link from 'next/link'

export default function HouseholdPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-3">onboarding flow test</p>
      <p className="text-xs text-ink-3">2 / 7</p>
      <h1 className="font-serif text-3xl text-foreground">S2 — Votre foyer</h1>
      <div className="flex gap-3 mt-4">
        <Link
          href="/onboarding/welcome"
          className="px-5 py-2.5 rounded-xl border border-border text-sm text-foreground hover:bg-surface-muted transition-colors"
        >
          ← Précédent
        </Link>
        <Link
          href="/onboarding/tastes"
          className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Suivant →
        </Link>
      </div>
    </div>
  )
}
