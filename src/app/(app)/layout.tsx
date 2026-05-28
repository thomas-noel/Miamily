import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/bottom-nav'
import { BetaBanner } from '@/components/beta-banner'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id, onboarded')
    .eq('id', user.id)
    .single()

  if (profile?.onboarded === false) redirect('/onboarding/welcome')
  if (!profile?.household_id) redirect('/household/create')

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden pt-safe">
      <BetaBanner />
      <main className="flex-1 pb-20 min-w-0 w-full">{children}</main>
      <BottomNav />
    </div>
  )
}
