'use client'

import { usePathname } from 'next/navigation'

// Routes that already display a BetaChip in their own header.
// The global banner is suppressed there to avoid redundancy.
const ROUTES_WITH_BETACHIP = ['/importer']

export function BetaBanner() {
  const pathname = usePathname()
  if (ROUTES_WITH_BETACHIP.includes(pathname)) return null

  return (
    <div className="bg-amber-50 border-b border-amber-100 px-4 py-1 text-center shrink-0">
      <span className="text-xs text-amber-700">
        <span className="font-semibold">Miamily Beta 🍽️</span>
        {' — '}
        <span className="opacity-75">Certaines fonctionnalités sont encore en test.</span>
      </span>
    </div>
  )
}
