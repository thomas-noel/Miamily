import { createClient } from '@/lib/supabase/server'
import { getUsage } from '@/lib/ai-rate-limit'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { used, total } = await getUsage(supabase, user.id, 'recipe_generation')

  const resetAt = new Date()
  resetAt.setDate(resetAt.getDate() + 1)
  resetAt.setHours(0, 0, 0, 0)

  return Response.json({ used, total, remaining: total - used, resetAt: resetAt.toISOString() })
}
