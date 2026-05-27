import Link from 'next/link'

export default function WelcomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-3">onboarding flow test</p>
      <p className="text-xs text-ink-3">1 / 7</p>
      <h1 className="font-serif text-3xl text-foreground">S1 — Bienvenue</h1>
      <div className="flex gap-3 mt-4">
        <Link
          href="/onboarding/household"
          className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Suivant →
        </Link>
      </div>
    </div>
  )
}
