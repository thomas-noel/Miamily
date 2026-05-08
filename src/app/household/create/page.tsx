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

export default function CreateHouseholdPage() {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function doCreate() {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.rpc('create_household', {
        p_name: name.trim(),
      })

      if (error) {
        setError(error.message)
        return
      }

      window.location.href = '/'
    } catch {
      setError('Erreur réseau. Vérifie ta connexion.')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    doCreate()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <div className="text-4xl mb-1">🏠</div>
            <CardTitle>Créer ton foyer</CardTitle>
            <CardDescription>Donne un nom à votre famille</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Nom du foyer</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Famille Thomas"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button type="button" onClick={doCreate} className="w-full" disabled={loading}>
                {loading ? 'Création…' : 'Créer le foyer'}
              </Button>
              <Link
                href="/household/join"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Rejoindre un foyer existant
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
