'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Package, ChefHat, ScanText, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { href: '/', icon: Home, label: 'Accueil' },
  { href: '/inventaire', icon: Package, label: 'Stock' },
  { href: '/importer', icon: ScanText, label: 'Importer' },
  { href: '/recettes', icon: ChefHat, label: 'Recettes' },
  { href: '/courses', icon: ShoppingCart, label: 'Courses' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors min-w-[60px]',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
