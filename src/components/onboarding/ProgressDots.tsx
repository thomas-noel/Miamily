interface Props {
  current: number
  total: number
}

export function ProgressDots({ current, total }: Props) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="px-6 pt-2 pb-4 flex flex-col gap-2">
      <p className="text-xs text-ink-3">
        <span className="font-medium text-foreground">
          {String(current).padStart(2, '0')}
        </span>
        {' / '}
        {String(total).padStart(2, '0')}
      </p>
      <div className="h-[2px] bg-surface-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{ width: `${pct}%`, transition: 'width 400ms ease-out' }}
        />
      </div>
    </div>
  )
}
