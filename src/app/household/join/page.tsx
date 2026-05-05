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

export default function JoinHouseholdPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.rpc('join_household', {
      p_invite_code: code.trim().toUpperCase(),
    })

    if (error) {
      setError(
        error.message.includes('invalide')
          ? "Code d'invitation invalide."
          : error.message
      )
      setLoading(false)
      return
    }

    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <div className="text-4xl mb-1">🔑</div>
            <CardTitle>Rejoindre un foyer</CardTitle>
            <CardDescription>
              Entre le code d&apos;invitation de ton foyer
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="code">Code d&apos;invitation</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="ABCD1234"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                  maxLength={8}
                  className="text-center font-mono text-lg tracking-widest"
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button
                type="submit"
                className="w-full"
                disabled={loading || code.length < 6}
              >
                {loading ? 'Vérification…' : 'Rejoindre'}
              </Button>
              <Link
                href="/household/create"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Créer un nouveau foyer
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
