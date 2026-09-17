import { allWords } from './vocabulary'
import { phrases } from './phrases'
import { wordDifficulty } from './levels'

/**
 * Progressive path after Alphabet.
 * Every level mixes everyday words + useful phrases;
 * only difficulty / grammar grow.
 */

const LEVEL_META = [
  { subtitle: 'Greetings & first words', grammar: 'Hello, thanks · short clear words' },
  { subtitle: 'Daily basics', grammar: 'How are you? · family & simple vocab' },
  { subtitle: 'I am / I want', grammar: 'ვარ · მინდა · trickier sounds' },
  { subtitle: 'Around town', grammar: 'Where is…? · longer everyday words' },
  { subtitle: 'Likes & names', grammar: 'მიყვარს · name patterns · denser vocab' },
  { subtitle: 'Survival phrases', grammar: 'I don’t understand · English? · challenge words' },
  { subtitle: 'Shopping & food', grammar: 'How much? · khinkali · full sentences' },
  { subtitle: 'Travel talk', grammar: 'Useful travel phrases · harder reading' },
]

function assignBuckets(items, scoreFn, count) {
  const scored = items
    .map(item => ({ item, score: scoreFn(item) }))
    .sort((a, b) => a.score - b.score || String(a.item.id).localeCompare(String(b.item.id)))
  const size = Math.ceil(scored.length / count)
  const buckets = []
  for (let i = 0; i < count; i++) {
    buckets.push(scored.slice(i * size, (i + 1) * size).map(s => s.item))
  }
  while (buckets.length > 1 && buckets[buckets.length - 1].length === 0) buckets.pop()
  return buckets
}

function phraseDifficulty(ph) {
  const chars = [...ph.georgian.replace(/\s/g, '').replace(/[?!.,]/g, '')]
  const tokens = ph.tokens?.length || 1
  return chars.length * 2 + tokens * 5
}

function buildUnits() {
  const n = LEVEL_META.length
  const wordBuckets = assignBuckets(allWords, wordDifficulty, n)
  const phraseBuckets = assignBuckets(phrases, phraseDifficulty, n)

  return LEVEL_META.map((meta, i) => {
    const words = wordBuckets[i] || []
    const phs = phraseBuckets[i] || []
    const items = [...words, ...phs]
    const id = i + 1
    return {
      id,
      key: `unit-${id}`,
      title: `Level ${id}`,
      subtitle: meta.subtitle,
      grammar: meta.grammar,
      icon: String(id),
      kind: 'mixed',
      skill: 'Listen · Read · Write · Talk',
      words,
      phrases: phs,
      items,
    }
  }).filter(u => u.items.length > 0)
}

/** Progressive mixed units after Alphabet. */
export const units = buildUnits()

export function getUnit(unitId) {
  return units.find(u => u.id === Number(unitId)) || null
}

export function unitBest(progress, unitId) {
  const map = progress?.unitLevelBest || {}
  const id = Number(unitId)
  return Number(map[id] || map[String(id)] || 0)
}

/** Alphabet must be ready; then Level N needs ≥60% on Level N−1. */
export function isUnitUnlocked(unitId, progress, alphabetReadyFn) {
  const id = Number(unitId)
  if (!id || id < 1) return false
  if (!alphabetReadyFn(progress)) return false
  if (id === 1) return true
  return unitBest(progress, id - 1) >= 60
}

export function unitUnlockHint(unitId, progress, alphabetReadyFn) {
  if (isUnitUnlocked(unitId, progress, alphabetReadyFn)) return null
  const id = Number(unitId)
  if (!alphabetReadyFn(progress)) {
    return 'Complete Alphabet first'
  }
  const prev = id - 1
  const best = unitBest(progress, prev)
  return `Score ≥60% on Level ${prev} first (best ${best}%)`
}
