import { cn } from "@/lib/utils"
import { quota } from "@/lib/copy"

interface QuotaPillProps {
  used: number
  total: number
  className?: string
}

export function QuotaPill({ used, total, className }: QuotaPillProps) {
  const remaining = total - used
  const isEmpty = remaining <= 0
  const isLow = remaining > 0 && remaining <= 2

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-none",
        isEmpty
          ? "bg-danger-soft text-destructive"
          : isLow
            ? "bg-accent-soft text-accent-ink"
            : "bg-primary-soft text-primary-ink",
        className
      )}
    >
      {isEmpty
        ? quota.normal(0, total)
        : isLow
          ? quota.low(remaining)
          : quota.normal(remaining, total)}
    </span>
  )
}
