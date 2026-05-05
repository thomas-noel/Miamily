'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FOOD_CATEGORIES } from '@/lib/food-categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Preference = 'liked' | 'disliked' | 'forbidden'

type FoodMember = {
  id: string
  name: string
  is_child: boolean
}

type PrefMap = Record<string, Preference | null>

export default function PreferencesPage() {
  const supabase = createClient()

  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [members, setMembers] = useState<FoodMember[]>([])
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<Record<string, PrefMap>>({})
  const [loading, setLoading] = useState(true)

  const [prefError, setPrefError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [isChild, setIsChild] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles').select('household_id').eq('id', user.id).single()
    if (!profile?.household_id) return
    const hid = profile.household_id as string
    setHouseholdId(hid)

    const [{ data: membersData }, { data: prefsData }] = await Promise.all([
      supabase.from('food_members').select('id, name, is_child').eq('household_id', hid).order('created_at'),
      supabase.from('member_preferences').select('food_member_id, category, preference').eq('household_id', hid),
    ])

    const ms = (membersData ?? []) as FoodMember[]
    setMembers(ms)
    if (ms.length > 0 && !activeMemberId) setActiveMemberId(ms[0].id)

    const prefsByMember: Record<string, PrefMap> = {}
    for (const m of ms) prefsByMember[m.id] = {}
    for (const p of (prefsData ?? [])) {
      if (prefsByMember[p.food_member_id]) {
        prefsByMember[p.food_member_id][p.category] = p.preference as Preference
      }
    }
    setPrefs(prefsByMember)
    setLoading(false)
  }, [supabase, activeMemberId])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggle(memberId: string, categoryId: string, value: Preference) {
    const current = prefs[memberId]?.[categoryId] ?? null
    const next = current === value ? null : value
    setPrefError(null)

    // Optimistic update
    setPrefs((prev) => ({
      ...prev,
      [memberId]: { ...prev[memberId], [categoryId]: next },
    }))

    // DELETE d'abord, puis INSERT si besoin
    const { error: deleteError } = await supabase
      .from('member_preferences')
      .delete()
      .eq('food_member_id', memberId)
      .eq('category', categoryId)

    if (deleteError) {
      console.error('[preferences] delete error:', deleteError.message, deleteError.code)
      setPrefError(`DB: ${deleteError.message} (code: ${deleteError.code})`)
      return
    }

    if (next !== null) {
      const { error: insertError } = await supabase
        .from('member_preferences')
        .insert({ household_id: householdId, food_member_id: memberId, category: categoryId, preference: next })

      if (insertError) {
        console.error('[preferences] insert error:', insertError.message, insertError.code)
        setPrefError(`DB: ${insertError.message} (code: ${insertError.code})`)
      }
    }
  }

  async function handleAddMember() {
    if (!newName.trim() || !householdId) return
    setAddingMember(true)
    const { data } = await supabase
      .from('food_members')
      .insert({ household_id: householdId, name: newName.trim(), is_child: isChild })
      .select('id, name, is_child')
      .single()
    if (data) {
      const m = data as FoodMember
      setMembers((prev) => [...prev, m])
      setPrefs((prev) => ({ ...prev, [m.id]: {} }))
      setActiveMemberId(m.id)
    }
    setNewName('')
    setIsChild(false)
    setShowAddForm(false)
    setAddingMember(false)
  }

  async function handleDeleteMember(memberId: string) {
    await supabase.from('food_members').delete().eq('id', memberId)
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
    setPrefs((prev) => { const next = { ...prev }; delete next[memberId]; return next })
    setActiveMemberId((prev) => {
      if (prev !== memberId) return prev
      const remaining = members.filter((m) => m.id !== memberId)
      return remaining[0]?.id ?? null
    })
  }

  const activeMember = members.find((m) => m.id === activeMemberId) ?? null
  const activePrefs = activeMemberId ? (prefs[activeMemberId] ?? {}) : {}

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-semibold">Famille</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Préférences alimentaires</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Sélecteur de membre */}
          <div className="px-4 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveMemberId(m.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                    activeMemberId === m.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  {m.name}{m.is_child && ' 👶'}
                </button>
              ))}
              <button
                onClick={() => setShowAddForm((v) => !v)}
                className="rounded-full px-3 py-1.5 text-sm font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />Ajouter
              </button>
            </div>
          </div>

          {/* Formulaire ajout membre */}
          {showAddForm && (
            <div className="mx-4 mb-4 rounded-2xl border border-border bg-card px-4 py-3 space-y-3">
              <p className="text-sm font-medium">Nouveau membre</p>
              <Input
                placeholder="Prénom"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember() }}
                autoFocus
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isChild}
                  onChange={(e) => setIsChild(e.target.checked)}
                  className="w-4 h-4"
                />
                C&apos;est un enfant
              </label>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleAddMember} disabled={addingMember || !newName.trim()}>
                  {addingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ajouter'}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddForm(false); setNewName('') }}>
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {/* Pas de membres */}
          {members.length === 0 && !showAddForm && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              <p>Aucun membre configuré.</p>
              <p className="mt-1">Ajoutez les membres de votre famille pour personnaliser les recettes.</p>
            </div>
          )}

          {/* Grille des préférences */}
          {prefError && (
            <div className="mx-4 mb-3 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive break-words">
              {prefError}
            </div>
          )}

          {activeMember && (
            <div className="px-4 pb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Préférences de {activeMember.name}
                </p>
                <button
                  onClick={() => handleDeleteMember(activeMember.id)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Supprimer ce membre"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {FOOD_CATEGORIES.map((cat) => {
                  const pref = activePrefs[cat.id] ?? null
                  return (
                    <div
                      key={cat.id}
                      className="rounded-2xl border border-border bg-card px-4 py-3 flex items-center gap-3"
                    >
                      <span className="text-lg shrink-0">{cat.emoji}</span>
                      <span className="flex-1 text-sm font-medium min-w-0">{cat.label}</span>
                      <div className="flex gap-1 shrink-0">
                        <ToggleBtn
                          active={pref === 'liked'}
                          onClick={() => handleToggle(activeMember.id, cat.id, 'liked')}
                          label="❤️"
                          title="Aime"
                          activeClass="bg-green-500 border-green-500"
                        />
                        <ToggleBtn
                          active={pref === 'disliked'}
                          onClick={() => handleToggle(activeMember.id, cat.id, 'disliked')}
                          label="👎"
                          title="N'aime pas"
                          activeClass="bg-orange-400 border-orange-400"
                        />
                        <ToggleBtn
                          active={pref === 'forbidden'}
                          onClick={() => handleToggle(activeMember.id, cat.id, 'forbidden')}
                          label="🚫"
                          title="Interdit / allergie"
                          activeClass="bg-red-500 border-red-500"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ToggleBtn({
  active,
  onClick,
  label,
  title,
  activeClass,
}: {
  active: boolean
  onClick: () => void
  label: string
  title: string
  activeClass: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-11 h-11 rounded-xl border text-lg flex items-center justify-center transition-colors ${
        active ? activeClass : 'border-border bg-muted/50 opacity-40 hover:opacity-70'
      }`}
    >
      {label}
    </button>
  )
}
