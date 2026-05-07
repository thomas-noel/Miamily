export const quota = {
  normal: (remaining: number, total: number) => `${remaining} / ${total} ce mois`,
  low: (remaining: number) => `Plus que ${remaining} ce mois.`,
  empty: (resetAt: string) => `Plus de générations ce mois. Réinitialisation le ${resetAt}.`,
}
