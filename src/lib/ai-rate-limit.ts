// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any

export type AiAction = 'recipe_generation' | 'photo_import' | 'pdf_import' | 'text_import'

const DAILY_LIMITS: Record<AiAction, number> = {
  recipe_generation: 20,
  photo_import:      10,
  pdf_import:        10,
  text_import:       30,
}

const COOLDOWN_MS = 5_000

type CheckResult =
  | { allowed: true }
  | { allowed: false; reason: 'rate_limit'; used: number; limit: number }
  | { allowed: false; reason: 'cooldown' }

/**
 * Check cooldown + daily rate limit for a user+action.
 * Returns { allowed: true } if the call should proceed.
 * Does NOT insert a log — call logUsage() after a successful AI call.
 */
export async function checkUsage(
  supabase: SupabaseLike,
  userId: string,
  action: AiAction
): Promise<CheckResult> {
  const now = Date.now()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const cooldownStart = new Date(now - COOLDOWN_MS).toISOString()

  // Single query: fetch logs since start-of-day — used for both checks
  const { data: todayLogs, error } = await supabase
    .from('ai_usage_logs')
    .select('created_at')
    .eq('user_id', userId)
    .eq('action_type', action)
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    // If we can't check, allow the call (fail open) to avoid blocking legit users
    console.warn('[rate-limit] DB error, allowing call:', error.message)
    return { allowed: true }
  }

  const logs = todayLogs ?? []
  const limit = DAILY_LIMITS[action]

  // Daily limit
  if (logs.length >= limit) {
    return { allowed: false, reason: 'rate_limit', used: logs.length, limit }
  }

  // Cooldown: any call in the last 5s?
  const hasRecent = logs.some((l: { created_at: string }) => l.created_at >= cooldownStart)
  if (hasRecent) {
    return { allowed: false, reason: 'cooldown' }
  }

  return { allowed: true }
}

/** Insert one log entry after a successful AI call. */
export async function logUsage(
  supabase: SupabaseLike,
  userId: string,
  action: AiAction
): Promise<void> {
  const { error } = await supabase
    .from('ai_usage_logs')
    .insert({ user_id: userId, action_type: action })
  if (error) {
    console.warn('[rate-limit] log insert error:', error.message)
  }
}

/** Return today's usage count + daily limit for a given action. */
export async function getUsage(
  supabase: SupabaseLike,
  userId: string,
  action: AiAction
): Promise<{ used: number; total: number }> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('ai_usage_logs')
    .select('created_at')
    .eq('user_id', userId)
    .eq('action_type', action)
    .gte('created_at', todayStart.toISOString())

  return { used: (data ?? []).length, total: DAILY_LIMITS[action] }
}

/** Human-readable error messages for rate-limit responses. */
export function rateLimitMessage(result: CheckResult & { allowed: false }): string {
  if (result.reason === 'cooldown') {
    return 'Patiente quelques secondes avant de relancer.'
  }
  return `Limite journalière atteinte (${result.used}/${result.limit}). Tes accès reprennent demain 🌅`
}
