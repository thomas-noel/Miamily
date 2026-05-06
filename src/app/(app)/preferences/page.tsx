'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Loader2, Copy, Share2, Check, LogOut, UserMinus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FOOD_CATEGORIES } from '@/lib/food-categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Preference = 'liked' | 'disliked' | 'forbidden'
type PrefMap = Record<string, Preference>

type FoodMember = {
  id: string
  name: string
  is_child: boolean
}

function itemLabel(key: string): string {
  const cat = FOOD_CATEGORIES.find((c) => c.id === key)
  return cat ? `${cat.emoji} ${cat.label}` : key
}

export default function PreferencesPage() {
  const supabase = createClient()
  const householdIdRef = useRef<string | null>(null)

  const [members, setMembers] = useState<FoodMember[]>([])
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<Record<string, PrefMap>>({})
  const [loading, setLoading] = useState(true)
  const [householdCode, setHouseholdCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [leavingHousehold, setLeavingHousehold] = useState(false)
  const [hasShare] = useState(() => {
    if (typeof window === 'undefined') return false
    return 'share' in navigator
  })

  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [isChild, setIsChild] = useState(false)
  const [addingMember, setAddingMember] = useState(false)

  const [newDisliked, setNewDisliked] = useState('')
  const [newForbidden, setNewForbidden] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles').select('household_id').eq('id', user.id).single()
      if (!profile?.household_id) { setLoading(false); return }

      householdIdRef.current = profile.household_id as string

      const [{ data: membersData }, { data: prefsData }, { data: householdData }] = await Promise.all([
        supabase.from('food_members').select('id, name, is_child')
          .eq('household_id', profile.household_id).order('created_at'),
        supabase.from('member_preferences').select('food_member_id, category, preference')
          .eq('household_id', profile.household_id),
        supabase.from('households').select('invite_code')
          .eq('id', profile.household_id).single(),
      ])
      if (householdData) setHouseholdCode((householdData as { invite_code: string }).invite_code)

      const ms = (membersData ?? []) as FoodMember[]
      setMembers(ms)
      if (ms.length > 0) setActiveMemberId(ms[0].id)

      const map: Record<string, PrefMap> = {}
      for (const m of ms) map[m.id] = {}
      for (const p of (prefsData ?? [])) {
        if (map[p.food_member_id] !== undefined)
          map[p.food_member_id][p.category] = p.preference as Preference
      }
      setPrefs(map)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addPref(memberId: string, text: string, pref: 'disliked' | 'forbidden') {
    const raw = text.trim().toLowerCase()
    if (!raw || !householdIdRef.current) return
    const matched = FOOD_CATEGORIES.find((c) => c.label.toLowerCase() === raw || c.id === raw)
    const key = matched ? matched.id : raw

    if (pref === 'disliked') setNewDisliked('')
    else setNewForbidden('')

    setPrefs((prev) => ({
      ...prev,
      [memberId]: { ...prev[memberId], [key]: pref },
    }))

    await supabase.from('member_preferences').delete()
      .eq('food_member_id', memberId).eq('category', key)

    await supabase.from('member_preferences').insert({
      household_id: householdIdRef.current,
      food_member_id: memberId,
      category: key,
      preference: pref,
    })
  }

  async function removePref(memberId: string, category: string) {
    setPrefs((prev) => {
      const mp = { ...prev[memberId] }
      delete mp[category]
      return { ...prev, [memberId]: mp }
    })
    await supabase.from('member_preferences').delete()
      .eq('food_member_id', memberId).eq('category', category)
  }

  async function addMember() {
    if (!newMemberName.trim() || !householdIdRef.current) return
    setAddingMember(true)
    const { data } = await supabase.from('food_members')
      .insert({ household_id: householdIdRef.current, name: newMemberName.trim(), is_child: isChild })
      .select('id, name, is_child').single()
    if (data) {
      const m = data as FoodMember
      setMembers((prev) => [...prev, m])
      setPrefs((prev) => ({ ...prev, [m.id]: {} }))
      setActiveMemberId(m.id)
    }
    setNewMemberName('')
    setIsChild(false)
    setShowAddMember(false)
    setAddingMember(false)
  }

  async function deleteMember(memberId: string) {
    await supabase.from('food_members').delete().eq('id', memberId)
    const remaining = members.filter((m) => m.id !== memberId)
    setMembers(remaining)
    setPrefs((prev) => { const n = { ...prev }; delete n[memberId]; return n })
    setActiveMemberId(remaining[0]?.id ?? null)
  }

  function handleCopy() {
    if (!householdCode) return
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(householdCode).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => fallbackCopy(householdCode))
    } else {
      fallbackCopy(householdCode)
    }
  }

  function fallbackCopy(text: string) {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    try {
      document.execCommand('copy')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // silently ignore — user can copy manually from the displayed code
    } finally {
      document.body.removeChild(el)
    }
  }

  async function handleShare() {
    if (!householdCode) return
    try {
      await navigator.share({
        title: 'Rejoindre ma famille sur Miamily',
        text: `Utilise le code ${householdCode} pour rejoindre ma famille sur Miamily.`,
      })
    } catch {
      // user cancelled or share not available
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function handleLeaveHousehold() {
    if (!householdIdRef.current) return
    setLeavingHousehold(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await Promise.allSettled([
      supabase.from('profiles').update({ household_id: null }).eq('id', user.id),
      supabase.from('household_members').delete().eq('profile_id', user.id),
    ])
    window.location.href = '/household/join'
  }

  const activeMember = members.find((m) => m.id === activeMemberId) ?? null
  const activePrefs: PrefMap = activeMemberId ? (prefs[activeMemberId] ?? {}) : {}
  const dislikedItems = Object.keys(activePrefs).filter((k) => activePrefs[k] === 'disliked')
  const forbiddenItems = Object.keys(activePrefs).filter((k) => activePrefs[k] === 'forbidden')
  const unsetCategories = FOOD_CATEGORIES.filter((c) => !(c.id in activePrefs))

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="px-4 pt-6 pb-4">
          <h1 className="text-2xl font-semibold">Famille</h1>
        </div>
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-semibold">Famille</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Préférences alimentaires</p>
      </div>

      {/* Code d'invitation */}
      {householdCode && (
        <div className="mx-4 mb-6 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
            Code d&apos;invitation
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Partage ce code pour inviter quelqu&apos;un à rejoindre cette famille
          </p>
          <div className="bg-muted rounded-xl py-3 px-4 text-center mb-3">
            <span className="font-mono text-2xl font-bold tracking-[0.25em] text-foreground select-all">
              {householdCode}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleCopy}>
              {copied
                ? <><Check className="w-4 h-4 mr-2" />Copié !</>
                : <><Copy className="w-4 h-4 mr-2" />Copier</>
              }
            </Button>
            {hasShare && (
              <Button variant="outline" className="flex-1" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />Partager
              </Button>
            )}
          </div>
        </div>
      )}

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
            onClick={() => setShowAddMember((v) => !v)}
            className="rounded-full px-3 py-1.5 text-sm font-medium border border-dashed border-border text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />Ajouter
          </button>
        </div>
      </div>

      {/* Formulaire nouveau membre */}
      {showAddMember && (
        <div className="mx-4 mb-4 rounded-2xl border border-border bg-card px-4 py-3 space-y-3">
          <p className="text-sm font-medium">Nouveau membre</p>
          <Input
            placeholder="Prénom"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addMember() }}
            autoFocus
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={isChild} onChange={(e) => setIsChild(e.target.checked)} className="w-4 h-4" />
            C&apos;est un enfant
          </label>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={addMember} disabled={addingMember || !newMemberName.trim()}>
              {addingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ajouter'}
            </Button>
            <Button variant="outline" onClick={() => { setShowAddMember(false); setNewMemberName('') }}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Aucun membre */}
      {members.length === 0 && !showAddMember && (
        <div className="px-4 py-8 text-center text-muted-foreground text-sm">
          <p>Aucun membre configuré.</p>
          <p className="mt-1">Ajoutez les membres de votre famille pour personnaliser les recettes.</p>
        </div>
      )}

      {/* Préférences du membre actif */}
      {activeMember && (
        <div className="px-4 pb-6 space-y-6">
          {/* En-tête membre */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {activeMember.name}
            </p>
            <button
              onClick={() => deleteMember(activeMember.id)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* À éviter */}
          <PrefSection
            title="👎 À éviter"
            subtitle="Déprioritisé dans les suggestions"
            items={dislikedItems}
            quickPicks={unsetCategories}
            inputValue={newDisliked}
            placeholder="Ex: épinards, champignons…"
            chipClass="bg-orange-50 border-orange-200 text-orange-700"
            onAdd={(text) => addPref(activeMember.id, text, 'disliked')}
            onRemove={(key) => removePref(activeMember.id, key)}
            onInputChange={setNewDisliked}
          />

          {/* Allergies / Interdits */}
          <PrefSection
            title="🚫 Allergies / Interdits"
            subtitle="Jamais utilisé dans les recettes"
            items={forbiddenItems}
            quickPicks={unsetCategories}
            inputValue={newForbidden}
            placeholder="Ex: gluten, lactose, noix…"
            chipClass="bg-red-50 border-red-200 text-red-700"
            onAdd={(text) => addPref(activeMember.id, text, 'forbidden')}
            onRemove={(key) => removePref(activeMember.id, key)}
            onInputChange={setNewForbidden}
          />
        </div>
      )}
      {/* Section Compte */}
      <div className="px-4 pb-8 mt-6 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Compte
        </p>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:bg-muted transition-colors"
        >
          <LogOut className="w-5 h-5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">Déconnexion</span>
        </button>

        {!showLeaveConfirm ? (
          <button
            type="button"
            onClick={() => setShowLeaveConfirm(true)}
            className="w-full flex items-center gap-3 rounded-xl border border-destructive/30 bg-card p-4 text-left hover:bg-destructive/5 transition-colors"
          >
            <UserMinus className="w-5 h-5 text-destructive/70 shrink-0" />
            <span className="text-sm font-medium text-destructive">Quitter la famille</span>
          </button>
        ) : (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-destructive">Quitter la famille ?</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tu perdras l&apos;accès au stock et aux recettes de cette famille.
              Tu pourras rejoindre une nouvelle famille ou en créer une.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleLeaveHousehold}
                disabled={leavingHousehold}
              >
                {leavingHousehold ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowLeaveConfirm(false)}
                disabled={leavingHousehold}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PrefSection({
  title,
  subtitle,
  items,
  quickPicks,
  inputValue,
  placeholder,
  chipClass,
  onAdd,
  onRemove,
  onInputChange,
}: {
  title: string
  subtitle: string
  items: string[]
  quickPicks: { id: string; label: string; emoji: string }[]
  inputValue: string
  placeholder: string
  chipClass: string
  onAdd: (text: string) => void
  onRemove: (key: string) => void
  onInputChange: (v: string) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      {/* Items actifs */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((key) => (
            <span
              key={key}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${chipClass}`}
            >
              {itemLabel(key)}
              <button
                type="button"
                onClick={() => onRemove(key)}
                className="text-base leading-none opacity-50 hover:opacity-100 transition-opacity"
                aria-label="Supprimer"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Quick-picks catégories */}
      {quickPicks.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {quickPicks.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onAdd(cat.id)}
              className="rounded-full px-2.5 py-1 text-xs border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Saisie libre */}
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onAdd(inputValue) }}
          className="flex-1"
        />
        <Button
          variant="outline"
          onClick={() => onAdd(inputValue)}
          disabled={!inputValue.trim()}
          className="shrink-0"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
