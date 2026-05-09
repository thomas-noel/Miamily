export type ParsedLine = {
  rawName: string
  quantity: number
  unit: string
}

// Ordered by specificity: longer/more specific patterns before shorter ones
// to avoid partial matches (e.g. "gramme" before "g")
const UNIT_MAP: [RegExp, string][] = [
  [/^(kg|kilo(?:gramme)?s?)\b/i,      'kg'],
  [/^(gram(?:me)?s?|gr)\b/i,           'g'],
  [/^g\b/i,                             'g'],
  [/^(cl|centilitre?s?)\b/i,           'cl'],
  [/^(ml|millilitre?s?)\b/i,           'ml'],
  [/^(litre?s?)\b/i,                   'l'],
  [/^l\b/i,                             'l'],
  [/^(bouteille?s?)\b/i,               'bouteille(s)'],
  [/^(bo[iî]te?s?|conserve?s?)\b/i,   'boîte(s)'],
  [/^(paquet?s?|sachet?s?)\b/i,        'sachet(s)'],
  [/^(tranche?s?)\b/i,                 'tranche(s)'],
  [/^(portion?s?)\b/i,                 'portion(s)'],
  // "x" as multiplier: "2x yaourts" → strip x, keep unit as unité(s)
  [/^x\b/i,                             'unité(s)'],
]

function parseLine(raw: string): ParsedLine | null {
  // Strip leading bullets / dashes / spaces
  const line = raw.replace(/^[\s\-*•·–—]+/, '').trim()
  if (!line) return null

  // Alternate format: "Product name x N" or "Product name ×N" at end
  // e.g. "Saumon fumé x3", "Evian ×6"
  if (!/^\d/.test(line)) {
    const tailMatch = line.match(/^(.+?)\s+[x×]\s*(\d+(?:[.,]\d+)?)\s*$/i)
    if (tailMatch) {
      return {
        rawName: tailMatch[1].trim(),
        quantity: parseFloat(tailMatch[2].replace(',', '.')),
        unit: 'unité(s)',
      }
    }
    // No number at all → qty 1, full line is the name
    return { rawName: line, quantity: 1, unit: 'unité(s)' }
  }

  // Standard format: N[unit] name  or  N [unit] name
  const numMatch = line.match(/^(\d+(?:[.,]\d+)?)\s*/)!
  const quantity = parseFloat(numMatch[1].replace(',', '.'))
  let rest = line.slice(numMatch[0].length).trim()

  let unit = 'unité(s)'
  for (const [pattern, mapped] of UNIT_MAP) {
    const m = rest.match(pattern)
    if (m) {
      unit = mapped
      rest = rest.slice(m[0].length).trim()
      // Strip French preposition "de " / "d'" between unit and name
      // e.g. "500g de pâtes", "1 litre d'eau"
      rest = rest.replace(/^d[e']\s*/i, '').trim()
      break
    }
  }

  if (!rest) return null
  return { rawName: rest, quantity, unit }
}

// Splits a single line into multiple when it contains several products with no separator.
// Two patterns handled:
//   "3 oeufs 5 courgettes"         → ["3 oeufs", "5 courgettes"]   (number-first)
//   "oeufs x6 courgettes x5"       → ["oeufs x6", "courgettes x5"] (name x N)
// Named composites ("crème fraîche", "huile d'olive") are never split — they contain no digit.
function normalizeMultiProductLine(line: string): string[] {
  const trimmed = line.trim()
  if (!trimmed) return []

  // Number-first: "3 oeufs 5 courgettes 2 paquets de pâtes"
  // Split wherever a standalone number (integer or decimal) appears mid-line followed by a space.
  if (/^\d/.test(trimmed)) {
    const parts = trimmed.split(/\s+(?=\d+(?:[.,]\d+)?\s)/)
    if (parts.length > 1) return parts.map((p) => p.trim()).filter(Boolean)
  }

  // Name-x-N: "oeufs x6 courgettes x5 jambon"
  // Insert a separator after each "x N" when the next char is a letter.
  const xnNormalized = trimmed.replace(
    /([x×]\s*\d+(?:[.,]\d+)?)\s+(?=[a-zA-ZÀ-ÿ])/gi,
    '$1\n',
  )
  if (xnNormalized !== trimmed) {
    return xnNormalized.split('\n').map((p) => p.trim()).filter(Boolean)
  }

  return [trimmed]
}

export function parseProductList(text: string): ParsedLine[] {
  return text
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap(normalizeMultiProductLine)
    .map(parseLine)
    .filter((p): p is ParsedLine => p !== null && p.rawName.length > 0)
}
