import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/bottom-nav'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile?.household_id) redirect('/household/create')

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {/* Beta banner */}
      <div className="bg-amber-50 border-b border-amber-100 px-4 py-1 text-center shrink-0">
        <span className="text-xs text-amber-700">
          <span className="font-semibold">Miamily Beta 🍽️</span>
          {' — '}
          <span className="opacity-75">Certaines fonctionnalités sont encore en test.</span>
        </span>
      </div>
      <main className="flex-1 pb-20 min-w-0 w-full">{children}</main>
      <BottomNav />
    </div>
  )
}
