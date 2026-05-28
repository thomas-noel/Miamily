import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface Props {
  backHref?: string
  skip?: React.ReactNode
}

export function TopBar({ backHref, skip }: Props) {
  return (
    <div className="flex items-center justify-between px-3 h-14">
      {backHref ? (
        <Link
          href={backHref}
          className="flex items-center justify-center w-11 h-11 rounded-xl text-foreground hover:bg-surface-muted transition-colors"
          aria-label="Retour"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
      ) : (
        <div className="w-11" />
      )}
      {skip && <div className="text-sm text-ink-2">{skip}</div>}
    </div>
  )
}
