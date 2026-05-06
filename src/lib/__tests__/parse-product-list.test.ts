// Run: pnpm dlx tsx src/lib/__tests__/parse-product-list.test.ts
import assert from 'node:assert/strict'
import { parseProductList } from '../parse-product-list.js'

type Case = {
  input: string
  qty: number
  unit: string
  name: string
}

const cases: Case[] = [
  // ── Quantités simples ──────────────────────────────────────────────────
  { input: '6 œufs',              qty: 6,    unit: 'unité(s)',    name: 'œufs' },
  { input: '3 tomates',           qty: 3,    unit: 'unité(s)',    name: 'tomates' },
  { input: '2 courgettes',        qty: 2,    unit: 'unité(s)',    name: 'courgettes' },
  { input: '4 yaourts nature',    qty: 4,    unit: 'unité(s)',    name: 'yaourts nature' },
  { input: '1 poulet',            qty: 1,    unit: 'unité(s)',    name: 'poulet' },

  // ── Grammages ──────────────────────────────────────────────────────────
  { input: '500g pâtes',          qty: 500,  unit: 'g',          name: 'pâtes' },
  { input: '500 g pâtes',         qty: 500,  unit: 'g',          name: 'pâtes' },
  { input: '500 grammes pâtes',   qty: 500,  unit: 'g',          name: 'pâtes' },
  { input: '500g de pâtes',       qty: 500,  unit: 'g',          name: 'pâtes' },
  { input: '1.5kg pommes',        qty: 1.5,  unit: 'kg',         name: 'pommes' },
  { input: '1,5 kg pommes',       qty: 1.5,  unit: 'kg',         name: 'pommes' },
  { input: '1 kg carottes',       qty: 1,    unit: 'kg',         name: 'carottes' },

  // ── Volumes ────────────────────────────────────────────────────────────
  { input: '1 bouteille lait',    qty: 1,    unit: 'bouteille(s)', name: 'lait' },
  { input: '1 bouteille de lait', qty: 1,    unit: 'bouteille(s)', name: 'lait' },
  { input: '1L lait',             qty: 1,    unit: 'l',           name: 'lait' },
  { input: '1 litre lait',        qty: 1,    unit: 'l',           name: 'lait' },
  { input: '1 litre d\'eau',      qty: 1,    unit: 'l',           name: 'eau' },
  { input: '33cl eau',            qty: 33,   unit: 'cl',          name: 'eau' },
  { input: '500ml jus orange',    qty: 500,  unit: 'ml',          name: 'jus orange' },

  // ── Conditionnements ───────────────────────────────────────────────────
  { input: '1 paquet fromage râpé', qty: 1,  unit: 'sachet(s)',  name: 'fromage râpé' },
  { input: '1 boîte thon',        qty: 1,    unit: 'boîte(s)',   name: 'thon' },
  { input: '1 boîte de saumon',          qty: 1, unit: 'boîte(s)', name: 'saumon' },
  { input: '2 sachets levure',    qty: 2,    unit: 'sachet(s)',  name: 'levure' },
  { input: '3 tranches jambon',   qty: 3,    unit: 'tranche(s)', name: 'jambon' },

  // ── Format "x" ─────────────────────────────────────────────────────────
  { input: '2x yaourts',          qty: 2,    unit: 'unité(s)',   name: 'yaourts' },
  { input: '2 x yaourts',         qty: 2,    unit: 'unité(s)',   name: 'yaourts' },
  { input: 'Saumon fumé x3',      qty: 3,    unit: 'unité(s)',   name: 'Saumon fumé' },
  { input: 'Evian ×6',            qty: 6,    unit: 'unité(s)',   name: 'Evian' },

  // ── Avec tirets / puces ────────────────────────────────────────────────
  { input: '- 6 œufs',            qty: 6,    unit: 'unité(s)',   name: 'œufs' },
  { input: '• 500g pâtes',        qty: 500,  unit: 'g',          name: 'pâtes' },
  { input: '* 1 boîte thon',      qty: 1,    unit: 'boîte(s)',   name: 'thon' },

  // ── Sans quantité (nom seul) ───────────────────────────────────────────
  { input: 'Sel fin',             qty: 1,    unit: 'unité(s)',   name: 'Sel fin' },
  { input: 'Huile d\'olive',      qty: 1,    unit: 'unité(s)',   name: "Huile d'olive" },
]

let pass = 0
let fail = 0

for (const c of cases) {
  const result = parseProductList(c.input)
  const item = result[0]
  try {
    assert.ok(item, `No item parsed from: "${c.input}"`)
    assert.equal(item.quantity, c.qty,  `[qty]  "${c.input}" → expected ${c.qty}, got ${item.quantity}`)
    assert.equal(item.unit,     c.unit, `[unit] "${c.input}" → expected "${c.unit}", got "${item.unit}"`)
    assert.equal(item.rawName,  c.name, `[name] "${c.input}" → expected "${c.name}", got "${item.rawName}"`)
    console.log(`  ✓  ${c.input}`)
    pass++
  } catch (e) {
    console.error(`  ✗  ${(e as Error).message}`)
    fail++
  }
}

// Multi-line list test
const LIST = `
6 œufs
500g pâtes
2 courgettes
1 paquet fromage râpé
4 yaourts nature
1 boîte thon
1 bouteille lait
`
const list = parseProductList(LIST)
try {
  assert.equal(list.length, 7, `List should have 7 items, got ${list.length}`)
  console.log(`  ✓  Full list: ${list.length} items`)
  pass++
} catch (e) {
  console.error(`  ✗  ${(e as Error).message}`)
  fail++
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
