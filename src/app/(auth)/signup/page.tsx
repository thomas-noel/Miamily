'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmSent, setConfirmSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function doSignup() {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name.trim() } },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        setError('Un compte existe déjà avec cette adresse email.')
        return
      }

      if (!data.session) {
        setConfirmSent(true)
        return
      }

      window.location.href = '/household/create'
    } catch {
      setError('Erreur réseau. Vérifie ta connexion.')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    doSignup()
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="text-4xl mb-1">🥕</div>
        <CardTitle className="text-2xl">Créer un compte</CardTitle>
        <CardDescription>Rejoins Miamily</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {confirmSent && (
            <p className="text-sm text-primary text-center font-medium">
              Vérifie ta boîte mail pour confirmer ton compte, puis connecte-toi.
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Ton prénom</Label>
            <Input
              id="name"
              type="text"
              placeholder="Thomas"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="thomas@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              placeholder="8 caractères minimum"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button type="button" onClick={doSignup} className="w-full" disabled={loading}>
            {loading ? 'Création…' : 'Créer mon compte'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Déjà un compte ?{' '}
            <Link
              href="/login"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Se connecter
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
