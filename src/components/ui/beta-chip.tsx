import { cn } from "@/lib/utils"

interface BetaChipProps {
  className?: string
}

export function BetaChip({ className }: BetaChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5",
        "bg-beta-bg text-beta-ink",
        "font-mono text-[10px] font-bold uppercase tracking-[1.4px]",
        className
      )}
    >
      Bêta
    </span>
  )
}
