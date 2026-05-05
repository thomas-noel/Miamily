// Mots-qualificatifs à ignorer pour construire le canonical_name
const WEAK_WORDS = new Set([
  'bio', 'frais', 'fraiche', 'surgele', 'surgelee',
  'naturel', 'naturelle', 'extra', 'premier', 'premiere',
  'origine', 'marque', 'lot', 'pack',
])

function stripAccents(s: string): string {
  // Remplace les ligatures avant NFD — œ (U+0153) et æ (U+00E6) ne se décomposent pas en NFD
  return s
    .replace(/[œŒ]/g, 'oe')
    .replace(/[æÆ]/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Supprime le 's' final pour les mots ≥ 5 chars (évite "pois"→"poi", "riz"→"ri")
function singularize(word: string): string {
  return word.length >= 5 && word.endsWith('s') ? word.slice(0, -1) : word
}

export function toCanonicalName(input: string): string {
  const base = stripAccents(input.trim().toLowerCase())
  const words = base.split(/\s+/).filter((w) => w.length > 0 && !WEAK_WORDS.has(w) && !/^\d+([.,]\d+)?$/.test(w))
  return words.map(singularize).join(' ')
}
