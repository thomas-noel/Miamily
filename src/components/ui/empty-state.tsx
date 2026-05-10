import * as React from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  cta?: React.ReactNode
  tone?: "neutral" | "success" | "warning"
  inline?: boolean
  className?: string
}

const toneStyles = {
  neutral: "text-ink-3",
  success: "text-primary-ink",
  warning: "text-accent-ink",
}

const iconToneStyles = {
  neutral: "bg-surface-muted text-ink-3",
  success: "bg-primary-soft text-primary",
  warning: "bg-accent-soft text-accent-ink",
}

export function EmptyState({
  icon,
  title,
  subtitle,
  cta,
  tone = "neutral",
  inline = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 text-center",
        inline ? "py-8 px-4" : "flex-1 justify-center py-16 px-6",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            iconToneStyles[tone]
          )}
        >
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className={cn("text-sm font-semibold", toneStyles[tone])}>
          {title}
        </p>
        {subtitle && (
          <p className="text-sm text-ink-3">{subtitle}</p>
        )}
      </div>
      {cta && <div className="mt-1">{cta}</div>}
    </div>
  )
}
