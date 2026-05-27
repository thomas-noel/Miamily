import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded')
    .eq('id', user.id)
    .single()

  if (profile?.onboarded) redirect('/')

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden pt-safe">
      {children}
    </div>
  )
}
